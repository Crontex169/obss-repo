import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { TokenUsageService } from '../../src/llm/token-usage.service';
import { makeLlmService } from './helpers/make-llm-service';

// T026 — FR-016 / docs/API_CONVENTIONS.md 4.1
// Token/maliyet MOTORUN ICINDE yazilir; cagiran dikey unutamaz.
describe('TokenUsage yazimi', () => {
  const schema = z.object({ ok: z.boolean() });
  const baseArgs = {
    schema,
    schemaName: 'probe',
    systemPrompt: 's',
    userData: 'd',
    operation: 'question_generation' as const,
    userId: 'user-1',
    interviewId: 'interview-1',
  };

  it('basarili cagrida tam kayit yazilir', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({
      content: { ok: true },
      inputTokens: 812,
      outputTokens: 1450,
    });

    await service.generateStructured(baseArgs);

    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        interviewId: 'interview-1',
        operation: 'question_generation',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        inputTokens: 812,
        outputTokens: 1450,
        succeeded: true,
      }),
    );
  });

  it('basarisiz cagrida da yazilir (succeeded: false)', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({ error: new Error('503') });

    await expect(service.generateStructured(baseArgs)).rejects.toThrow();
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ succeeded: false, userId: 'user-1' }),
    );
  });

  it('saglayici usage dondurmezse token 0 yazilir, kayit yine olusur', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({ content: { ok: true }, omitUsage: true });

    await service.generateStructured(baseArgs);
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 0, outputTokens: 0 }),
    );
  });

  // docs/METRICS.md — LLM gecikmesinin TEK olcum kaynagi bu kolon. Basarisiz
  // cagrilarda da yazilmali: en uzun bekleme genelde timeout'a giden cagridir.
  describe('durationMs', () => {
    it('basarili cagrida sure yazilir', async () => {
      const { service, fake, usage } = makeLlmService();
      fake.always({ content: { ok: true } });

      await service.generateStructured(baseArgs);

      const entry = usage.record.mock.calls[0][0] as {
        durationMs: number;
      };
      expect(typeof entry.durationMs).toBe('number');
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('saglayici hata verdiginde de sure yazilir', async () => {
      const { service, fake, usage } = makeLlmService();
      fake.always({ error: new Error('503') });

      await expect(service.generateStructured(baseArgs)).rejects.toThrow();

      const entry = usage.record.mock.calls[0][0] as {
        durationMs: number;
        succeeded: boolean;
      };
      expect(entry.succeeded).toBe(false);
      expect(typeof entry.durationMs).toBe('number');
    });
  });

  describe('kalicilastirma', () => {
    const pricing = { inputPerMillionUsd: 0.14, outputPerMillionUsd: 0.28 };
    const entry = {
      userId: 'user-1',
      operation: 'interview_report' as const,
      interviewId: 'interview-1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      succeeded: true,
      pricing,
    };

    it('maliyeti saglayici birim fiyatindan hesaplar', async () => {
      const create = jest.fn().mockResolvedValue({});
      const service = new TokenUsageService({
        tokenUsage: { create },
      } as unknown as PrismaService);

      await service.record(entry);

      // 1M girdi * 0.14 + 0.5M cikti * 0.28 = 0.14 + 0.14 = 0.28
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({ estimatedCostUsd: 0.28 }),
      });
      // pricing bir HESAP GIRDISI, kolon degil — tabloya sizmaz.
      expect(create.mock.calls[0][0].data).not.toHaveProperty('pricing');
    });

    it('groq ucretsiz katmanda maliyet 0 ama tokenlar yine kaydedilir', async () => {
      const create = jest.fn().mockResolvedValue({});
      const service = new TokenUsageService({
        tokenUsage: { create },
      } as unknown as PrismaService);

      await service.record({
        ...entry,
        provider: 'groq',
        pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estimatedCostUsd: 0,
          inputTokens: 1_000_000,
          outputTokens: 500_000,
        }),
      });
    });

    it('yazim hatasi kullanici akisini BOZMAZ ama sessizce yutulmaz', async () => {
      const logged = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const service = new TokenUsageService({
        tokenUsage: {
          create: jest.fn().mockRejectedValue(new Error('db down')),
        },
      } as unknown as PrismaService);

      await expect(service.record(entry)).resolves.toBeUndefined();
      expect(logged).toHaveBeenCalled();
      logged.mockRestore();
    });
  });
});
