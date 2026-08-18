import { z } from 'zod';
import { LlmTimeoutError } from '../../src/llm/llm.errors';
import { makeLlmService } from './helpers/make-llm-service';

// T022 — Cagri basina timeout (docs/API_CONVENTIONS.md 3.2, SC-005).
// Varsayilan 30 sn; interview raporu cagri basina 60 sn ile override eder.
describe('LlmService timeout', () => {
  const schema = z.object({ ok: z.boolean() });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('varsayilan 30 sn asilirsa LlmTimeoutError', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ delayMs: 31_000, content: { ok: true } });

    const call = service.generateStructured({
      schema,
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      operation: 'question_generation',
      userId: 'u1',
    });
    const assertion = expect(call).rejects.toBeInstanceOf(LlmTimeoutError);

    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;
  });

  it('cagri basina timeoutMs: 60000 ile 45 sn suren cagri BASARILI olur', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ delayMs: 45_000, content: { ok: true } });

    const call = service.generateStructured({
      schema,
      schemaName: 'report',
      systemPrompt: 's',
      userData: 'd',
      timeoutMs: 60_000,
      operation: 'interview_report',
      userId: 'u1',
    });

    await jest.advanceTimersByTimeAsync(45_000);
    await expect(call).resolves.toEqual({ ok: true });
  });

  it('timeout saglayiciya da iletilir — soket acik kalmaz', async () => {
    const { service, fake } = makeLlmService();
    fake.always({ content: { ok: true } });

    await service.generateStructured({
      schema,
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      timeoutMs: 60_000,
      operation: 'interview_report',
      userId: 'u1',
    });

    expect(fake.calls[0].timeoutMs).toBe(60_000);
  });

  it('timeout da TokenUsage yazar (succeeded: false)', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({ delayMs: 31_000, content: { ok: true } });

    const call = service.generateStructured({
      schema,
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      operation: 'question_generation',
      userId: 'u1',
    });
    const assertion = expect(call).rejects.toBeInstanceOf(LlmTimeoutError);
    await jest.advanceTimersByTimeAsync(30_000);
    await assertion;

    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ succeeded: false, userId: 'u1' }),
    );
  });
});
