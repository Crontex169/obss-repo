// DOSYA REHBERİ: Tek noktadan hata biçimlendirme. Uygulamanın herhangi bir
// yerinde fırlatılan her hatayı yakalayıp aynı kalıba
// ({ statusCode, error, message, details? }) çevirir. Beklenmedik (kod hatası
// gibi) durumlarda stack trace/SQL/dosya yolu asla istemciye gitmez — sadece
// sunucu logunda kalır, kullanıcıya jenerik "beklenmeyen hata" mesajı döner.
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

//Tek noktadan hata biçimlendirme. Uygulamanın herhangi bir yerinde fırlatılan her hatayı yakalayıp aynı kalıba 
// ( { statusCode, error, message, details? } ) çevirir. Beklenmedik (kod hatası gibi) durumlarda stack trace/SQL/dosya yolu asla istemciye gitmez — 
// sadece sunucu logunda kalır, kullanıcıya jenerik "beklenmeyen hata" mesajı döner.



// Ortak hata zarfi — docs/API_CONVENTIONS.md 2.
// { statusCode, error, message, details? }
// YASAK: ic hata metni, stack trace, saglayici yaniti, SQL, dosya yolu.

interface ErrorEnvelope {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

// 429 -> "TooManyRequests", 404 -> "NotFound". Istemci buna gore dallanir.
function errorName(status: number): string {
  return (STATUS_CODES[status] ?? 'Error').replace(/[^A-Za-z]/g, '');
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (!(exception instanceof HttpException)) {
      // Beklenmeyen hata: ayrinti YALNIZCA sunucu logunda kalir (sessiz yutma yok).
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'InternalServerError',
        message: 'Beklenmeyen bir hata olustu. Lutfen tekrar deneyin.',
      } satisfies ErrorEnvelope);
      return;
    }

    const status = exception.getStatus();
    const raw = exception.getResponse();
    const envelope: ErrorEnvelope = {
      statusCode: status,
      error: errorName(status),
      message: messageOf(raw, status),
    };

    const details = detailsOf(raw);
    if (details) envelope.details = details;

    response.status(status).json(envelope);
  }
}

function messageOf(raw: string | object, status: number): string {
  if (typeof raw === 'string') return raw;
  const message = (raw as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  // ValidationPipe dizi doner; istemciye tek satir gosterilir.
  if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
    return message.join('; ');
  }
  return STATUS_CODES[status] ?? 'Error';
}

function detailsOf(raw: string | object): Record<string, unknown> | undefined {
  if (typeof raw === 'string') return undefined;
  const details = (raw as { details?: unknown }).details;
  return details && typeof details === 'object'
    ? (details as Record<string, unknown>)
    : undefined;
}
