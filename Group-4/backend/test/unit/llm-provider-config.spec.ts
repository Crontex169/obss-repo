import type { LlmCallArgs } from '../../src/llm/llm.provider';
import { buildChatRequest } from '../../src/llm/providers/openai-compatible.provider';
import { buildProviderConfig } from '../../src/llm/providers/provider.config';

// T024 — Cift saglayici adapter (ADR-0007, docs/API_CONVENTIONS.md 3.3).
// Saglayici farki YAPILANDIRMA VERISI: tek adapter, degisen sema iletim bicimi.
describe('saglayici sema iletim bicimi', () => {
  const jsonSchema = {
    type: 'object',
    properties: { position: { type: 'string' } },
    required: ['position'],
    additionalProperties: false,
  };
  const args: LlmCallArgs = {
    jsonSchema,
    schemaName: 'question_generation',
    systemPrompt: 'Sen bir mulakat asistanisin.',
    userData: 'IS ILANI METNI',
    timeoutMs: 30_000,
    maxTokens: 4096,
  };

  const groq = buildProviderConfig({
    LLM_PROVIDER: 'groq',
    LLM_BASE_URL: 'https://api.groq.com/openai/v1',
    LLM_API_KEY: 'k',
    LLM_MODEL: 'openai/gpt-oss-120b',
  });
  const deepseek = buildProviderConfig({
    LLM_PROVIDER: 'deepseek',
    LLM_BASE_URL: 'https://api.deepseek.com/v1',
    LLM_API_KEY: 'k',
    LLM_MODEL: 'deepseek-chat',
  });

  it('groq: json_schema + strict: true (constrained decoding)', () => {
    const req = buildChatRequest(groq, args);
    expect(req.response_format).toEqual({
      type: 'json_schema',
      json_schema: {
        name: 'question_generation',
        strict: true,
        schema: jsonSchema,
      },
    });
  });

  it('groq: sema prompt a GOMULMEZ — saglayici zaten garanti veriyor', () => {
    const req = buildChatRequest(groq, args);
    expect(req.messages[0].content).toBe(args.systemPrompt);
  });

  it('deepseek: json_object + sema prompt a gomulur (R2)', () => {
    const req = buildChatRequest(deepseek, args);
    expect(req.response_format).toEqual({ type: 'json_object' });

    const system = req.messages[0].content as string;
    expect(system).toContain(args.systemPrompt);
    expect(system).toContain(JSON.stringify(jsonSchema));
    // DeepSeek json_object modu sistem talimatinda "json" kelimesini sart kosar.
    expect(system.toLowerCase()).toContain('json');
  });

  it('kullanici verisi AYRI mesaj rolunde gider — talimatla birlestirilmez (5)', () => {
    for (const config of [groq, deepseek]) {
      const req = buildChatRequest(config, args);
      expect(req.messages).toHaveLength(2);
      expect(req.messages[0].role).toBe('system');
      expect(req.messages[1]).toEqual({ role: 'user', content: args.userData });
      expect(req.messages[0].content).not.toContain(args.userData);
    }
  });

  // Fiyatlar resmi sayfalardan dogrulanmis sabitlerdir (2026-08-21). Test
  // rakamlari EZBERLEMEK icin degil, sessizce kaymalarini engellemek icin var:
  // fiyat guncellenirken bu satir da guncellenmek zorunda kalir.
  it('maliyet: her iki saglayicinin liste + onbellek fiyatlari sabitlenmistir', () => {
    expect(groq.pricing).toEqual({
      inputPerMillionUsd: 0.15,
      outputPerMillionUsd: 0.75,
      cachedInputPerMillionUsd: 0.075, // %50 indirim (console.groq.com/docs/prompt-caching)
    });
    expect(deepseek.pricing).toEqual({
      inputPerMillionUsd: 0.44, // V4 Flash zirve tarifesi; zirve disi yarisi
      outputPerMillionUsd: 1.32,
      cachedInputPerMillionUsd: 0.014,
    });
  });

  // Onbellekli girdi HER ZAMAN normal girdiden ucuz olmalidir; tersi bir deger
  // yazilirsa "indirim" maliyeti artirirdi ve kimse fark etmezdi.
  it('onbellekli girdi fiyati normal girdiden dusuktur', () => {
    for (const config of [groq, deepseek]) {
      expect(config.pricing.cachedInputPerMillionUsd).toBeLessThan(
        config.pricing.inputPerMillionUsd,
      );
    }
  });

  it('model ve baseUrl yapilandirmadan gelir — kodda gomulu degil', () => {
    expect(buildChatRequest(groq, args).model).toBe('openai/gpt-oss-120b');
    expect(buildChatRequest(deepseek, args).model).toBe('deepseek-chat');
    expect(deepseek.baseUrl).toBe('https://api.deepseek.com/v1');
  });

  // Akil yurutme modelinde max_tokens reasoning_content + content toplamini
  // sinirlar. Pay eklenmezse model butceyi dusunmeye harcar, content BOS doner
  // ve finish_reason=length olur — hata sema hatasi gibi gorunur (olculdu:
  // 2026-08-10, deepseek-v4-flash, adaptive_evaluation).
  it('deepseek tavanina dusunme payi eklenir, groq tavani degismez', () => {
    expect(buildChatRequest(deepseek, args).max_tokens).toBe(4096 + 8192);
    expect(buildChatRequest(groq, args).max_tokens).toBe(4096);
  });
});
