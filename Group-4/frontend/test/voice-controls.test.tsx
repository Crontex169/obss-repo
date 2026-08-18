import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { VoiceControls } from '@/components/interview/voice-controls'
import { startDictation, speak } from '@/lib/voice-client'
import type { SpeakOptions } from '@/lib/speech/speech-queue'
import { VOICE_MIC_WARMUP_MS } from '@/lib/interview-config'

vi.mock('@/lib/voice-client', () => ({
  startDictation: vi.fn(),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  voiceSupport: vi.fn(() => ({ recognition: true, synthesis: true })),
  loadVoices: vi.fn(() => Promise.resolve([])),
  hasVoiceFor: vi.fn(() => true),
}))

// Hikaye 2 (FR-037..FR-040): asistan artik soru okuyan bir hoparlor degil,
// gorusmeyi yuruten bir akis. Testler akisin SIRASINI dogrular.

/** Son speak() cagrisinin okudugu metin ve bitis geri cagrimi. */
function lastSpeech() {
  const calls = vi.mocked(speak).mock.calls
  const call = calls[calls.length - 1]
  return {
    text: call?.[0] as string,
    options: (call?.[2] ?? {}) as SpeakOptions,
  }
}

/**
 * Okumayi bitirir ve mikrofonun acilmasini bekler.
 * Mikrofon okuma biter bitmez DEGIL, kisa bir isinma gecikmesinden sonra
 * acilir (VOICE_MIC_WARMUP_MS) — sentezin kapanan ses cihazi ilk kelimeleri
 * yutmasin diye.
 */
function finishSpeechAndListen() {
  act(() => lastSpeech().options.onEnd?.())
  act(() => {
    vi.advanceTimersByTime(VOICE_MIC_WARMUP_MS)
  })
}

function renderControls(
  overrides: Partial<Parameters<typeof VoiceControls>[0]> = {},
) {
  const props = {
    questionText: 'Bir projenizi anlatir misiniz?',
    questionOrder: 1,
    questionCount: 5,
    position: 'Yazilim Gelistirici',
    language: 'tr' as const,
    interviewerRemark: null,
    value: '',
    onChange: vi.fn(),
    onSpeechComplete: vi.fn(),
    onFallbackToWritten: vi.fn(),
    ...overrides,
  }
  return { props, ...render(<VoiceControls {...props} />) }
}

