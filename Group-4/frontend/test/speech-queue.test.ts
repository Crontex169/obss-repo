import { describe, it, expect, vi, afterEach } from 'vitest'
import { pickVoice, speakSegments, SPEECH_RATE } from '@/lib/speech/speech-queue'

// FR-036 — Hikaye 1, kriter 4 ve 5.

// `speechSynthesis` lib.dom'da ZORUNLU; `delete` icin Omit ile dusurulup
// opsiyonel olarak geri eklenir (voice-client.test.ts ile ayni desen).
type W = Omit<typeof window, 'speechSynthesis'> & { speechSynthesis?: unknown }

interface FakeUtterance {
  text: string
  lang: string
  rate: number
  pitch: number
  voice: unknown
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

/**
 * jsdom SpeechSynthesis saglamaz. Bu sahte sentezleyici okunan metinleri
 * kaydeder ve "konusma bitti" olayini TESTIN tetiklemesine izin verir —
 * boylece sira yonetimi gercekten dogrulanabilir.
 */
function installFakeSynthesis(voices: { name: string; lang: string }[] = []) {
  const spoken: FakeUtterance[] = []
  const cancel = vi.fn()

  ;(
    globalThis as unknown as { SpeechSynthesisUtterance: unknown }
  ).SpeechSynthesisUtterance = class {
    lang = ''
    rate = 1
    pitch = 1
    voice: unknown = null
    onend: (() => void) | null = null
    onerror: ((e: { error: string }) => void) | null = null
    // Parametre ozelligi (`public text`) `erasableSyntaxOnly` altinda yasak —
    // kod uretir, tip silinerek calistirilamaz. Acik atama ile ayni sey.
    text: string
    constructor(text: string) {
      this.text = text
    }
  }
  ;(window as W).speechSynthesis = {
    cancel,
    speak: (utterance: FakeUtterance) => spoken.push(utterance),
    getVoices: () => voices,
    resume: vi.fn(),
    speaking: false,
  } as never

  return {
    spoken,
    cancel,
    /** Sirada bekleyen son metnin okunmasini bitirir. */
    finishLast: () => spoken[spoken.length - 1]?.onend?.(),
    failLast: (error: string) => spoken[spoken.length - 1]?.onerror?.({ error }),
  }
}

afterEach(() => {
  delete (window as W).speechSynthesis
})

describe('pickVoice (ses secimi — kriter 5)', () => {
  it('ayni dilde noral ses varsa varsayilan sese TERCIH EDILIR', () => {
    const voices = [
      { name: 'Microsoft Tolga', lang: 'tr-TR' },
      { name: 'Microsoft Emel Online (Natural)', lang: 'tr-TR' },
    ]

    expect(pickVoice(voices, 'tr')?.name).toBe('Microsoft Emel Online (Natural)')
  })

  it('Google sesi duz sistem sesine tercih edilir', () => {
    const voices = [
      { name: 'Turkish Male', lang: 'tr-TR' },
      { name: 'Google turkce', lang: 'tr-TR' },
    ]

    expect(pickVoice(voices, 'tr')?.name).toBe('Google turkce')
  })

  it('yalnizca istenen dilin sesleri degerlendirilir', () => {
    const voices = [
      { name: 'Google US English (Natural)', lang: 'en-US' },
      { name: 'Turkish Basic', lang: 'tr-TR' },
    ]

    expect(pickVoice(voices, 'tr')?.name).toBe('Turkish Basic')
    expect(pickVoice(voices, 'en')?.name).toBe('Google US English (Natural)')
  })

  it('bolgesel varyant varsa tam eslesme yeglenir', () => {
    const voices = [
      { name: 'English UK', lang: 'en-GB' },
      { name: 'English US', lang: 'en-US' },
    ]

    expect(pickVoice(voices, 'en')?.name).toBe('English US')
  })

  it('uygun ses yoksa null doner — cagiran varsayilana duser (zarif bozulma)', () => {
    expect(pickVoice([], 'tr')).toBeNull()
    expect(pickVoice([{ name: 'German', lang: 'de-DE' }], 'tr')).toBeNull()
  })
})

describe('speakSegments (kuyruk yonetimi)', () => {
  it('her parca KENDI dilinin sesiyle okunur', () => {
    const fake = installFakeSynthesis([
      { name: 'Google turkce', lang: 'tr-TR' },
      { name: 'Google US English', lang: 'en-US' },
    ])

    speakSegments([
      { text: 'Bir', lang: 'tr' },
      { text: 'deployment', lang: 'en' },
    ])
    fake.finishLast()

    expect(fake.spoken.map((u) => [u.text, u.lang])).toEqual([
      ['Bir', 'tr-TR'],
      ['deployment', 'en-US'],
    ])
  })

  it('parcalar SIRAYLA okunur — onceki bitmeden sonraki baslaMAZ', () => {
    const fake = installFakeSynthesis()

    speakSegments([
      { text: 'Birinci', lang: 'tr' },
      { text: 'Ikinci', lang: 'tr' },
    ])

    expect(fake.spoken).toHaveLength(1)
    fake.finishLast()
    expect(fake.spoken).toHaveLength(2)
  })

  it('onEnd TAM OLARAK BIR KEZ, hepsi bittiginde tetiklenir', () => {
    const fake = installFakeSynthesis()
    const onEnd = vi.fn()

    speakSegments(
      [
        { text: 'Bir', lang: 'tr' },
        { text: 'Iki', lang: 'tr' },
      ],
      { onEnd },
    )

    fake.finishLast()
    expect(onEnd).not.toHaveBeenCalled()
    fake.finishLast()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('iptal edilirse onEnd tetiklenMEZ ve sira ilerlemez', () => {
    const fake = installFakeSynthesis()
    const onEnd = vi.fn()

    const handle = speakSegments(
      [
        { text: 'Bir', lang: 'tr' },
        { text: 'Iki', lang: 'tr' },
      ],
      { onEnd },
    )
    handle.cancel()
    fake.finishLast()

    expect(onEnd).not.toHaveBeenCalled()
    expect(fake.spoken).toHaveLength(1)
  })

  it('uzun metin parcalanir ama TAMAMI okunur — ortada kesilmez (kriter 4)', () => {
    const fake = installFakeSynthesis()
    const long = 'Bu cumle yeterince uzundur ve tekrar eder. '.repeat(10).trim()

    speakSegments([{ text: long, lang: 'tr' }])
    // Kuyruk bitene kadar her parcayi bitir.
    for (let i = 0; i < 20 && fake.spoken.length <= 20; i += 1) fake.finishLast()

    expect(fake.spoken.length).toBeGreaterThan(1)
    expect(fake.spoken.map((u) => u.text).join(' ')).toBe(long)
  })

  it('konusma hizi mulakat tonuna gore ayarlanir', () => {
    const fake = installFakeSynthesis()

    speakSegments([{ text: 'Merhaba', lang: 'tr' }])

    expect(fake.spoken[0].rate).toBe(SPEECH_RATE)
  })

  it('iptal kaynakli hata onError tetiklemez (iptal hata degildir)', () => {
    const fake = installFakeSynthesis()
    const onError = vi.fn()

    speakSegments([{ text: 'Bir', lang: 'tr' }], { onError })
    fake.failLast('interrupted')

    expect(onError).not.toHaveBeenCalled()
  })

  it('gercek sentez hatasi onError tetikler (sessiz basarisizlik yok)', () => {
    const fake = installFakeSynthesis()
    const onError = vi.fn()

    speakSegments([{ text: 'Bir', lang: 'tr' }], { onError })
    fake.failLast('synthesis-failed')

    expect(onError).toHaveBeenCalledWith('synthesis-failed')
  })

  it('TTS destegi YOKSA okuma atlanir ama onEnd yine tetiklenir (akis durmaz)', () => {
    delete (window as W).speechSynthesis
    const onEnd = vi.fn()

    expect(() =>
      speakSegments([{ text: 'Bir', lang: 'tr' }], { onEnd }),
    ).not.toThrow()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
