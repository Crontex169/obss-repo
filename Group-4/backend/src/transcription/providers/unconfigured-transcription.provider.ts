// DOSYA REHBERİ: GROQ_API_KEY ayarlanmamışsa devreye giren "boş nesne"
// adapter — sözlü modun STT kısmı kapalı sayılır. Kullanıcıya giden hata
// sağlayıcı hatasıyla AYNIDIR (spec karari, 2026-08-24): ayrı bir
// "yapılandırılmamış" durumu eklenmedi, tek hata yolu ikisini de kapsar.
import { TranscriptionProviderError } from '../transcription.errors';
import type {
  TranscribeArgs,
  TranscribeResult,
  TranscriptionProvider,
} from '../transcription.provider';

export class UnconfiguredTranscriptionProvider implements TranscriptionProvider {
  transcribe(_args: TranscribeArgs): Promise<TranscribeResult> {
    return Promise.reject(new TranscriptionProviderError());
  }
}
