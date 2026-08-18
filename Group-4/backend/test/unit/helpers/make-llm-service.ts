import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../../src/llm/llm.service';
import type { ProviderConfig } from '../../../src/llm/providers/provider.config';
import type { TokenUsageService } from '../../../src/llm/token-usage.service';
import { FakeLlmProvider } from '../../fakes/fake-llm.provider';

// Birim testler icin LlmService kurulumu: saglayici port sinirinda fake,
// TokenUsageService jest mock'u. DB ve ag YOK.

export const GROQ_TEST_CONFIG: ProviderConfig = {
  name: 'groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  apiKey: 'test-key',
  model: 'openai/gpt-oss-120b',
  schemaDelivery: 'json_schema_strict',
  pricing: { inputPerMillionUsd: 0, outputPerMillionUsd: 0 },
  // provider.config.ts REASONING_TOKEN_BUDGET.groq ile ayni: Groq'un secili
  // modelleri reasoning_content uretmiyor, dusunme payi gerekmiyor.
  reasoningTokenBudget: 0,
};

export function makeLlmService(config: ProviderConfig = GROQ_TEST_CONFIG) {
  const fake = new FakeLlmProvider(config.name, config.model);
  const usage = { record: jest.fn().mockResolvedValue(undefined) };
  const configService = {
    get: (_key: string, fallback: number) => fallback,
  } as unknown as ConfigService;

  const service = new LlmService(
    fake,
    config,
    usage as unknown as TokenUsageService,
    configService,
  );

  return { service, fake, usage, config };
}