describe('VoiceControls — mulakat akisi', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(startDictation).mockReset()
    vi.mocked(speak).mockReset()
    vi.mocked(speak).mockReturnValue({ cancel: vi.fn() })
    vi.mocked(startDictation).mockReturnValue({ stop: vi.fn() })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ilk soruda once KARSILAMA, sonra soru okunur (kriter 1)', () => {
    renderControls({ questionOrder: 1 })

    const { text } = lastSpeech()
    // Karsilamada pozisyon, soru sayisi ve sure gecer; soru metni SONRA gelir.
    expect(text).toContain('Yazilim Gelistirici')
    expect(text).toContain('5')
    expect(text).toContain('90')
    expect(text.indexOf('Merhaba')).toBeLessThan(
      text.indexOf('Bir projenizi anlatir misiniz?'),
    )
  })

  it('sonraki sorularda karsilama YAPILMAZ, sunucu repligi okunur (kriter 5)', () => {
    renderControls({
      questionOrder: 2,
      interviewerRemark: 'Projeden bahsettiniz, tesekkurler.',
    })

    const { text } = lastSpeech()
    expect(text).not.toContain('Merhaba')
    expect(text.indexOf('Projeden bahsettiniz, tesekkurler.')).toBeLessThan(
      text.indexOf('Bir projenizi anlatir misiniz?'),
    )
  })

  it('replik yoksa sablon gecisi okunur — akis sessiz kalmaz', () => {
    renderControls({ questionOrder: 2, interviewerRemark: null })

    const { text } = lastSpeech()
    expect(text).not.toBe('Bir projenizi anlatir misiniz?')
    expect(text.length).toBeGreaterThan('Bir projenizi anlatir misiniz?'.length)
  })

  it('seslendirme GORUSME dilini kullanir, arayuz dilini DEGIL', () => {
    // Arayuz Turkce (test varsayilani) ama gorusme Ingilizce: asistan
    // Ingilizce karsilamali. Aksi halde Ingilizce gorusme Turkce konusur.
    renderControls({ language: 'en', questionOrder: 1 })

    const { text } = lastSpeech()
    expect(text).toContain('Hello and welcome')
    expect(text).not.toContain('Merhaba')
  })

  it('gecis repligi de gorusme dilinden gelir', () => {
    renderControls({
      language: 'en',
      questionOrder: 2,
      interviewerRemark: null,
    })

    const { text } = lastSpeech()
    expect(text).not.toMatch(/Teşekkür|Anladım|Not aldım/)
  })

  it('asistan KONUSURKEN mikrofon acilmaz (eko engeli — kriter 3)', () => {
    renderControls()

    expect(screen.getByText('Asistan konuşuyor')).toBeInTheDocument()
    expect(startDictation).not.toHaveBeenCalled()
  })

  it('okuma bitince sure sinyali verilir ve mikrofon OTOMATIK acilir (kriter 2, 10)', () => {
    const { props } = renderControls()

    finishSpeechAndListen()

    // FR-040: sayac ancak simdi baslayabilir.
    expect(props.onSpeechComplete).toHaveBeenCalledTimes(1)
    expect(startDictation).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sizi dinliyorum')).toBeInTheDocument()
  })

  it('aday HENUZ KONUSMADIYSA sessizlik sayaci kayda baslamaz (dusunme suresi cevabin sonu degil)', () => {
    const stop = vi.fn()
    vi.mocked(startDictation).mockReturnValue({ stop })
    renderControls()

    finishSpeechAndListen()
    // Aday soruyu duydu ve dusunuyor: bu sure kaydi KAPATMAMALI.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(stop).not.toHaveBeenCalled()
    expect(screen.getByText('Sizi dinliyorum')).toBeInTheDocument()
  })

  it('konusma DUYULDUKTAN sonra sessizlik surerse kayit durur ve ONAY adimina gecilir (kriter 4)', () => {
    const stop = vi.fn()
    let handlers: Parameters<typeof startDictation>[1] | undefined
    vi.mocked(startDictation).mockImplementation((_lang, h) => {
      handlers = h
      return { stop }
    })
    renderControls()

    finishSpeechAndListen()
    act(() => handlers?.onSpeechStart?.())
    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(stop).toHaveBeenCalled()
    expect(screen.getByText('Cevabınızı kontrol edin')).toBeInTheDocument()
  })

  it('konusma devam ederken sessizlik sayaci sifirlanir — cevap erken kesilmez', () => {
    const stop = vi.fn()
    let handlers: Parameters<typeof startDictation>[1] | undefined
    vi.mocked(startDictation).mockImplementation((_lang, h) => {
      handlers = h
      return { stop }
    })
    renderControls()

    finishSpeechAndListen()
    act(() => handlers?.onSpeechStart?.())
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    // Aday konusmaya devam etti: sayac sifirlanmali.
    act(() => handlers?.onInterim?.('devam eden cevap'))
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(stop).not.toHaveBeenCalled()
  })

  it('dinlerken duyulan metin CANLI gosterilir — mikrofonun calistigi gorunur olur', () => {
    let handlers: Parameters<typeof startDictation>[1] | undefined
    vi.mocked(startDictation).mockImplementation((_lang, h) => {
      handlers = h
      return { stop: vi.fn() }
    })
    renderControls()

    finishSpeechAndListen()
    act(() => handlers?.onInterim?.('bir projede calistim'))

    expect(screen.getByText('bir projede calistim')).toBeInTheDocument()
  })

  it('otomatik akis KAPATILINCA mikrofon kendiliginden acilmaz (kriter 9)', () => {
    renderControls()

    // userEvent yerine fireEvent: bu dosya sahte zamanlayici kullaniyor ve
    // userEvent'in kendi bekleme dongusu sahte saatle ilerlemiyor.
    fireEvent.click(screen.getByRole('checkbox'))
    finishSpeechAndListen()

    expect(startDictation).not.toHaveBeenCalled()
    expect(screen.getByText('Hazır')).toBeInTheDocument()
  })

  it('mikrofon izni reddedilirse yazili moda dusulur (ADR-0010 / R3)', () => {
    let handlers: Parameters<typeof startDictation>[1] | undefined
    vi.mocked(startDictation).mockImplementation((_lang, h) => {
      handlers = h
      return { stop: vi.fn() }
    })
    const { props } = renderControls()

    finishSpeechAndListen()
    act(() => handlers?.onError?.('not-allowed'))

    expect(props.onFallbackToWritten).toHaveBeenCalledTimes(1)
  })

  it('okuma BASARISIZ olsa bile sure sinyali verilir — akis kilitlenmez', () => {
    const { props } = renderControls()

    act(() => lastSpeech().options.onError?.('synthesis-failed'))

    expect(props.onSpeechComplete).toHaveBeenCalledTimes(1)
  })

  it('dikte sonucu icin en guncel value prop degerini kullanir', () => {
    let handlers: Parameters<typeof startDictation>[1] | undefined
    vi.mocked(startDictation).mockImplementation((_lang, h) => {
      handlers = h
      return { stop: vi.fn() }
    })
    const onChange = vi.fn()
    const { rerender } = renderControls({ value: 'ilk', onChange })

    finishSpeechAndListen()

    rerender(
      <VoiceControls
        questionText="Bir projenizi anlatir misiniz?"
        questionOrder={1}
        questionCount={5}
        position="Yazilim Gelistirici"
        language="tr"
        interviewerRemark={null}
        value="guncel"
        onChange={onChange}
        onSpeechComplete={vi.fn()}
        onFallbackToWritten={vi.fn()}
      />,
    )

    act(() => handlers?.onFinal('ek'))

    expect(onChange).toHaveBeenCalledWith('guncel ek')
  })
})
