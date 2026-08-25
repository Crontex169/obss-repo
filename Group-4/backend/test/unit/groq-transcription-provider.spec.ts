import {
  GroqTranscriptionProvider,
  buildGroqTranscriptionClientOptions,
} from '../../src/transcription/providers/groq-transcription.provider';
import { TranscriptionProviderError } from '../../src/transcription/transcription.errors';

// ADR-0014 — openai-compatible.provider.ts'teki llm-no-retry.spec.ts
// deseninin kopyasi: gercek Groq'a istek atilmaz, SDK'nin `audio` yuzeyi
// sahtelenir.
describe('GroqTranscriptionProvider', () => {
  it('SDK maxRetries: 0 ve Groq baseURL ile kurulur', () => {
    expect(buildGroqTranscriptionClientOptions('test-key')).toMatchObject({
      apiKey: 'test-key',
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 0,
    });
  });

  it('basarili yanitta metni doner, dogru model/dil/format ile cagirir', async () => {
    const create = jest.fn().mockResolvedValue({ text: 'merhaba dunya' });
    const provider = new GroqTranscriptionProvider('test-key', {
      audio: { transcriptions: { create } },
    } as never);

    const result = await provider.transcribe({
      audio: Buffer.from('sahte-ses-baytlari'),
      mimeType: 'audio/webm',
      language: 'tr',
      timeoutMs: 5000,
    });

    expect(result).toEqual({ text: 'merhaba dunya' });
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as [
      { model: string; language: string; response_format: string },
      { timeout: number },
    ];
    expect(params.model).toBe('whisper-large-v3-turbo');
    expect(params.language).toBe('tr');
    expect(params.response_format).toBe('json');
    expect(options.timeout).toBe(5000);
  });

  it('saglayici hatasinda TranscriptionProviderError firlatir, TEK istek yapilir', async () => {
    const create = jest.fn().mockRejectedValue(new Error('503'));
    const provider = new GroqTranscriptionProvider('test-key', {
      audio: { transcriptions: { create } },
    } as never);

    await expect(
      provider.transcribe({
        audio: Buffer.from('x'),
        mimeType: 'audio/webm',
        language: 'en',
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(TranscriptionProviderError);

    expect(create).toHaveBeenCalledTimes(1);
  });
});
