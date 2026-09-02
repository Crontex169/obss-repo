// DOSYA REHBERİ: Her isteğin ne kadar sürdüğünü ölçüp loglayan ara katman
// (interceptor). Amaç tek bir isteği izlemek değil, "hangi uç nokta yavaş"
// sorusuna toplu olarak cevap verebilmek — 1 saniyeyi aşan istekler warn
// seviyesinde ayrıca işaretlenir.
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

// Her isteğin ne kadar sürdüğünü ölçüp loglayan ara katman (interceptor). Amaç tek bir isteği izlemek değil,
// "hangi uç nokta yavaş" sorusuna toplu olarak cevap verebilmek — 1 saniyeyi aşan istekler  warn  seviyesinde ayrıca işaretlenir.

// Her HTTP istegi icin duvar saati suresi. Amac tek bir istegi izlemek DEGIL,
// "hangi endpoint yavas" sorusunu olculebilir kilmak: log satirlari toplanip
// endpoint bazli p50/p95 cikarilabilir (bkz. docs/METRICS.md).
//
// Neden interceptor, neden middleware degil: interceptor guard'lardan SONRA
// calisir, yani 401/403 ile reddedilen istekler de olculur ama asil ilgilendigimiz
// handler suresi dogru cerceveleniyor. Ayrica hem basari hem hata yolunu tek
// yerden yakalar.
//
// Log formati kasitli olarak sabit ve ayristirilabilir:
//   [timing] METHOD /route 200 123ms
// Boylece `grep "\[timing\]"` ciktisi dogrudan bir olcum veri setidir.

/** Uzerinde uyari basilan esik. Altindaki istekler debug seviyesinde kalir. */
const SLOW_REQUEST_MS = 1_000;

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestTiming');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const startedAt = Date.now();

    // Ham URL yerine route sablonu (/interview/:id) kullaniyoruz: aksi halde
    // her id ayri bir satir olur ve endpoint bazli toplama yapilamaz.
    const route =
      (request.route as { path?: string } | undefined)?.path ?? request.path;
    const method = request.method;

    const log = (status: number) => {
      const durationMs = Date.now() - startedAt;
      const line = `[timing] ${method} ${route} ${status} ${durationMs}ms`;
      if (durationMs >= SLOW_REQUEST_MS) {
        this.logger.warn(line);
      } else {
        this.logger.debug(line);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => log(http.getResponse<Response>().statusCode),
        // Hata yolunda da olcum sart: en yavas istekler cogu zaman timeout'a
        // giden basarisiz LLM cagrilaridir.
        error: (error: { status?: number }) => log(error?.status ?? 500),
      }),
    );
  }
}
