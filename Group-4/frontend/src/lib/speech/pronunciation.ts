// Telaffuz normalizasyonu — FR-035, ADR-0010.
//
// Tarayici TTS'i metni harfi harfine okur, ANLAM ARAMAZ: "C#" -> "C kare",
// ".NET" -> "nokta net", "CI/CD" -> "C I bolu C D. Sunucuda ses islemedigimiz
// icin (ADR-0010) kaliteyi yukseltecek tek yer, metni SESE VERMEDEN ONCE
// duzeltmek.
//
// Iki tur duzeltme var:
//   1) Sozluk — bilinen terimin fonetik karsiligi ("C#" -> "si sarp").
//   2) Genel kural — sembol/sayi kaliplari ("%50" -> "yuzde 50", "3-5" -> "3 ila 5").
//
// Sozluk MESLEK-BAGIMSIZ olmak zorunda (FR-029): ilan insaat, saglik veya
// lojistik olabilir, yalnizca yazilim terimleri yetmez.
//
// Cok heceli Ingilizce kelimeler burada DEGIL: onlarin fonetik yazimi tahmin
// olur, Ingilizce sese devredilirler — bkz. segment.ts ENGLISH_VOICE_TERMS.

export interface PronunciationEntry {
  /** Metinde arananan terim; buyuk/kucuk harf duyarsiz eslesir. */
  term: string
  /** Turkce seslendirmede okunacak fonetik karsilik. null: dokunma. */
  tr: string | null
  /** Ingilizce seslendirmede okunacak karsilik. null: dokunma. */
  en: string | null
}

