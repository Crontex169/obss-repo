// DOSYA REHBERİ: LLM'den kaynaklanan hataları (zaman aşımı, beklenmeyen
// format, sağlayıcı çökmesi) standart HTTP hatalarına çeviren üç özel hata
// sınıfı. Gerçek hata detayı (ör. sağlayıcının ham cevabı) kullanıcıya asla
// gösterilmez, sadece "tekrar dene" diyen genel bir mesaj döner.
import { HttpException, HttpStatus } from '@nestjs/common';

// LLM hata siniflari — docs/API_CONVENTIONS.md 3.4.
//
// HttpException'dan turuyorlar ki global hata zarfi filtresi (common/
// http-exception.filter.ts) HTTP eslemesini kendiliginden yapsin; her cagiran
// dikeyde try/catch -> map tekrari olmasin.
//   LlmTimeoutError  -> 504 GatewayTimeout
//   LlmSchemaError   -> 502 BadGateway
//   LlmProviderError -> 502 BadGateway
//
// Saglayici yaniti / ic hata metni KULLANICIYA gitmez (2); ayrinti `cause` icinde
// kalir ve yalnizca sunucu logunda gorunur.
//
// `details.retryable: true` UC SINIFIN DE ortak ozelligidir: her LLM hatasi kullanici
// tetikli tekrar denemeye aciktir (otomatik retry YOK, maxRetries: 0). Frontend
// "Tekrar dene" dugmesini buna gore gosterir. Bayrak burada, base sinifta durur ki
// cagiran dikeyler kendi sarmalamalarini yazmak zorunda kalmasin — daha once yalnizca
// 003-pre-assessment ekliyordu, 002-interview'in sozlesmesi (contracts/interview-api.md)
// vaat ettigi halde kod uretmiyordu (bulgu I8 / T119).

export class LlmError extends HttpException {
  constructor(message: string, status: HttpStatus, cause?: unknown) {
    super({ message, details: { retryable: true } }, status, { cause });
  }
}

export class LlmTimeoutError extends LlmError {
  constructor(
    message = 'Yapay zeka yaniti zamaninda gelmedi. Lutfen tekrar deneyin.',
    cause?: unknown,
  ) {
    super(message, HttpStatus.GATEWAY_TIMEOUT, cause);
  }
}

export class LlmSchemaError extends LlmError {
  constructor(
    message = 'Yapay zeka beklenen bicimde yanit uretmedi. Lutfen tekrar deneyin.',
    cause?: unknown,
  ) {
    super(message, HttpStatus.BAD_GATEWAY, cause);
  }
}

export class LlmProviderError extends LlmError {
  constructor(
    message = 'Yapay zeka servisine su anda ulasilamiyor. Lutfen tekrar deneyin.',
    cause?: unknown,
  ) {
    super(message, HttpStatus.BAD_GATEWAY, cause);
  }
}
