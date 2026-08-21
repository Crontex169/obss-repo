// DOSYA REHBERİ: Yapay zeka sağlayıcısı çöktüğünde kullanıcının saatlik
// kotasından düşülen hakkı geri veren ara katman. Kota, kötüye kullanımı
// engellemek için istek ÖNCESİ tüketilir; ama kullanıcı hiçbir şey almadan
// hakkını kaybetmemelidir.
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { Redis, Cluster } from 'ioredis';
import { Observable, catchError, throwError } from 'rxjs';
import { LlmProviderError, LlmTimeoutError } from '../llm/llm.errors';
import {
  LLM_QUOTA_KEY,
  LLM_THROTTLER_NAME,
} from './guards/llm-rate-limit.guard';

/**
 * HANGI HATA IADE EDILIR — ayrim kasitlidir:
 *
 *   LlmTimeoutError / LlmProviderError (504/502) -> IADE EDILIR.
 *     Saglayici cevap veremedi. Kullanici hicbir sey almadi ve bu sonucu
 *     kendi girdisiyle uretemez; hakkini kaybetmesi cezalandirma olurdu.
 *
 *   LlmSchemaError (502) -> IADE EDILMEZ.
 *     Saglayici AYAKTA ve token harcandi; yaniti sema disi cikaran sey cogu
 *     zaman girdinin kendisidir. Iade edilseydi, semayi guvenilir sekilde
 *     bozan bir girdi SINIRSIZ ucretsiz cagri kapisina donerdi.
 *
 *   InvalidJobPostingError (422) -> IADE EDILMEZ. LLM dogru calisti; uygun
 *     olmayan sey kullanici girdisi.
 */
const REFUNDABLE = [LlmTimeoutError, LlmProviderError] as const;

@Injectable()
export class LlmQuotaRefundInterceptor implements NestInterceptor {
  private readonly logger = new Logger('LlmQuotaRefund');

  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error: unknown) => {
        if (REFUNDABLE.some((type) => error instanceof type)) {
          // Iade YAN ETKIDIR: basarisiz olsa bile kullaniciya giden hata
          // degismemelidir, bu yuzden beklenmez ve yutulur.
          void this.refund(context);
        }
        return throwError(() => error);
      }),
    );
  }

  private async refund(context: ExecutionContext): Promise<void> {
    const req = context
      .switchToHttp()
      .getRequest<{ [LLM_QUOTA_KEY]?: string }>();
    const key = req[LLM_QUOTA_KEY];
    // Guard calismadiysa (uc nokta kotasiz) iade edilecek bir sey yok.
    if (!key) return;

    const redis = redisOf(this.storage);
    if (!redis) {
      // Bellek deposunda GUVENLI IADE YOK: kutuphane her isabet icin ayri bir
      // zamanlayici kurar ve o zamanlayici sayaci ZATEN dusurecektir. Elle bir
      // daha dusurmek sayaci eksiye tasir, yani kullaniciya limitin USTUNDE
      // hak kazandirir. Sessizce yanlis davranmaktansa iade yapmiyoruz.
      // Iade istiyorsaniz REDIS_URL verin (bkz. common/throttler-storage.ts).
      return;
    }

    try {
      // Anahtar bicimi @nest-lab/throttler-storage-redis'in `increment`
      // fonksiyonuyla AYNI olmak zorundadir; orada sayac duz bir INCR'dir,
      // dolayisiyla iade duz bir DECR'dir. Bicim degisirse
      // test/unit/llm-quota-refund.spec.ts kirilir (kasitli bekci).
      await redis.decr(`{${key}:${LLM_THROTTLER_NAME}}:hits`);
    } catch (cause) {
      this.logger.warn(
        `Kota iadesi basarisiz (kullanici hakkini geri alamadi): ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      );
    }
  }
}

/** Depo Redis destekli mi? Bellek deposunda `redis` alani yoktur. */
function redisOf(storage: ThrottlerStorage): Redis | Cluster | undefined {
  return (storage as { redis?: Redis | Cluster }).redis;
}
