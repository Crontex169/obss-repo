// DOSYA REHBERİ: 429 yanıtının iki ortak parçası — istemciye "ne zaman tekrar
// dene" diyen `Retry-After` başlığı ve sınıra takılmaları ölçülebilir
// kılan log satırı. İki ayrı guard (LLM kotası ve global emniyet freni)
// bunları aynı biçimde yazsın diye tek yerde duruyor.
import { Logger, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * `Retry-After` deger olarak TAM SANIYE ister (RFC 9110 §10.2.3; alternatifi
 * HTTP-date'tir). Throttler saniyeyi ondalikli verebildigi icin yukari
 * yuvarlanir — asagi yuvarlamak istemciyi sinir henuz kalkmadan tekrar
 * denemeye yollar ve ikinci bir 429 uretir.
 *
 * Alt sinir 1: `0` "hemen tekrar dene" demektir ve ayni sonucu dogurur.
 */
export function setRetryAfter(
  context: ExecutionContext,
  seconds: number,
): void {
  const res = context.switchToHttp().getResponse<Response>();
  // Yanit zaten gonderilmisse baslik eklemek hata firlatir; bu yol istisna
  // atmadan ONCE calisir ama savunma ucuz.
  if (res.headersSent) return;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(seconds))));
}

const logger = new Logger('RateLimit');

/**
 * 429 telemetrisi (2026-08-21) — 429'lar olculmedigi surece limitler tahminle ayarlanir: "kullanicilar
 * takiliyor mu, hangi ucta, kac kez" sorusunun bugun hicbir cevabi yok.
 *
 * RequestTimingInterceptor ile AYNI desen: sabit, ayristirilabilir tek satir,
 * yani `grep "\[ratelimit\]"` ciktisi dogrudan bir olcum veri setidir
 * (bkz. docs/METRICS.md).
 *
 * KIMLIK: yalnizca `userId` yazilir. Ham IP KASITLI OLARAK yazilmaz
 * (docs/SECURITY.md S8: loglarda kisisel veri) — IP kovasina takilan istekler
 * `user=yok` olarak gorunur, sayim yine dogru kalir.
 */
export function logThrottled(
  context: ExecutionContext,
  bucket: string,
  limit: number,
  retryAfterSeconds: number,
): void {
  const req = context.switchToHttp().getRequest<
    Request & {
      user?: { id?: string };
    }
  >();
  // Ham URL yerine route sablonu: aksi halde her :id ayri satir olur ve uc
  // nokta bazli toplama yapilamaz.
  const route = (req.route as { path?: string } | undefined)?.path ?? req.path;
  logger.warn(
    `[ratelimit] ${bucket} ${req.method} ${route} limit=${limit} ` +
      `user=${req.user?.id ?? 'yok'} retryAfter=${Math.max(1, Math.ceil(retryAfterSeconds))}s`,
  );
}
