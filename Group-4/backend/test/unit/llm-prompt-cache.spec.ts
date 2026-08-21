import { cachedInputTokensOf } from '../../src/llm/providers/openai-compatible.provider';
import { estimateCostUsd } from '../../src/llm/providers/provider.config';
import { makeLlmService } from './helpers/make-llm-service';
import { z } from 'zod';

// C3 — saglayici prompt cache'i.
// Sistem talimati (+ DeepSeek yolunda JSON semasi) her cagrida ayni onektir;
// saglayici bu oneki onbellekler ve ucuz fiyatlar. Olculmezse tasarruf
// gorunmez ve admin panelindeki maliyet oldugundan yuksek cikar.
describe('prompt cache olcumu', () => {
  describe('cachedInputTokensOf — saglayicilar ayni bilgiyi farkli alanda verir', () => {
    it('DeepSeek: prompt_cache_hit_tokens', () => {
      expect(cachedInputTokensOf({ prompt_cache_hit_tokens: 4096 })).toBe(4096);
    });

    it('OpenAI/Groq: prompt_tokens_details.cached_tokens', () => {
      expect(
        cachedInputTokensOf({ prompt_tokens_details: { cached_tokens: 512 } }),
      ).toBe(512);
    });

    it('alan yoksa / usage hic yoksa 0 (olcemedik = onbellek yok gibi davran)', () => {
      expect(cachedInputTokensOf({ prompt_tokens: 900 })).toBe(0);
      expect(cachedInputTokensOf(undefined)).toBe(0);
    });
  });

  describe('estimateCostUsd — onbellekli token ayri fiyatlanir', () => {
    const pricing = { inputPerMillionUsd: 1, outputPerMillionUsd: 2 };

    it('cache fiyati bilinmiyorsa maliyet DEGISMEZ (tam girdi fiyati)', () => {
      const withCache = estimateCostUsd(pricing, 1_000_000, 0, 900_000);
      expect(withCache).toBeCloseTo(estimateCostUsd(pricing, 1_000_000, 0, 0));
    });

    it('cache fiyati verilirse yalnizca isabet eden kisim indirimlidir', () => {
      const discounted = { ...pricing, cachedInputPerMillionUsd: 0.1 };
      // 900k onbellekten (0.1$/M) + 100k tam fiyattan (1$/M) = 0.09 + 0.10
      expect(estimateCostUsd(discounted, 1_000_000, 0, 900_000)).toBeCloseTo(
        0.19,
      );
    });

    it('cached > input tutarsizligi negatif token uretmez', () => {
      const discounted = { ...pricing, cachedInputPerMillionUsd: 0.1 };
      expect(estimateCostUsd(discounted, 1_000, 0, 5_000)).toBeCloseTo(
        (1_000 * 0.1) / 1_000_000,
      );
    });
  });

  it('olculen deger TokenUsage kaydina gecer', async () => {
    const { service, fake, usage } = makeLlmService();
    fake.always({
      content: { ok: true },
      inputTokens: 8000,
      cachedInputTokens: 6400,
    });

    await service.generateStructured({
      schema: z.object({ ok: z.boolean() }),
      schemaName: 'probe',
      systemPrompt: 's',
      userData: 'd',
      operation: 'question_generation',
      userId: 'user-1',
    });

    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ inputTokens: 8000, cachedInputTokens: 6400 }),
    );
  });
});
