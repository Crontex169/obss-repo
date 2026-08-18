import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { LlmService } from '../../src/llm/llm.service';
import { LlmProviderError, LlmSchemaError } from '../../src/llm/llm.errors';
import type { AltLlmRoute } from '../../src/llm/llm.provider';
import type { ProviderConfig } from '../../src/llm/providers/provider.config';
import type { TokenUsageService } from '../../src/llm/token-usage.service';
import { FakeLlmProvider } from '../fakes/fake-llm.provider';
import { GROQ_TEST_CONFIG } from './helpers/make-llm-service';

// Yedek saglayici (ADR-0007 R1): birincil ULASILAMAZ oldugunda ayni cagri BIR
// kez yedekte tekrarlanir. Operasyon ayrimi YOKTUR — sart hatadir, cagrinin
// turu degil.
//
// Kritik nokta: cagriyi yapan saglayici ile MALIYETI yazilan saglayici ayni
// olmali. Ayrisirsa token bir saglayicidan, fiyat digerinden gelir ve admin
// panelindeki tutar sessizce yanlis olur — bu yuzden asagida ikisi birlikte
// dogrulanir.
const DEEPSEEK_TEST_CONFIG: ProviderConfig = {
  name: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: 'alt-key',
  model: 'deepseek-v4-flash',
  schemaDelivery: 'json_object_prompt',
  pricing: { inputPerMillionUsd: 0.14, outputPerMillionUsd: 0.28 },
  reasoningTokenBudget: 8192,
};

const schema = z.object({ ok: z.boolean() });

function makeService(withAlt: boolean) {
  const primary = new FakeLlmProvider(
    GROQ_TEST_CONFIG.name,
    GROQ_TEST_CONFIG.model,
  );
  const alt = new FakeLlmProvider(
    DEEPSEEK_TEST_CONFIG.name,
    DEEPSEEK_TEST_CONFIG.model,
  );
  primary.always({ content: { ok: true } });
  alt.always({ content: { ok: true } });

  const usage = { record: jest.fn().mockResolvedValue(undefined) };
  const configService = {
    get: (_key: string, fallback: number) => fallback,
  } as unknown as ConfigService;

  const route: AltLlmRoute | null = withAlt
    ? { provider: alt, config: DEEPSEEK_TEST_CONFIG }
    : null;

  const service = new LlmService(
    primary,
    GROQ_TEST_CONFIG,
    usage as unknown as TokenUsageService,
    configService,
    route,
  );
  return { service, primary, alt, usage };
}

function call(service: LlmService, operation = 'question_generation') {
  return service.generateStructured({
    schema,
    schemaName: 'probe',
    systemPrompt: 'sistem',
    userData: 'veri',
    operation: operation as never,
    userId: 'u1',
  });
}

describe('yedek saglayiciya gecis', () => {
  it('birincil calisirken yedege HIC gidilmez', async () => {
    const { service, primary, alt, usage } = makeService(true);

    await call(service);

    expect(primary.calls).toHaveLength(1);
    expect(alt.calls).toHaveLength(0);
    expect(usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'groq', succeeded: true }),
    );
  });

  it.each([
    'pre_assessment',
    'question_generation',
    'adaptive_evaluation',
    'interview_report',
  ])(
    'birincil dusunce operasyon (%s) ayrimi olmadan yedek devralir',
    async (operation) => {
      const { service, primary, alt, usage } = makeService(true);
      primary.always({ error: new LlmProviderError() });

      await expect(call(service, operation)).resolves.toEqual({ ok: true });

      expect(primary.calls).toHaveLength(1);
      expect(alt.calls).toHaveLength(1);
      // Maliyet, cagriyi FIILEN yapan saglayicinin fiyatiyla yazilir.
      expect(usage.record).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'deepseek',
          pricing: DEEPSEEK_TEST_CONFIG.pricing,
          succeeded: true,
        }),
      );
    },
  );

  it('basarisiz birincil denemesi de TokenUsage olarak yazilir (maliyet takibinde bosluk yok)', async () => {
    const { service, primary, usage } = makeService(true);
    primary.always({ error: new LlmProviderError() });

    await call(service);

    expect(usage.record).toHaveBeenCalledTimes(2);
    expect(usage.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ provider: 'groq', succeeded: false }),
    );
    expect(usage.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ provider: 'deepseek', succeeded: true }),
    );
  });

  it('yedek de duserse hata cagirana gider, ucuncu deneme YOK', async () => {
    const { service, primary, alt } = makeService(true);
    primary.always({ error: new LlmProviderError() });
    alt.always({ error: new LlmProviderError() });

    await expect(call(service)).rejects.toBeInstanceOf(LlmProviderError);

    expect(primary.calls).toHaveLength(1);
    expect(alt.calls).toHaveLength(1);
  });

  it('SEMA hatasinda yedege GECILMEZ — saglayici ayakta, yanit bozuk (3.4)', async () => {
    const { service, primary, alt } = makeService(true);
    primary.always({ rawContent: '{"ok":"evet-degil-boolean"}' });

    await expect(call(service)).rejects.toBeInstanceOf(LlmSchemaError);

    expect(primary.calls).toHaveLength(1);
    expect(alt.calls).toHaveLength(0);
  });

  it('yedek yapilandirilmamissa (null) hata dogrudan cagirana gider', async () => {
    const { service, primary } = makeService(false);
    primary.always({ error: new LlmProviderError() });

    await expect(call(service)).rejects.toBeInstanceOf(LlmProviderError);

    expect(primary.calls).toHaveLength(1);
  });
});
