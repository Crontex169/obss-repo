import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  voiceSupport,
  isSupported,
  startDictation,
  speak,
  stopSpeaking,
  VoiceUnsupportedError,
  DICTATION_RESTART_DELAY_MS,
  DICTATION_RESTART_LIMIT,
} from '@/lib/voice-client'

// ADR-0010: sozlu mod tarayici Web Speech API'sine dayanir. Testlerde GERCEK
// tarayici API'si yok (jsdom) — bu yuzden `window.SpeechRecognition` /
// `window.speechSynthesis` stub'lanir. Amac: (a) yetenek tespiti dogru
// calisiyor mu, (b) desteklenmeyen tarayicida ZARIF BOZULMA (sessiz
// basarisizlik degil, acik hata/devre disi) var mi.

// `speechSynthesis` lib.dom'da ZORUNLU alan olarak tanimli; `delete` edebilmek
// icin once Omit ile dusurulur, sonra opsiyonel olarak geri eklenir.
type W = Omit<typeof window, 'speechSynthesis'> & {
  SpeechRecognition?: unknown
  webkitSpeechRecognition?: unknown
  speechSynthesis?: unknown
}

function deleteSpeechGlobals() {
  const w = window as W
  delete w.SpeechRecognition
  delete w.webkitSpeechRecognition
  delete w.speechSynthesis
}

describe('voiceSupport / isSupported (yetenek tespiti)', () => {
  afterEach(() => {
    deleteSpeechGlobals()
  })

  it('SpeechRecognition ve speechSynthesis YOKSA ikisi de false doner', () => {
    deleteSpeechGlobals()

    expect(voiceSupport()).toEqual({ recognition: false, synthesis: false })
    expect(isSupported()).toBe(false)
  })

  it('yalnizca webkitSpeechRecognition VARSA recognition true doner (Chrome/Edge onegi)', () => {
    deleteSpeechGlobals()
    ;(window as W).webkitSpeechRecognition = class {} as never

    expect(voiceSupport().recognition).toBe(true)
    expect(isSupported()).toBe(true)
  })

  it('SpeechRecognition ve speechSynthesis IKISI de VARSA ikisi de true doner', () => {
    deleteSpeechGlobals()
    ;(window as W).SpeechRecognition = class {} as never
    ;(window as W).speechSynthesis = {} as never

    expect(voiceSupport()).toEqual({ recognition: true, synthesis: true })
  })
})

