// DOSYA REHBERİ: LLM çağıran uç noktalarda (görüşme oluşturma, cevap gönderme,
// rapor tekrar deneme) KULLANICI BAŞINA saatlik kota uygulayan bekçi.
// @LlmRateLimit(3) gibi süslenerek her uç noktaya farklı limit (3, 5, 60/saat)
// verilebiliyor; sayaç istek öncesi artıyor, yani başarısız LLM çağrısı da
// kotayı tüketiyor (kötüye kullanımı önlemek için).
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  type ThrottlerRequest,
  seconds,
} from '@nestjs/throttler';
import { logThrottled, setRetryAfter } from './throttle-response';



//LLM çağıran uç noktalarda (görüşme oluşturma, cevap gönderme, rapor tekrar deneme) kullanıcı başına saatlik kota uygulayan bekçi.  @LlmRateLimit(3)  gibi süslenerek 
// her uç noktaya farklı limit (3, 5, 60/saat) verilebiliyor; sayaç istek öncesi artıyor, yani başarısız LLM çağrısı da kotayı tüketiyor (kötüye kullanımı önlemek için).



// Saatlik LLM cagri siniri — FR-022, docs/API_CONVENTIONS.md 3.5.
// Insa sahibi: 002-interview. 003-pre-assessment bunu 5/saat ile DEVRALIR.
//
// Limit guard'a GOMULU DEGILDIR; her uc nokta kendi kotasini @LlmRateLimit ile verir:
//   POST /api/interviews                    -> 3/saat
//   POST /api/interviews/:id/report/retry   -> 5/saat
//   POST /api/interviews/:id/answers        -> 60/saat
//   POST /api/pre-assessments (003)         -> 5/saat
//
// Sayac istek ONCESI artar; downstream basarili da olsa basarisiz da olsa
// kontenjan tuketilir (basarili + basarisiz birlikte sayilir — 3.5).
export class LlmRateLimitGuard extends ThrottlerGuard {
  // Bu guard YALNIZCA `llm` kovasindan sorumludur. ThrottlerGuard varsayilan
  // olarak yapilandirilmis tum kovalari gezer; `default` kovasi (app.module.ts,
  // IP basina kaba emniyet freni) GlobalThrottleGuard'a aittir ve burada
  // yeniden degerlendirilirse ayni istek iki kez sayilir, ustelik 429 govdesi
  // yanlislikla LLM mesajini tasirdi. Bkz. global-throttle.guard.ts.
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== LLM_THROTTLER_NAME) {
      return true;
    }

    // Kota iadesi (llm-quota-refund.interceptor.ts) icin sayac anahtarini
    // istege iliştiririz. Anahtari BURADA uretmek onemlidir: bicimi
    // kutuphanenin `generateKey`i belirler ve iade tarafinda yeniden
    // uretilmeye calisilirsa iki yer sessizce ayrisabilir.
    const { context, throttler, getTracker, generateKey } = requestProps;
    const req = context
      .switchToHttp()
      .getRequest<Record<string, unknown> & { [LLM_QUOTA_KEY]?: string }>();
    const tracker = await getTracker(req, context);
    req[LLM_QUOTA_KEY] = generateKey(context, tracker, throttler.name!);

    return super.handleRequest(requestProps);
  }

  // Kota kullanici basinadir. Oturumsuz istek buraya normalde ulasmaz
  // (SessionGuard once calisir); yine de IP ye duserek acik kalmaz.
  // Iki metot da senkron; `async` ThrottlerGuard imzasinin Promise sartini
  // karsilamak icin duruyor (kaldirilirsa override tip hatasi verir).
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = (req as { user?: { id?: string } }).user?.id;
    return userId ?? (req.ip as string);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    // Retry-After (2026-08-21): sure govdede `details.retryAfterSeconds` olarak zaten vardi ama
    // STANDART yerinde degildi. `Retry-After` (RFC 9110 §10.2.3) 429'un
    // beklenen basligidir: tarayici/istemci kutuphaneleri, vekiller ve
    // izleme araclari govdeyi degil bunu okur. Ikisi ayni degeri tasir.
    setRetryAfter(context, detail.timeToBlockExpire);
    logThrottled(
      context,
      LLM_THROTTLER_NAME,
      detail.limit,
      detail.timeToBlockExpire,
    );
    throw new HttpException(
      {
        message:
          'Saatlik yapay zeka cagri sinirina ulastiniz. Lutfen daha sonra tekrar deneyin.',
        details: { retryAfterSeconds: detail.timeToBlockExpire },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

// Uc nokta basina kota. ttl her zaman 1 saat (3.5) — degisen yalnizca limit.
export const LLM_THROTTLER_NAME = 'llm';

/**
 * Guard'in tukettigi sayac anahtarinin istek uzerinde tasindigi alan.
 * `Symbol` bilerek: istek nesnesine eklenen bu alan bir uygulama verisi degil,
 * iki katman arasindaki ic haberlesmedir — JSON'a sizmaz, baska bir alanla
 * cakismaz.
 */
export const LLM_QUOTA_KEY = Symbol('llmQuotaKey');

export function llmQuota(limit: number) {
  return { [LLM_THROTTLER_NAME]: { limit, ttl: seconds(3600) } };
}
