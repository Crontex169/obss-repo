// DOSYA REHBERİ: Gerçek STT sağlayıcısının (şimdilik yalnızca Groq Whisper)
// uyması gereken sözleşmeyi tanımlar — llm.provider.ts'teki port/adapter
// deseninin birebir kopyası. Test fake'i (test/fakes/fake-transcription.provider.ts)
// TAM BU sınırdan takılır — gerçek sağlayıcıya istek atan test YAZILMAZ.
export interface TranscribeArgs {
  audio: Buffer;
  mimeType: string;
  /** Interview.language — dogruluk ve gecikmeyi iyilestirir (Whisper ipucu). */
  language: 'tr' | 'en';
  timeoutMs: number;
}

export interface TranscribeResult {
  text: string;
}

export interface TranscriptionProvider {
  transcribe(args: TranscribeArgs): Promise<TranscribeResult>;
}

export const TRANSCRIPTION_PROVIDER = Symbol('TRANSCRIPTION_PROVIDER');
