// Ses secimi, prosodi ve seslendirme kuyrugu — FR-036, ADR-0010.
//
// Tarayici varsayilan sesi genelde sistemin en dusuk kaliteli sesidir; ayni
// dilde daha iyi bir ses kurulu olsa bile SECILMEZ. Burasi mevcut sesler
// icinden en iyisini secer, konusma hizini ayarlar ve parcalari SIRAYLA
// seslendirir.
//
// Sira YONETILIR (hepsini birden kuyruga atmak yerine teker teker): iptal
// davranisi netlesir ve onEnd TAM OLARAK BIR KEZ, gercekten bittiginde
// tetiklenir — akis makinesi (voice-controls) buna baglanacagi icin bu sart.

import { segmentForSpeech, splitIntoChunks, type SpeechSegment } from './segment'

export const BCP47: Record<'tr' | 'en', string> = {
  tr: 'tr-TR',
  en: 'en-US',
}

// Mulakat tonuna gore hafif yavas: varsayilan hiz soruyu aceleye getiriyor.
export const SPEECH_RATE = 0.95
export const SPEECH_PITCH = 1

interface VoiceLike {
  name: string
  lang: string
}

// Isimden kalite tahmini: Chrome'da "Google turkce", Edge'de "Microsoft ...
// Natural/Online" sesleri sinteze degil noral modele dayanir ve belirgin
// sekilde daha dogaldir.
const QUALITY_HINTS: { pattern: RegExp; score: number }[] = [
  { pattern: /natural|neural/i, score: 4 },
  { pattern: /google/i, score: 3 },
  { pattern: /online|premium|enhanced/i, score: 2 },
]

function normalizeLang(lang: string): string {
  return lang.replace('_', '-').toLowerCase()
}

function scoreVoice(voice: VoiceLike, language: 'tr' | 'en'): number {
  let score = 0
  for (const hint of QUALITY_HINTS) {
    if (hint.pattern.test(voice.name)) score += hint.score
  }
  // Tam yerel eslesmesi (tr-TR / en-US) bolgesel varyanttan yeglenir.
  if (normalizeLang(voice.lang) === normalizeLang(BCP47[language])) score += 1
  return score
}

/**
 * Verilen ses listesinden dile en uygun ve en kaliteli olani secer (FR-036).
 * Uygun ses yoksa null doner — cagiran tarayici varsayilanina birakir
 * (sessiz basarisizlik degil, zarif bozulma: okuma yine yapilir).
 */
export function pickVoice<T extends VoiceLike>(
  voices: readonly T[],
  language: 'tr' | 'en',
): T | null {
  const candidates = voices.filter((voice) =>
    normalizeLang(voice.lang ?? '').startsWith(language),
  )
  if (candidates.length === 0) return null

  return candidates.reduce((best, voice) =>
    scoreVoice(voice, language) > scoreVoice(best, language) ? voice : best,
  )
}

function synth(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

// Chrome ilk cagrida BOS liste doner, sesler asenkron yuklenir.
//
// Bu "sonra dolar" davranisi sessiz bir dil hatasina yol aciyordu: liste bos
// oldugu icin ILK okuma ses SECMEDEN gidiyor, tarayici da varsayilan sesi —
// yani ISLETIM SISTEMININ dilini — kullaniyordu. Turkce Windows'ta Ingilizce
// gorusmenin karsilamasi Turkce sesle okunuyordu. Bu yuzden ilk okuma artik
// ses listesini BEKLER (kisa bir ust sinirla).
let cachedVoices: SpeechSynthesisVoice[] = []

export function availableVoices(): SpeechSynthesisVoice[] {
  const speech = synth()
  if (!speech?.getVoices) return cachedVoices
  const voices = speech.getVoices()
  if (voices.length > 0) cachedVoices = voices
  return cachedVoices
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    cachedVoices = window.speechSynthesis.getVoices()
  })
}

/** Ses listesi gelmezse sonsuza kadar beklenmez — okuma yine yapilir. */
export const VOICES_READY_TIMEOUT_MS = 1500

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null

/**
 * Liste bos VE tarayici dolduguna dair haber verebiliyor mu?
 * Ikisinden biri yoksa beklemenin anlami yok — okuma hemen baslamali.
 */
function shouldWaitForVoices(): boolean {
  if (availableVoices().length > 0) return false
  const speech = synth()
  return Boolean(speech?.getVoices && speech.addEventListener)
}

