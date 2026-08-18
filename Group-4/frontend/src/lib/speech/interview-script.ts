// Mulakat diyalogu kurgusu — FR-037, FR-038.
//
// Sozlu mod bugune kadar soruyu okuyan bir hoparlordu. Gercek bir gorusmede
// once karsilama, sorular arasinda gecis, sonunda kapanis vardir.
//
// Metinlerin KAYNAGI iki turlu:
//   - Karsilama / gecis / kapanis: i18n sablonu (bedava, deterministik).
//   - Cevaba ozel replik: sunucudan gelen interviewerRemark (FR-038) — MEVCUT
//     adaptif cagriya eklenmis alan, ek maliyet yok.
//
// Replik null olabilir (adaptif akis kapali, LLM uretmedi veya cagri
// basarisiz). O zaman sablon gecisi kullanilir — akis HICBIR durumda sessiz
// kalmaz.

export interface PreQuestionSpeechArgs {
  /** Ilk soruda karsilama yapilir, gecis degil. */
  isFirstQuestion: boolean
  greeting: string
  /** FR-038: sunucudan gelen notr replik; yoksa sablona dusulur. */
  interviewerRemark: string | null
  /** Sablon gecis havuzu — tekduzelik olmasin diye birden fazla. */
  transitionPool: readonly string[]
  /** Havuzda donmek icin: rastgelelik YOK, boylece davranis ongorulebilir. */
  questionIndex: number
}

/**
 * Soru okunmadan ONCE soylenecek metinleri sirasiyla dondurur (FR-037).
 * Bos metinler ayiklanir — sentezleyiciye bos utterance gonderilmez.
 */
export function buildPreQuestionSpeech(args: PreQuestionSpeechArgs): string[] {
  const lead = args.isFirstQuestion
    ? args.greeting
    : (args.interviewerRemark?.trim() ||
      pickTransition(args.transitionPool, args.questionIndex))

  return [lead].map((text) => text?.trim() ?? '').filter(Boolean)
}

/**
 * Havuzdan sirayla secer (rastgele DEGIL): ayni gorusmede arka arkaya ayni
 * cumleyi duymamak yeterli, ongorulemezlik gerekmiyor.
 */
export function pickTransition(
  pool: readonly string[],
  questionIndex: number,
): string {
  if (pool.length === 0) return ''
  const index = Math.abs(questionIndex) % pool.length
  return pool[index] ?? ''
}
