import { TranscriptionService } from '../../src/transcription/transcription.service';
import { FakeTranscriptionProvider } from '../fakes/fake-transcription.provider';

describe('TranscriptionService', () => {
  it('saglayiciyi dogru argumanlarla cagirir ve metni doner', async () => {
    const fake = new FakeTranscriptionProvider();
    fake.always({ text: 'deneme metni' });
    const service = new TranscriptionService(fake);

    const result = await service.transcribe(
      Buffer.from('ses'),
      'audio/webm',
      'tr',
    );

    expect(result).toEqual({ text: 'deneme metni' });
    expect(fake.calls[0]).toMatchObject({
      mimeType: 'audio/webm',
      language: 'tr',
    });
    expect(fake.calls[0].timeoutMs).toBeGreaterThan(0);
  });

  it('saglayici hatasi oldugu gibi yukari gider', async () => {
    const fake = new FakeTranscriptionProvider();
    fake.always({ error: new Error('boom') });
    const service = new TranscriptionService(fake);

    await expect(
      service.transcribe(Buffer.from('ses'), 'audio/webm', 'en'),
    ).rejects.toThrow('boom');
  });
});