/**
 * Ses listesi dolana kadar (en fazla VOICES_READY_TIMEOUT_MS) bekler.
 * Zaten doluysa ya da beklenecek kanal yoksa beklemeden cozulur.
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!shouldWaitForVoices()) return Promise.resolve(availableVoices())
  const speech = synth()
  if (!speech) return Promise.resolve([])
  if (voicesReady) return voicesReady

  voicesReady = new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      speech.removeEventListener?.('voiceschanged', finish)
      resolve(availableVoices())
    }
    speech.addEventListener?.('voiceschanged', finish)
    window.setTimeout(finish, VOICES_READY_TIMEOUT_MS)
  })
  return voicesReady
}

/**
 * O dil icin kurulu bir ses VAR MI (FR-036). Yoksa tarayici sistem
 * varsayilanini kullanir ve metni YANLIS DILIN fonetigiyle okur — cagiran
 * bunu kullaniciya soylemeli, sessizce gecmemeli (FR-025).
 */
export function hasVoiceFor(language: 'tr' | 'en'): boolean {
  return pickVoice(availableVoices(), language) !== null
}

export interface SpeechHandle {
  /** Okumayi durdurur; onEnd ARTIK tetiklenmez. */
  cancel(): void
}

export interface SpeakOptions {
  /** Tum parcalar bittiginde bir kez cagrilir (iptalde cagrilMAZ). */
  onEnd?: () => void
  /** Iptal disi bir hata olustugunda cagrilir. */
  onError?: (error: string) => void
  rate?: number
}

/** Parcalari, her biri kendi dilinin sesiyle olmak uzere sirayla okur. */
export function speakSegments(
  segments: SpeechSegment[],
  options: SpeakOptions = {},
): SpeechHandle {
  const available = synth()
  // TTS yoksa mod calismaya devam eder (FR-025): okuma atlanir ama akisin
  // devam edebilmesi icin onEnd YINE tetiklenir.
  if (!available) {
    options.onEnd?.()
    return { cancel: () => {} }
  }
  // Daraltilmis tip acikca sabitlenir: asagidaki kapanislarin (onend/onerror)
  // icinde akis analizi null kontrolunu tasimiyor.
  const speech: SpeechSynthesis = available

  const items = segments.flatMap((segment) =>
    splitIntoChunks(segment.text).map((text) => ({ text, lang: segment.lang })),
  )

  let cancelled = false
  // Bitmis bir okumanin handle'i sonradan iptal edilirse (ornegin bileşen
  // unmount temizligi) speech.cancel() O SIRADA CALAN BASKA bir okumayi
  // oldururdu. Bitti isareti bunu engeller.
  let done = false
  let index = 0

  // Chrome uzun kuyrukta kendiliginden duraklayabiliyor; resume() duraklamamis
  // sentezde etkisizdir, bu yuzden guvenli bir sigorta.
  const keepAlive = window.setInterval(() => {
    if (!cancelled && speech.speaking) speech.resume?.()
  }, 5000)

  function finish(callback?: () => void) {
    done = true
    window.clearInterval(keepAlive)
    callback?.()
  }

  function speakNext() {
    if (cancelled) return
    const item = items[index]
    index += 1
    if (!item) {
      finish(options.onEnd)
      return
    }

    const utterance = new SpeechSynthesisUtterance(item.text)
    utterance.lang = BCP47[item.lang]
    utterance.rate = options.rate ?? SPEECH_RATE
    utterance.pitch = SPEECH_PITCH
    const voice = pickVoice(availableVoices(), item.lang)
    if (voice) utterance.voice = voice

    utterance.onend = () => speakNext()
    utterance.onerror = (event) => {
      const reason = (event as { error?: string }).error ?? 'unknown'
      // Iptal bir hata degil: stopSpeaking / yeni okuma bunu tetikler.
      if (reason === 'canceled' || reason === 'interrupted') {
        finish()
        return
      }
      cancelled = true
      finish(() => options.onError?.(reason))
    }

    speech.speak(utterance)
  }

  speech.cancel()
  // Ses listesi hazir degilse ilk parca DOGRU sesi bekler — en fazla
  // VOICES_READY_TIMEOUT_MS. Beklenecek bir kanal yoksa hemen baslanir.
  if (shouldWaitForVoices()) void loadVoices().then(speakNext)
  else speakNext()

  return {
    cancel: () => {
      if (cancelled || done) return
      cancelled = true
      finish()
      speech.cancel()
    },
  }
}

/** Metni normalize edip parcalara ayirarak okur (FR-035 + FR-036). */
export function speakText(
  text: string,
  language: 'tr' | 'en',
  options: SpeakOptions = {},
): SpeechHandle {
  return speakSegments(segmentForSpeech(text, language), options)
}
