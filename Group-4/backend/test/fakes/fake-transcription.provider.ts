import type {
  TranscribeArgs,
  TranscribeResult,
  TranscriptionProvider,
} from '../../src/transcription/transcription.provider';

// PAYLASILAN STT test fake'i — fake-llm.provider.ts ile AYNI desen. Gercek
// saglayiciya istek atan test YAZILMAZ.
export interface FakeTranscriptionScenario {
  text?: string;
  /** transcribe() bunu firlatir (saglayici hatasi simulasyonu). */
  error?: unknown;
}

export class FakeTranscriptionProvider implements TranscriptionProvider {
  readonly calls: TranscribeArgs[] = [];

  private queue: FakeTranscriptionScenario[] = [];
  private fallback: FakeTranscriptionScenario = { text: '' };

  enqueue(...scenarios: FakeTranscriptionScenario[]): this {
    this.queue.push(...scenarios);
    return this;
  }

  always(scenario: FakeTranscriptionScenario): this {
    this.fallback = scenario;
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.queue = [];
  }

  async transcribe(args: TranscribeArgs): Promise<TranscribeResult> {
    this.calls.push(args);
    const scenario = this.queue.shift() ?? this.fallback;
    if (scenario.error !== undefined) throw scenario.error;
    return { text: scenario.text ?? '' };
  }
}
