// DOSYA REHBERİ: Groq/DeepSeek arasındaki farkın (adres, fiyat, JSON formatı
// isteme şekli) sadece veri olarak tutulduğu dosya; iki ayrı sınıf yazmak
// yerine tek adaptörü farklı ayarlarla besliyoruz. Token başına maliyet
// hesaplama fonksiyonu da burada.
// Saglayici yapilandirmasi — ADR-0007.
// Saglayici farki YAPILANDIRMA VERISIDIR, ayri sinif degil: tek OpenAI-uyumlu
// adapter, degisen yalnizca baseURL / apiKey / model ve SEMA ILETIM BICIMI.

export const PROVIDER_CONFIG = Symbol('PROVIDER_CONFIG');

export type ProviderName = 'groq' | 'deepseek';

export type SchemaDelivery =
  /** Groq: response_format json_schema + strict -> constrained decoding. */
  | 'json_schema_strict'
  /** DeepSeek: yalnizca json_object; sema prompt'a metin olarak gomulur (R2). */
  | 'json_object_prompt';

export interface ProviderPricing {
  /**
   * 1M token basina USD liste fiyati. NOT: Groq ucretsiz katmanda GERCEK
   * harcama $0'dir (ADR-0007 / R1); ancak token/maliyet raporlamasi (FR-010)
   * anlamli bir rakam gostersin diye burada saglayicinin LISTE fiyati tutulur
   * -> admin panelindeki "tahmini maliyet" gercek liste fiyatina gore hesaplanir.
   */
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

export interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  model: string;
  schemaDelivery: SchemaDelivery;
  pricing: ProviderPricing;
  /**
   * Akil yurutme (reasoning) modellerinde `max_tokens`, `reasoning_content` ve
   * `content` toplamini sinirlar. Cagiran katmanlar tavani yalnizca GORUNUR
   * cikti icin hesapliyor (ornegin 800 + N*400); dusunme payi eklenmezse model
   * butcesini dusunmeye harcar, `content` BOS doner ve `finish_reason=length`
   * olur — hata sema hatasi gibi gorunur. Olculdu (2026-08-10, deepseek-v4-flash):
   * adaptive_evaluation 4096 tavanda bos govde dondu.
   */
  reasoningTokenBudget: number;
}

const SCHEMA_DELIVERY: Record<ProviderName, SchemaDelivery> = {
  groq: 'json_schema_strict',
  deepseek: 'json_object_prompt',
};

// ADR-0007 (fiyat notu): LISTE fiyatlari per 1M token.
// - Groq gpt-oss-120b: $0.15 girdi / $0.75 cikti (ucretsiz katmanda gercek
//   harcama $0'dir; bu rakam FR-010 maliyet raporlamasinin anlamli olmasi
//   icin liste fiyatidir).
// - DeepSeek V4 Flash: $0.14 girdi / $0.28 cikti.
// Iki saglayici, iki sabit -> ayri bir pricing.ts dosyasi gerekmez.
const PRICING: Record<ProviderName, ProviderPricing> = {
  groq: { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.75 },
  deepseek: { inputPerMillionUsd: 0.14, outputPerMillionUsd: 0.28 },
};

// Deger OLCUMLE secildi (2026-08-10, deepseek-v4-flash, TokenUsage kayitlari):
// basarili cagrilar 7051 (adaptive) ve 7571 (report) cikti tokeni harcadi;
// question_generation 8096 tavanini tamamen yiyip kesildi. Yani dusunme payi
// tek basina ~4000'i asiyor. 8192 bu olcumun ustunde belirgin bir marj birakir.
// Saglayici 32768'e kadar kabul ediyor (elle dogrulandi), yani tavan degil biz
// sinirliyorduk. max_tokens bir UST SINIR: ucret uretilen token uzerinden
// alinir, comert vermek bos yere para harcamaz.
//
// ponytail: tek sabit, cagri turune gore olceklenmiyor. Asil bedel para degil
// SURE — model paya kadar dusunurse istek 60 sn timeout'una yaklasir. Yine
// yetmezse cozum payi buyutmek degil, akil yurutmeyen bir modele gecmektir
// (LLM_PROVIDER=groq: reasoning'i cikti butcesinden ayri sayar, bu yuzden 0).
const REASONING_TOKEN_BUDGET: Record<ProviderName, number> = {
  groq: 0,
  deepseek: 8192,
};

export interface LlmEnv {
  LLM_PROVIDER: ProviderName;
  LLM_BASE_URL: string;
  LLM_API_KEY: string;
  LLM_MODEL: string;
}

export function buildProviderConfig(env: LlmEnv): ProviderConfig {
  return {
    name: env.LLM_PROVIDER,
    baseUrl: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
    schemaDelivery: SCHEMA_DELIVERY[env.LLM_PROVIDER],
    pricing: PRICING[env.LLM_PROVIDER],
    reasoningTokenBudget: REASONING_TOKEN_BUDGET[env.LLM_PROVIDER],
  };
}

export function estimateCostUsd(
  pricing: ProviderPricing,
  inputTokens: number,
  outputTokens: number,
): number {
  return (
    (inputTokens * pricing.inputPerMillionUsd) / 1_000_000 +
    (outputTokens * pricing.outputPerMillionUsd) / 1_000_000
  );
}
