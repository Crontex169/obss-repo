import { UnconfiguredTranscriptionProvider } from '../../src/transcription/providers/unconfigured-transcription.provider';
import { TranscriptionProviderError } from '../../src/transcription/transcription.errors';

// GROQ_API_KEY yok -> her cagri AYNI hata (spec karari: ayri bir
// "yapilandirilmamis" durumu yok, saglayici hatasiyla AYNI yoldan gecer).
describe('UnconfiguredTranscriptionProvider', () => {
  it('her cagri TranscriptionProviderError firlatir', async () => {
    const provider = new UnconfiguredTranscriptionProvider();
    await expect(
      provider.transcribe({
        audio: Buffer.from('x'),
        mimeType: 'audio/webm',
        language: 'tr',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(TranscriptionProviderError);
  });
});