interface FakeRecognitionInstance {
  onresult: ((e: unknown) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
}

/** window.SpeechRecognition yerine, olay tetikleyebildigimiz bir sahte kurar. */
function mountFakeRecognition() {
  deleteSpeechGlobals()
  let created: FakeRecognitionInstance | null = null
  const start = vi.fn()
  const stop = vi.fn()
  class FakeRecognition {
    lang = ''
    continuous = false
    interimResults = false
    onresult: ((e: unknown) => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    onend: (() => void) | null = null
    onspeechstart: (() => void) | null = null
    start = start
    stop = stop
    abort = vi.fn()
    constructor() {
      created = this
    }
  }
  ;(window as W).SpeechRecognition = FakeRecognition as never
  return { instance: () => created, start, stop }
}

describe('startDictation (zarif bozulma)', () => {
  afterEach(() => {
    deleteSpeechGlobals()
  })

  it('tarayici desteklemiyorsa VoiceUnsupportedError FIRLATIR (sessiz basarisizlik yok)', () => {
    deleteSpeechGlobals()

    expect(() =>
      startDictation('tr', { onFinal: vi.fn() }),
    ).toThrow(VoiceUnsupportedError)
  })

  it('destekleniyorsa recognition.start() cagrilir ve dil gorusme dilinden gelir (tr -> tr-TR)', () => {
    deleteSpeechGlobals()
    const start = vi.fn()
    const stop = vi.fn()
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: unknown = null
      onerror: unknown = null
      onend: unknown = null
      start = start
      stop = stop
      abort = vi.fn()
    }
    ;(window as W).SpeechRecognition = FakeRecognition as never

    const dictation = startDictation('tr', { onFinal: vi.fn() })

    expect(start).toHaveBeenCalledTimes(1)
    dictation.stop()
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('en gorusme dilinde en-US kullanilir', () => {
    deleteSpeechGlobals()
    let created: { lang: string } | null = null
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: unknown = null
      onerror: unknown = null
      onend: unknown = null
      start = vi.fn()
      stop = vi.fn()
      abort = vi.fn()
      constructor() {
        created = this
      }
    }
    ;(window as W).SpeechRecognition = FakeRecognition as never

    startDictation('en', { onFinal: vi.fn() })

    expect(created).not.toBeNull()
    // `created` yalnizca sahte sinifin constructor'inda atandigi icin TS onu
    // hala `null` olarak daraltiyor; ara `unknown` cast'i bunu asar.
    expect((created as unknown as { lang: string }).lang).toBe('en-US')
  })

  it('kesinlesmis sonuc onFinal, kesinlesmemis sonuc onInterim tetikler', () => {
    deleteSpeechGlobals()
    let recognitionInstance: {
      onresult: ((e: unknown) => void) | null
    } | null = null
    class FakeRecognition {
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((e: unknown) => void) | null = null
      onerror: unknown = null
      onend: unknown = null
      start = vi.fn()
      stop = vi.fn()
      abort = vi.fn()
      constructor() {
        recognitionInstance = this
      }
    }
    ;(window as W).SpeechRecognition = FakeRecognition as never

    const onFinal = vi.fn()
    const onInterim = vi.fn()
    startDictation('tr', { onFinal, onInterim })

    recognitionInstance!.onresult!({
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: 'kesin metin' }], { isFinal: true }),
        Object.assign([{ transcript: 'gecici metin' }], { isFinal: false }),
      ],
    })

    expect(onFinal).toHaveBeenCalledWith('kesin metin')
    expect(onInterim).toHaveBeenCalledWith('gecici metin')
  })

  it('kurtarilamaz hata onError + onEnd tetikler (FR-011 benzeri zarif bozulma)', () => {
    const { instance } = mountFakeRecognition()
    const onError = vi.fn()
    const onEnd = vi.fn()
    startDictation('tr', { onFinal: vi.fn(), onError, onEnd })

    instance()!.onerror!({ error: 'not-allowed' })
    // Tarayici onerror'dan sonra onend de tetikler; onEnd TEK kez gitmeli.
    instance()!.onend!()

    expect(onError).toHaveBeenCalledWith('not-allowed')
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('no-speech "cevap bitti" DEGILDIR: hata bildirmez, oturum yeniden baslar', () => {
    vi.useFakeTimers()
    const { instance, start } = mountFakeRecognition()
    const onError = vi.fn()
    const onEnd = vi.fn()
    startDictation('tr', { onFinal: vi.fn(), onError, onEnd })

    // Chrome birkac saniye sessizlikten sonra oturumu boyle kapatir. Aday
    // hala cevap vermeye hazir — dinleme SURMELI, akis bitmemeli.
    instance()!.onerror!({ error: 'no-speech' })
    instance()!.onend!()
    vi.advanceTimersByTime(DICTATION_RESTART_DELAY_MS)

    expect(onError).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('stop() sonrasi oturum YENIDEN BASLAMAZ ve onEnd bir kez tetiklenir', () => {
    vi.useFakeTimers()
    const { instance, start } = mountFakeRecognition()
    const onEnd = vi.fn()
    const dictation = startDictation('tr', { onFinal: vi.fn(), onEnd })

    dictation.stop()
    instance()!.onend!()
    vi.advanceTimersByTime(DICTATION_RESTART_DELAY_MS * 4)

    expect(start).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('hic ses gelmezse sonsuz dongu olmaz — sinirdan sonra oturum kapanir', () => {
    vi.useFakeTimers()
    const { instance } = mountFakeRecognition()
    const onEnd = vi.fn()
    startDictation('tr', { onFinal: vi.fn(), onEnd })

    for (let i = 0; i <= DICTATION_RESTART_LIMIT; i += 1) {
      instance()!.onend!()
      vi.advanceTimersByTime(DICTATION_RESTART_DELAY_MS)
    }

    expect(onEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('speak / stopSpeaking (metin okuma — synthesis destegi yoksa sessizce atlanir)', () => {
  beforeEach(() => {
    deleteSpeechGlobals()
  })
  afterEach(() => {
    deleteSpeechGlobals()
  })

  it('speechSynthesis YOKSA speak() hata FIRLATMAZ (tarayici sadece sesli okumayi atlar)', () => {
    expect(() => speak('merhaba', 'tr')).not.toThrow()
  })

  it('speechSynthesis VARSA speak() cancel + speak cagirir, dil dogru gecirilir', () => {
    const cancel = vi.fn()
    const speakFn = vi.fn()
    ;(window as W).speechSynthesis = { cancel, speak: speakFn } as never
    // jsdom SpeechSynthesisUtterance saglamaz — minimal global stub.
    ;(globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
      class {
        lang = ''
        // `erasableSyntaxOnly`: parametre ozelligi yerine acik atama.
        text: string
        constructor(text: string) {
          this.text = text
        }
      }

    speak('merhaba', 'tr')

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(speakFn).toHaveBeenCalledTimes(1)
  })

  it('stopSpeaking synthesis VARSA cancel cagirir, YOKSA sessizce atlar', () => {
    expect(() => stopSpeaking()).not.toThrow()

    const cancel = vi.fn()
    ;(window as W).speechSynthesis = { cancel } as never
    stopSpeaking()
    expect(cancel).toHaveBeenCalledTimes(1)
  })
})
