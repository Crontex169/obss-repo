import {
  OpenAiCompatibleProvider,
  buildClientOptions,
} from '../../src/llm/providers/openai-compatible.provider';
import { GROQ_TEST_CONFIG } from './helpers/make-llm-service';

// T025 — Otomatik yeniden deneme KAPALI (docs/API_CONVENTIONS.md 3.4).
// Her tekrar kullanici tetikli; aksi halde tek hata Groq ucretsiz katman
// kotasini sessizce katlar.
describe('otomatik yeniden deneme kapali', () => {
  it('SDK maxRetries: 0 ile kurulur', () => {
    expect(buildClientOptions(GROQ_TEST_CONFIG)).toMatchObject({
      maxRetries: 0,
      baseURL: GROQ_TEST_CONFIG.baseUrl,
    });
  });

  it('basarisiz cagrida TEK istek yapilir', async () => {
    const create = jest.fn().mockRejectedValue(new Error('503'));
    const provider = new OpenAiCompatibleProvider(GROQ_TEST_CONFIG, {
      chat: { completions: { create } },
    } as never);

    await expect(
      provider.call({
        jsonSchema: { type: 'object' },
        schemaName: 'probe',
        systemPrompt: 's',
        userData: 'd',
        timeoutMs: 1000,
        maxTokens: 4096,
      }),
    ).rejects.toThrow();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('timeout saglayici SDK sine de iletilir', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: '{}' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const provider = new OpenAiCompatibleProvider(GROQ_TEST_CONFIG, {
      chat: { completions: { create } },
    } as never);

    await provider.call({
      jsonSchema: { type: 'object' },
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      timeoutMs: 60_000,
      maxTokens: 4096,
    });

    expect(create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ timeout: 60_000 }),
    );
  });
});
