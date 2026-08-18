import type {
  LlmCallArgs,
  LlmCallResult,
  LlmProvider,
} from '../../src/llm/llm.provider';

// PAYLASILAN LLM test fake'i — port sinirinda takilir (T035).
// 003-pre-assessment bunu DEVRALIR. Gercek saglayiciya istek atan test YAZILMAZ.

export interface FakeLlmScenario {
  /** Donecek ham icerik. Nesne verilirse JSON.stringify edilir. */
  content?: unknown;
  /** Bozuk JSON / bos yanit senaryolari icin ham metin. */
  rawContent?: string;
  /** call() bunu firlatir (saglayici hatasi / ag hatasi simulasyonu). */
  error?: unknown;
  /** Yanittan once beklenecek sure (ms) — timeout testleri icin. */
  delayMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  /** Saglayici usage dondurmedi senaryosu. */
  omitUsage?: boolean;
}

export class FakeLlmProvider implements LlmProvider {
  /** Yapilan her cagrinin argumanlari — cagri SAYISI da buradan dogrulanir. */
  readonly calls: LlmCallArgs[] = [];

  private queue: FakeLlmScenario[] = [];
  private fallback: FakeLlmScenario = { content: {} };

  constructor(
    public provider = 'groq',
    public model = 'openai/gpt-oss-120b',
  ) {}

  /** Sirali senaryolar — adaptif akis gibi cok cagrili testler icin. */
  enqueue(...scenarios: FakeLlmScenario[]): this {
    this.queue.push(...scenarios);
    return this;
  }

  /** Kuyruk bosaldiginda kullanilacak varsayilan senaryo. */
  always(scenario: FakeLlmScenario): this {
    this.fallback = scenario;
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.queue = [];
  }

  async call(args: LlmCallArgs): Promise<LlmCallResult> {
    this.calls.push(args);
    const scenario = this.queue.shift() ?? this.fallback;

    if (scenario.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, scenario.delayMs));
    }
    if (scenario.error !== undefined) {
      throw scenario.error;
    }

    return {
      content: scenario.rawContent ?? JSON.stringify(scenario.content ?? {}),
      inputTokens: scenario.omitUsage ? 0 : (scenario.inputTokens ?? 100),
      outputTokens: scenario.omitUsage ? 0 : (scenario.outputTokens ?? 250),
      provider: this.provider,
      model: this.model,
    };
  }
}
