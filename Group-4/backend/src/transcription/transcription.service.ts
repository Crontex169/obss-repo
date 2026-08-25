// DOSYA REHBERİ: Controller'ın gördüğü tek yüz — sağlayıcı (Groq/yapılandırılmamış)
// detayını gizler, sabit zaman aşımını ve azami yükleme boyutunu burada tutar.
import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSCRIPTION_PROVIDER,
  type TranscribeResult,
  type TranscriptionProvider,
} from './transcription.provider';

// Groq'un 25 MB/dosya sinirinin (ucretsiz katman) altinda kalinir. Gorusme
// cevaplari QUESTION_TIME_LIMIT_SECONDS (90 sn) ile sinirlidir; gercekci bir
// kayit bunun COK altindadir — ayarlanabilir env degiskeni gerekmez (YAGNI).
export const MAX_AUDIO_UPLOAD_BYTES = 15 * 1024 * 1024;

// LLM_REQUEST_TIMEOUT_MS varsayilaniyla AYNI (docs/API_CONVENTIONS.md 3.2).
export const TRANSCRIPTION_TIMEOUT_MS = 30_000;

@Injectable()
export class TranscriptionService {
  constructor(
    @Inject(TRANSCRIPTION_PROVIDER)
    private readonly provider: TranscriptionProvider,
  ) {}

  transcribe(
    audio: Buffer,
    mimeType: string,
    language: 'tr' | 'en',
  ): Promise<TranscribeResult> {
    return this.provider.transcribe({
      audio,
      mimeType,
      language,
      timeoutMs: TRANSCRIPTION_TIMEOUT_MS,
    });
  }
}
