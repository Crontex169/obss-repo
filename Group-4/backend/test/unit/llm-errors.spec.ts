import { z } from 'zod';
import {
  LlmProviderError,
  LlmSchemaError,
  LlmTimeoutError,
} from '../../src/llm/llm.errors';
import { OpenAiCompatibleProvider } from '../../src/llm/providers/openai-compatible.provider';
import { GROQ_TEST_CONFIG, makeLlmService } from './helpers/make-llm-service';

// T023 — Hata sinifi eslemesi (docs/API_CONVENTIONS.md 3.4)
//   LlmTimeoutError  -> 504
//   LlmSchemaError   -> 502 (bos yanit, gecersiz JSON, sema uyumsuzlugu)
//   LlmProviderError -> 502 (saglayici 4xx/5xx, ag hatasi)
describe('LLM hata siniflari', () => {
  const schema = z.object({ questions: z.array(z.string()).length(3) });
  const args = {
    schema,
    schemaName: 'probe',
    systemPrompt: 's',
    userData: 'd',
    operation: 'question_generation' as const,
    userId: 'u1',
  };

  it('bos yanit -> LlmSchemaError', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ rawContent: '' });
    await expect(service.generateStructured(args)).rejects.toBeInstanceOf(
      LlmSchemaError,
    );
  });

  it('gecersiz JSON -> LlmSchemaError', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ rawContent: '{"questions": [' });
    await expect(service.generateStructured(args)).rejects.toBeInstanceOf(
      LlmSchemaError,
    );
  });

  it('gecerli JSON ama sema uyumsuz -> LlmSchemaError', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ content: { questions: ['a', 'b'] } }); // 3 bekleniyordu
    await expect(service.generateStructured(args)).rejects.toBeInstanceOf(
      LlmSchemaError,
    );
  });

  it('saglayici 500 -> LlmProviderError', async () => {
    const provider = new OpenAiCompatibleProvider(GROQ_TEST_CONFIG, {
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(
            Object.assign(new Error('Internal Server Error'), {
              status: 500,
            }),
          ),
        },
      },
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
    ).rejects.toBeInstanceOf(LlmProviderError);
  });

  it('ag hatasi -> LlmProviderError', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ error: new Error('ECONNRESET') });
    await expect(service.generateStructured(args)).rejects.toBeInstanceOf(
      LlmProviderError,
    );
  });

  it('HTTP eslemeleri 3.4 tablosuyla ayni', async () => {
    expect(new LlmTimeoutError().getStatus()).toBe(504);
    expect(new LlmSchemaError().getStatus()).toBe(502);
    expect(new LlmProviderError().getStatus()).toBe(502);
  });

  // Bulgu I8 / T119: `details.retryable` UC sinifta da uretilmeli. Daha once
  // yalnizca 003-pre-assessment kendi sinirinda sarmalayarak ekliyordu; 002'nin
  // sozlesmesi (contracts/interview-api.md 502/504 satirlari) alani vaat ettigi
  // halde kod uretmiyordu. Bayrak artik LlmError base sinifinda.
  it('uc hata sinifi da details.retryable: true tasir (3.4)', () => {
    for (const err of [
      new LlmTimeoutError(),
      new LlmSchemaError(),
      new LlmProviderError(),
    ]) {
      expect(err.getResponse()).toMatchObject({ details: { retryable: true } });
    }
  });

  it('saglayici yaniti kullaniciya gosterilen mesaja SIZMAZ', async () => {
    const { service, fake } = makeLlmService();
    fake.always({
      error: new Error('groq api key sk-live-1234 rejected at 10.0.0.5'),
    });

    const err = await service.generateStructured(args).catch((e: unknown) => e);
    const body = JSON.stringify((err as LlmProviderError).getResponse());
    expect(body).not.toContain('sk-live-1234');
    expect(body).not.toContain('10.0.0.5');
  });

  it('dogrulamayi gecmeyen yanit KAYDEDILMEZ — cagirana hata gider', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({ content: { questions: ['a'] } });

    await expect(service.generateStructured(args)).rejects.toBeInstanceOf(
      LlmSchemaError,
    );
    // Maliyet kaydi yine yazilir, ama basarisiz olarak.
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ succeeded: false }),
    );
  });
});