// null = "o dilin sesi bu terimi zaten dogru okuyor, karistirma". Ornegin
// "React" Ingilizce seste dogru okunur, Turkce seste hecelenir.
export const PRONUNCIATION_LEXICON: PronunciationEntry[] = [
  // --- Semboller: her iki dilde de yanlis okunur ---
  { term: 'C#', tr: 'si şarp', en: 'C sharp' },
  { term: 'C++', tr: 'si plas plas', en: 'C plus plus' },
  { term: 'F#', tr: 'ef şarp', en: 'F sharp' },
  { term: 'ASP.NET', tr: 'ey es pi dot net', en: 'A S P dot net' },
  { term: '.NET', tr: 'dot net', en: 'dot net' },
  { term: 'Node.js', tr: 'nod cey es', en: 'node J S' },
  { term: 'Next.js', tr: 'nekst cey es', en: 'next J S' },
  { term: 'Vue.js', tr: 'vyu cey es', en: 'view J S' },
  { term: 'CI/CD', tr: 'si ay si di', en: 'C I C D' },
  { term: 'UI/UX', tr: 'yu ay yu eks', en: 'U I U X' },
  { term: '7/24', tr: 'yedi yirmi dört', en: 'twenty four seven' },
  { term: 'm²', tr: 'metrekare', en: 'square meters' },
  { term: 'm³', tr: 'metreküp', en: 'cubic meters' },
  { term: 'kWh', tr: 'kilovat saat', en: 'kilowatt hours' },

  // --- Kisaltmalar: Turkce seste harf harf okunmali ---
  { term: 'SQL', tr: 'es ki el', en: null },
  { term: 'MySQL', tr: 'may es ki el', en: null },
  { term: 'PostgreSQL', tr: 'postgres ki el', en: null },
  { term: 'NoSQL', tr: 'no es ki el', en: null },
  { term: 'GraphQL', tr: 'graf ki el', en: null },
  { term: 'MongoDB', tr: 'mongo di bi', en: null },
  { term: 'API', tr: 'ey pi ay', en: null },
  { term: 'JSON', tr: 'cey son', en: null },
  { term: 'XML', tr: 'iks em el', en: null },
  { term: 'HTML', tr: 'eyç ti em el', en: null },
  { term: 'CSS', tr: 'si es es', en: null },
  { term: 'HTTPS', tr: 'eyç ti ti pi es', en: null },
  { term: 'HTTP', tr: 'eyç ti ti pi', en: null },
  { term: 'JWT', tr: 'cey dablyu ti', en: null },
  { term: 'AWS', tr: 'ey dablyu es', en: null },
  { term: 'GCP', tr: 'ci si pi', en: null },
  { term: 'IDE', tr: 'ay di i', en: null },
  { term: 'UI', tr: 'yu ay', en: null },
  { term: 'UX', tr: 'yu eks', en: null },
  { term: 'AI', tr: 'ey ay', en: null },
  { term: 'ML', tr: 'em el', en: null },
  { term: 'LLM', tr: 'el el em', en: null },
  { term: 'OOP', tr: 'o o pi', en: null },
  { term: 'MVC', tr: 'em vi si', en: null },
  { term: 'ORM', tr: 'o ar em', en: null },
  { term: 'TDD', tr: 'ti di di', en: null },
  { term: 'QA', tr: 'kiyu ey', en: null },
  { term: 'iOS', tr: 'ay o es', en: null },

  // --- Kelimeler: Turkce ses fonetigi bozar ---
  { term: 'JavaScript', tr: 'cavaskript', en: null },
  { term: 'TypeScript', tr: 'tayp skript', en: null },
  { term: 'React', tr: 'riakt', en: null },
  { term: 'Angular', tr: 'engılar', en: null },
  { term: 'Vue', tr: 'vyu', en: null },
  { term: 'Java', tr: 'cava', en: null },
  { term: 'Python', tr: 'paytın', en: null },
  { term: 'PHP', tr: 'pe he pe', en: null },
  { term: 'Swift', tr: 'suift', en: null },
  { term: 'Ruby', tr: 'rubi', en: null },
  { term: 'Docker', tr: 'dokır', en: null },
  { term: 'Kubernetes', tr: 'kubırnetis', en: null },
  { term: 'Linux', tr: 'linuks', en: null },
  { term: 'GitHub', tr: 'githab', en: null },
  { term: 'GitLab', tr: 'gitleb', en: null },
  { term: 'Azure', tr: 'ejur', en: null },
  { term: 'OAuth', tr: 'o ot', en: null },
  { term: 'DevOps', tr: 'dev ops', en: null },
  { term: 'SaaS', tr: 'sas', en: null },
  { term: 'Android', tr: 'androyd', en: null },
  { term: 'Scrum', tr: 'skrım', en: null },
  { term: 'Agile', tr: 'ecayl', en: null },
  { term: 'backend', tr: 'bekend', en: null },
  { term: 'frontend', tr: 'front end', en: null },
  { term: 'fullstack', tr: 'fulstek', en: null },
  { term: 'full-stack', tr: 'fulstek', en: null },
  { term: 'cloud', tr: 'klaud', en: null },
  { term: 'debug', tr: 'dibag', en: null },

  // --- Meslek-bagimsiz is/uretim terimleri (FR-029) ---
  { term: 'KPI', tr: 'key pi ay', en: null },
  { term: 'OKR', tr: 'o key ar', en: null },
  { term: 'CRM', tr: 'si ar em', en: null },
  { term: 'ERP', tr: 'i ar pi', en: null },
  { term: 'ROI', tr: 'ar o ay', en: null },
  { term: 'MBA', tr: 'em bi ey', en: null },
  { term: 'HR', tr: 'eyç ar', en: null },
  { term: 'B2B', tr: 'bi tu bi', en: null },
  { term: 'B2C', tr: 'bi tu si', en: null },
  { term: 'ISO', tr: 'izo', en: null },
  { term: 'CNC', tr: 'si en si', en: null },
  { term: 'EKG', tr: 'e ka ge', en: null },
  { term: 'PDF', tr: 'pe de ef', en: null },
  { term: 'CV', tr: 'si vi', en: null },
  { term: 'Excel', tr: 'eksel', en: null },
  { term: 'Ar-Ge', tr: 'arge', en: null },
]

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Terim sinirlari \b ile kurulamaz: "C#" sonunda, ".NET" basinda kelime
// karakteri YOK. Bunun yerine "iki yaninda harf/rakam olmasin" kurali.
// Turkce ekler apostrofla gelir ("React'i") — apostrof harf olmadigi icin
// eslesme calisir, ek metinde kalir.
const BOUNDARY_BEFORE = '(?<![\\p{L}\\p{N}])'
const BOUNDARY_AFTER = '(?![\\p{L}\\p{N}])'

