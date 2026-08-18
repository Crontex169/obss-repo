// Dil segmentasyonu ve cumle parcalama — FR-035, FR-036.
//
// DIL SEGMENTASYONU
// Turkce cumle icindeki Ingilizce kelimeyi Turkce ses hecelemeye calisir.
// Iki care var: (a) fonetik yazim ("React" -> "riakt"), (b) o parcayi
// Ingilizce sese devretmek.
//
// (a) kisa ve yerlesmis terimlerde daha akici — tek ses, duraklama yok; bu
// yuzden sozlugun varsayilani odur. Ama cok heceli Ingilizce kelimelerde
// fonetik yazim guvenilmez ("deployment" -> "diploymint" tahmindir). Orada
// (b) daha dogru sonuc verir.
//
// Hangi terimin hangi yola gidecegi VERIDIR, tahmin DEGILDIR: asagidaki liste.
// Metinden "bu kisim Ingilizce mi" diye sezgisel cikarim YAPILMAZ — Turkce
// kelimelerin cogu da Ingilizce imlasina uyar ("test", "problem", "proje"),
// sezgisel bir dedektor Turkce metni bozardi.
//
// CUMLE PARCALAMA
// Chrome'un SpeechSynthesis'i uzun metinde sessizce susuyor (~200-300 karakter
// / ~15 saniye). Uzun soru YARIDA KESILIR — sessiz basarisizlik. Metin cumle
// sinirlarindan parcalanip siraya alinir (FR-036, kriter 4).

import { normalizeForSpeech } from './pronunciation'

/**
 * Turkce seslendirmede Ingilizce sese devredilen terimler.
 * Olcut: cok heceli ve fonetik Turkce yazimi guvenilir olmayan kelimeler.
 * Kisa/yerlesmis terimler (API, React, SQL) sozlukte fonetik kalir.
 */
export const ENGLISH_VOICE_TERMS: string[] = [
  'continuous integration',
  'continuous deployment',
  'machine learning',
  'pull request',
  'code review',
  'unit test',
  'design pattern',
  'clean architecture',
  'dependency injection',
  'garbage collection',
  'load balancing',
  'microservice',
  'deployment',
  'framework',
  'database',
  'scalability',
  'performance',
  'maintenance',
  'requirement',
  'stakeholder',
  'onboarding',
  'troubleshooting',
]

export interface SpeechSegment {
  /** Seslendirilecek metin (Turkce parcalar normalize edilmis halde). */
  text: string
  /** Bu parcanin hangi dilin sesiyle okunacagi. */
  lang: 'tr' | 'en'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Uzundan kisaya: "continuous deployment" tek basina "deployment"tan once.
const englishVoicePattern = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...ENGLISH_VOICE_TERMS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
)

/**
 * Metni seslendirme parcalarina ayirir (FR-035).
 * Ingilizce gorusmede bolme yapilmaz — zaten tek dil.
 */
export function segmentForSpeech(
  text: string,
  language: 'tr' | 'en',
): SpeechSegment[] {
  if (language === 'en') {
    const normalized = normalizeForSpeech(text, 'en')
    return normalized ? [{ text: normalized, lang: 'en' }] : []
  }

  const segments: SpeechSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(englishVoicePattern)) {
    const index = match.index ?? 0
    // Ingilizce terimden ONCEKI Turkce parca — normalize edilerek eklenir.
    const before = normalizeForSpeech(text.slice(cursor, index), 'tr')
    if (before) segments.push({ text: before, lang: 'tr' })
    // Ingilizce parca Ingilizce sese gider; fonetige cevrilMEZ.
    segments.push({ text: match[0], lang: 'en' })
    cursor = index + match[0].length
  }

  const rest = normalizeForSpeech(text.slice(cursor), 'tr')
  if (rest) segments.push({ text: rest, lang: 'tr' })

  return segments
}

/** Chrome'un sessizce kestigi uzunluga gore secilmis guvenli ust sinir. */
export const MAX_CHUNK_LENGTH = 180

const SENTENCE_END = /(?<=[.!?…])\s+/

function splitLongSentence(sentence: string, maxLength: number): string[] {
  if (sentence.length <= maxLength) return [sentence]

  const parts: string[] = []
  let rest = sentence
  while (rest.length > maxLength) {
    const window = rest.slice(0, maxLength)
    // Once virgul/noktali virgul, yoksa bosluk — kelime ortasindan bolme.
    const breakAt = Math.max(
      window.lastIndexOf(', '),
      window.lastIndexOf('; '),
      window.lastIndexOf(' '),
    )
    const cut = breakAt > 0 ? breakAt + 1 : maxLength
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

/**
 * Metni cumle sinirlarindan, sese verilebilecek parcalara boler (FR-036).
 * Kisa cumleler sinira kadar birlestirilir — gereksiz duraklama olmasin.
 */
export function splitIntoChunks(
  text: string,
  maxLength: number = MAX_CHUNK_LENGTH,
): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxLength) return [trimmed]

  const chunks: string[] = []
  let current = ''

  for (const sentence of trimmed.split(SENTENCE_END)) {
    for (const part of splitLongSentence(sentence.trim(), maxLength)) {
      if (!part) continue
      if (!current) {
        current = part
      } else if (`${current} ${part}`.length <= maxLength) {
        current = `${current} ${part}`
      } else {
        chunks.push(current)
        current = part
      }
    }
  }
  if (current) chunks.push(current)

  return chunks
}
