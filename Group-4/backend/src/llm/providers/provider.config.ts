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
  /**
   * Saglayici onbelleginden karsilanan girdi tokeninin 1M basina USD fiyati
   * (prompt caching indirimi). Tanimsiz = "indirim bilinmiyor": onbellekli
   * token da tam girdi fiyatindan hesaplanir, yani maliyet OLDUGUNDAN YUKSEK
   * cikar, asla dusuk cikmaz.
   *
   * Her iki saglayici icin de resmi fiyat sayfasindan dogrulanarak dolduruldu
   * (2026-08-21, asagidaki PRICING sabitine bakin). Yeni bir saglayici
   * eklenirken tahmini rakam YAZILMAZ: bilinmiyorsa bos birakilir, cunku
   * uydurulan bir indirim admin panelindeki tutari sessizce yanlis gosterir.
   */
  cachedInputPerMillionUsd?: number;
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
// Kaynaklar resmi fiyat sayfalarindan dogrulandi (2026-08-21):
//   console.groq.com/docs/prompt-caching · api-docs.deepseek.com/quick_start/pricing
//
// - Groq gpt-oss-120b: $0.15 girdi / $0.75 cikti; onbellekten karsilanan girdi
//   %50 indirimli -> $0.075. (Ucretsiz katmanda gercek harcama $0'dir; bu rakam
//   FR-010 maliyet raporlamasinin anlamli olmasi icin liste fiyatidir.)
//
// - DeepSeek V4 Flash: eski $0.14/$0.28 rakamlari ARTIK GECERSIZ. Saglayici
//   2026-08-16'da zirve/zirve-disi fiyatlandirmaya gecti (zirve: 01:00-04:00 ve
//   06:00-10:00 UTC; zirve disi tam yarisi):
//       cache miss girdi  $0.44 zirve / $0.22 zirve disi
//       cache hit  girdi  $0.014 zirve / $0.007 zirve disi
//       cikti             $1.32 zirve / $0.66 zirve disi
//   Burada ZIRVE fiyati tutulur: tek sabit iki tarifeyi ayni anda dogru
//   gosteremez, ve bu dosyanin kurali maliyetin olabildigince yuksek gorunmesi
//   (asla dusuk cikmamasi) yonundedir. Zirve disinde tahmin gercek tutarin iki
//   kati cikar.
//   ponytail: saatten bagimsiz tek tarife. DeepSeek YEDEK saglayicidir
//   (LLM_ALT_*, varsayilan olarak kapali), yani bu sapma nadir yolda olusur.
//   Birincil saglayici yapilirsa cozum, UTC saatine bakip zirve/zirve-disi
//   secen bir fonksiyondur.
// Iki saglayici, iki sabit -> ayri bir pricing.ts dosyasi gerekmez.
const PRICING: Record<ProviderName, ProviderPricing> = {
  groq: {
    inputPerMillionUsd: 0.15,
    outputPerMillionUsd: 0.75,
    cachedInputPerMillionUsd: 0.075,
  },
  deepseek: {
    inputPerMillionUsd: 0.44,
    outputPerMillionUsd: 1.32,
    cachedInputPerMillionUsd: 0.014,
  },
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

// cachedInputTokens, inputTokens'in ALT KUMESIDIR (saglayici prompt_tokens'i
// onbellekli + onbelleksiz TOPLAMI olarak bildirir). Bu yuzden once ayrilir:
// onbellekten gelen kisim indirimli, kalani tam fiyattan hesaplanir. Ayrilma
// yapilmazsa ayni token iki kez faturalanmis gorunur.
export function estimateCostUsd(
  pricing: ProviderPricing,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens = 0,
): number {
  // Savunma: saglayici tutarsiz sayi bildirirse (cached > input) negatif
  // fiyatlandirilmis token uretmeyelim.
  const cached = Math.min(Math.max(cachedInputTokens, 0), inputTokens);
  const uncached = inputTokens - cached;
  const cachedPrice =
    pricing.cachedInputPerMillionUsd ?? pricing.inputPerMillionUsd;

  return (
    (uncached * pricing.inputPerMillionUsd) / 1_000_000 +
    (cached * cachedPrice) / 1_000_000 +
    (outputTokens * pricing.outputPerMillionUsd) / 1_000_000
  );
}