// TEK gecis: alternatifler UZUNDAN KISAYA siralanir, boylece "C++" "C"den,
// "ASP.NET" ".NET"ten, "MySQL" "SQL"den once eslesir. Tek gecis ayni zamanda
// bir terimin karsiliginin baska bir terim olarak yeniden eslesmesini onler.
const sortedEntries = [...PRONUNCIATION_LEXICON].sort(
  (a, b) => b.term.length - a.term.length,
)

const lexiconPattern = new RegExp(
  `${BOUNDARY_BEFORE}(?:${sortedEntries.map((e) => escapeRegExp(e.term)).join('|')})${BOUNDARY_AFTER}`,
  'giu',
)

const entryByTerm = new Map(
  sortedEntries.map((entry) => [entry.term.toLowerCase(), entry]),
)

/** Sozluk eslesmelerini uygular; sozlukte olmayan metin AYNEN kalir. */
export function applyLexicon(text: string, language: 'tr' | 'en'): string {
  return text.replace(lexiconPattern, (match) => {
    const entry = entryByTerm.get(match.toLowerCase())
    if (!entry) return match
    return entry[language] ?? match
  })
}

interface GeneralRule {
  pattern: RegExp
  replacement: string
}

// Sozlukten SONRA calisir: "CI/CD" once "si ay si di" olur, boylece bolu
// kurali ona dokunmaz.
const GENERAL_RULES: Record<'tr' | 'en', GeneralRule[]> = {
  tr: [
    // "%50" -> "yuzde 50" (Turkce isaret onde yazilir, TTS ters okur).
    { pattern: /%\s*(\d+(?:[.,]\d+)?)/g, replacement: 'yüzde $1' },
    // "3-5 yil" -> "3 ila 5 yil". Tarih/uzun sayi dizisi haric tutulur.
    { pattern: /(?<![\d.\-/])(\d{1,2})\s*[-–]\s*(\d{1,2})(?![\d.\-/])/g, replacement: '$1 ila $2' },
    { pattern: /(\d+)\s*\+/g, replacement: '$1 artı' },
    { pattern: /\s*&\s*/g, replacement: ' ve ' },
    // Kelimeler arasi bolu isareti "bolu" diye okunur; kisa duraklama daha dogal.
    { pattern: /(\p{L})\s*\/\s*(\p{L})/gu, replacement: '$1, $2' },
  ],
  en: [
    { pattern: /(\d+(?:[.,]\d+)?)\s*%/g, replacement: '$1 percent' },
    { pattern: /%\s*(\d+(?:[.,]\d+)?)/g, replacement: '$1 percent' },
    { pattern: /(?<![\d.\-/])(\d{1,2})\s*[-–]\s*(\d{1,2})(?![\d.\-/])/g, replacement: '$1 to $2' },
    { pattern: /(\d+)\s*\+/g, replacement: '$1 plus' },
    { pattern: /\s*&\s*/g, replacement: ' and ' },
    { pattern: /(\p{L})\s*\/\s*(\p{L})/gu, replacement: '$1, $2' },
  ],
}

/**
 * Metni sese vermeden once okunabilir hale getirir (FR-035).
 * Sozlukte olmayan terim hata uretmez — metin oldugu gibi okunur.
 */
export function normalizeForSpeech(text: string, language: 'tr' | 'en'): string {
  let result = applyLexicon(text, language)
  for (const rule of GENERAL_RULES[language]) {
    result = result.replace(rule.pattern, rule.replacement)
  }
  // Bosluk sadelestirme: TTS coklu boslugu duraklama sanip tokezleyebilir.
  return result.replace(/\s+/g, ' ').trim()
}
