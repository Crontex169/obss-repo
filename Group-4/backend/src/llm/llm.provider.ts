// DOSYA REHBERİ: Gerçek LLM sağlayıcısının (Groq, DeepSeek vb.) uyması
// gereken "sözleşmeyi" (arayüz) tanımlar — bir elektrik prizinin şekli gibi
// düşün, hangi cihaz takılırsa takılsın uyacak şekil bellidir. Testlerde de
// sahte bir sağlayıcı bu şekle uydurularak gerçek API'ye hiç gidilmez.
import type { ProviderConfig } from './providers/provider.config';
import type { ProviderJsonSchema } from './schema-to-provider';

// Saglayici-bagimsiz port. Test fake'i (test/fakes/fake-llm.provider.ts) TAM BU
// sinirdan takilir — gercek saglayiciya istek atan test YAZILMAZ (plan.md).
//
// Bu dosya domain BILMEZ: soru/rapor/on degerlendirme kavramlari burada gecmez.

export interface LlmCallArgs {
  /** Katman-1 sema (toProviderSchema ciktisi). */
  jsonSchema: ProviderJsonSchema;
  /** Sema adi — saglayici json_schema modunda zorunlu. */
  schemaName: string;
  /** Sistem talimati. Kullanici verisi ile ASLA birlestirilmez (5). */
  systemPrompt: string;
  /** Kullanici verisi — daima veri, asla talimat (5). */
  userData: string;
  timeoutMs: number;
  /**
   * Sabit varsayilan tavan `strict` modda YARIM JSON'u KESER (T125): N=20 soru
   * uretiminde ~5600 output token bekleniyor, varsayilan altinda cagri komple
   * `400` doner. Cagiran katman (buildQuestionGenerationSchema cagrisi gibi)
   * ictigi cikti hacmine gore olcekler.
   */
  maxTokens: number;
  /**
   * Ornekleme sicakligi. Verilmezse saglayici varsayilani (genellikle 1.0)
   * kullanilir — bu, PUANLAMA yapan cagrilarda kararsizlik demektir: ayni
   * mulakat iki kez raporlandiginda farkli skor cikar. Deger cagiran katmanda
   * durur cunku dogru sicaklik cagriya gore degisir:
   *   - soru uretimi: cesitlilik istenir (yuksek)
   *   - uyarlama: dengeli (orta)
   *   - rapor/degerlendirme: tekrarlanabilirlik sart (0'a yakin)
   */
  temperature?: number;
}

export interface LlmCallResult {
  /** Saglayicidan donen ham JSON metni; dogrulama LlmService'te (katman 2). */
  content: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * inputTokens'in saglayici onbelleginden (prompt caching) KARSILANAN kismi.
   * ALT KUMEDIR, inputTokens'a EKLENMEZ. Saglayici bildirmezse 0.
   *
   * Bizim prompt'umuz onbellege cok uygun: sistem talimati (DeepSeek yolunda
   * artı JSON semasi) her cagrida byte-byte ayni onektir, degisen yalnizca
   * sondaki kullanici verisidir. Saglayici bu oneki kendiliginden onbellekler
   * ve ucuz fiyatlar; olculmezse hem tasarruf gorunmez hem maliyet raporu
   * oldugundan yuksek cikar.
   */
  cachedInputTokens: number;
  provider: string;
  model: string;
}

export interface LlmProvider {
  call(args: LlmCallArgs): Promise<LlmCallResult>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

// --- Yedek saglayici (opsiyonel) — ADR-0007 R1 ---
//
// Birincil saglayici cevap veremezse (kota doldu, 5xx, ag hatasi, timeout)
// ayni cagri BIR kez burada tekrarlanir. Operasyon ayrimi YOKTUR: yedek
// devreye girme sarti hatadir, cagrinin turu degil.
//
// TEK token: saglayici ve yapilandirmasi birlikte gelir, cunku ikisi de ayni
// karara aittir; ayri enjekte edilirse birinin digerinden habersiz degismesi
// mumkun olur (fiyat tablosu yanlis saglayiciya yazilir).
//
// Yapilandirilmazsa `null` enjekte edilir ve davranis DEGISMEZ: birincil
// duserse hata dogrudan cagirana gider.
export const ALT_LLM_ROUTE = Symbol('ALT_LLM_ROUTE');

export interface AltLlmRoute {
  provider: LlmProvider;
  config: ProviderConfig;
}
