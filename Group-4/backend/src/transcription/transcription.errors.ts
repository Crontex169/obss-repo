// DOSYA REHBERİ: STT çağrısından kaynaklanan hataları standart bir HTTP
// hatasına çeviren TEK sınıf — llm.errors.ts'teki desenle aynı: gerçek
// sağlayıcı hatası kullanıcıya gitmez, yalnızca `cause` içinde sunucu
// logunda kalır.
import { HttpException, HttpStatus } from '@nestjs/common';

// TranscriptionProviderError -> 502 BadGateway.
//
// TEK sinif yeterli (LLM'deki 3 ayrimin aksine): sonuc frontend'de HER
// zaman ayni davranisi tetikler (yaziliya dus + hata goster — spec karari),
// yani ag hatasi/zaman asimi/saglayici 5xx/yapilandirilmamis anahtar
// ARASINDA ayrim yapmanin bir tuketicisi yok.
export class TranscriptionProviderError extends HttpException {
  constructor(
    message = 'Ses metne cevrilemedi. Lutfen tekrar deneyin.',
    cause?: unknown,
  ) {
    super({ message, details: { retryable: true } }, HttpStatus.BAD_GATEWAY, {
      cause,
    });
  }
}
