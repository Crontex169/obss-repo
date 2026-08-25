// DOSYA REHBERİ: Sözlü mod STT (Whisper) çağrılarında KULLANICI BAŞINA
// saatlik kota uygulayan bekçi — llm-rate-limit.guard.ts ile AYNI desen,
// AYRI kova ('stt'). LLM kotasından bağımsızdır: bir kullanıcı çok sayıda
// kayıt gönderip STT kotasını tüketse bile görüşme oluşturma/cevap gönderme
// kotası ETKİLENMEZ (ADR-0014).
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  type ThrottlerRequest,
  seconds,
} from '@nestjs/throttler';
import { logThrottled, setRetryAfter } from './throttle-response';

// Kota iadesi (S5, llm-quota-refund.interceptor.ts) BURAYA UYGULANMAZ —
// bilinçli, spec kapsamı dışı
// (docs/superpowers/specs/2026-08-24-stt-whisper-design.md).
export class SttRateLimitGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.throttler.name !== STT_THROTTLER_NAME) {
      return true;
    }
    return super.handleRequest(requestProps);
  }

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
    setRetryAfter(context, detail.timeToBlockExpire);
    logThrottled(
      context,
      STT_THROTTLER_NAME,
      detail.limit,
      detail.timeToBlockExpire,
    );
    throw new HttpException(
      {
        message:
          'Saatlik ses cevirme sinirina ulastiniz. Lutfen daha sonra tekrar deneyin.',
        details: { retryAfterSeconds: detail.timeToBlockExpire },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export const STT_THROTTLER_NAME = 'stt';

export function sttQuota(limit: number) {
  return { [STT_THROTTLER_NAME]: { limit, ttl: seconds(3600) } };
}
