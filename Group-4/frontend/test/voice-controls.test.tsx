import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { VoiceControls } from '@/components/interview/voice-controls'
import {
  startRecording,
  speak,
  voiceSupport,
  MicrophoneDeniedError,
  type RecordingHandlers,
} from '@/lib/voice-client'
import { transcribeAudio } from '@/lib/interview-client'
import type { SpeakOptions } from '@/lib/speech/speech-queue'
import { VOICE_MIC_WARMUP_MS } from '@/lib/interview-config'

vi.mock('@/lib/voice-client', () => {
  class MicrophoneDeniedErrorStub extends Error {
    constructor() {
      super('Mikrofon izni reddedildi.')
      this.name = 'MicrophoneDeniedError'
    }
  }
  return {
    startRecording: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    voiceSupport: vi.fn(() => ({ recognition: true, synthesis: true })),
    loadVoices: vi.fn(() => Promise.resolve([])),
    hasVoiceFor: vi.fn(() => true),
    MicrophoneDeniedError: MicrophoneDeniedErrorStub,
  }
})

// ADR-0014: kayit backend'e yuklenir; GERCEK fetch cagrilmaz.
vi.mock('@/lib/interview-client', () => ({
  transcribeAudio: vi.fn(),
}))

// Hikaye 2 (FR-037..FR-040) + ADR-0014: asistan gorusmeyi yuruten bir akis;
// STT artik tarayicida degil Whisper'da. Testler akisin SIRASINI dogrular.

/** Son speak() cagrisinin okudugu metin ve bitis geri cagrimi. */
function lastSpeech() {
  const calls = vi.mocked(speak).mock.calls
  const call = calls[calls.length - 1]
  return {
    text: call?.[0] as string,
    options: (call?.[2] ?? {}) as SpeakOptions,
  }
}

/** startRecording'e verilen son handler seti (onStop/onLevel/onError). */
function recordingHandlers(): RecordingHandlers {
  const calls = vi.mocked(startRecording).mock.calls
  return calls[calls.length - 1]![1]
}

/**
 * Okumayi bitirir ve mikrofonun acilmasini bekler. Mikrofon okuma biter
 * bitmez DEGIL, kisa bir isinma gecikmesinden sonra acilir
 * (VOICE_MIC_WARMUP_MS). startRecording ARTIK ASENKRON — promise'in
 * cozulmesi de beklenir.
 */
async function finishSpeechAndListen() {
  await act(async () => {
    lastSpeech().options.onEnd?.()
  })
  await act(async () => {
    vi.advanceTimersByTime(VOICE_MIC_WARMUP_MS)
  })
}

function renderControls(
  overrides: Partial<Parameters<typeof VoiceControls>[0]> = {},
) {
  const props = {
    interviewId: 'int-1',
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
    vi.mocked(startRecording).mockReset()
    vi.mocked(speak).mockReset()
    vi.mocked(transcribeAudio).mockReset()
    vi.mocked(voiceSupport).mockReturnValue({
      recognition: true,
      synthesis: true,
    })
    vi.mocked(speak).mockReturnValue({ cancel: vi.fn() })
    vi.mocked(startRecording).mockResolvedValue({ stop: vi.fn() })
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'transkript' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ilk soruda once KARSILAMA, sonra soru okunur (kriter 1)', () => {
    renderControls({ questionOrder: 1 })

    const { text } = lastSpeech()
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

  it('seslendirme GORUSME dilini kullanir, arayuz dilini DEGIL', () => {
    renderControls({ language: 'en', questionOrder: 1 })

    const { text } = lastSpeech()
    expect(text).toContain('Hello and welcome')
    expect(text).not.toContain('Merhaba')
  })

  it('asistan KONUSURKEN mikrofon acilmaz (eko engeli — kriter 3)', () => {
    renderControls()

    expect(screen.getByText('Asistan konuşuyor')).toBeInTheDocument()
    expect(startRecording).not.toHaveBeenCalled()
  })

  it('okuma bitince sure sinyali verilir ve kayit OTOMATIK baslar (kriter 2, 10)', async () => {
    const { props } = renderControls()

    await finishSpeechAndListen()

    // FR-040: sayac ancak simdi baslayabilir.
    expect(props.onSpeechComplete).toHaveBeenCalledTimes(1)
    expect(startRecording).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Sizi dinliyorum')).toBeInTheDocument()
  })

  it('kayit bitince ses Whisper\'a gonderilir ve transkript cevaba eklenir (ADR-0014)', async () => {
    const onChange = vi.fn()
    renderControls({ value: 'onceki', onChange })

    await finishSpeechAndListen()

    const blob = new Blob(['ses'], { type: 'audio/webm' })
    await act(async () => {
      recordingHandlers().onStop(blob, 'audio/webm')
    })

    expect(transcribeAudio).toHaveBeenCalledWith('int-1', blob, 'audio/webm')
    expect(onChange).toHaveBeenCalledWith('onceki transkript')
    expect(screen.getByText('Cevabınızı kontrol edin')).toBeInTheDocument()
  })

  it('transkript beklenirken "ceviriliyor" durumu gosterilir', async () => {
    // Cozulmeyen promise: bilesen 'transcribing' fazinda kalir.
    vi.mocked(transcribeAudio).mockReturnValue(new Promise(() => {}))
    renderControls()

    await finishSpeechAndListen()
    await act(async () => {
      recordingHandlers().onStop(
        new Blob(['ses'], { type: 'audio/webm' }),
        'audio/webm',
      )
    })

    expect(screen.getByText('Ses metne cevriliyor...')).toBeInTheDocument()
  })

  it('Whisper cagrisi basarisiz olursa hata gosterilir ve yaziliya dusulur', async () => {
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('502'))
    const { props } = renderControls()

    await finishSpeechAndListen()
    await act(async () => {
      recordingHandlers().onStop(
        new Blob(['ses'], { type: 'audio/webm' }),
        'audio/webm',
      )
    })

    expect(props.onFallbackToWritten).toHaveBeenCalledTimes(1)
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it('mikrofon izni reddedilirse yazili moda dusulur (ADR-0010 / R3)', async () => {
    vi.mocked(startRecording).mockRejectedValue(new MicrophoneDeniedError())
    const { props } = renderControls()

    await finishSpeechAndListen()

    expect(props.onFallbackToWritten).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText(/Mikrofon izni verilmedi/),
    ).toBeInTheDocument()
  })

  it('otomatik akis KAPATILINCA mikrofon kendiliginden acilmaz (kriter 9)', async () => {
    renderControls()

    // userEvent yerine fireEvent: bu dosya sahte zamanlayici kullaniyor.
    fireEvent.click(screen.getByRole('checkbox'))
    await finishSpeechAndListen()

    expect(startRecording).not.toHaveBeenCalled()
    expect(screen.getByText('Hazır')).toBeInTheDocument()
  })

  it('tarayici kaydi desteklemiyorsa sozlu mod yerine aciklama gosterilir (FR-025)', () => {
    vi.mocked(voiceSupport).mockReturnValue({
      recognition: false,
      synthesis: false,
    })
    renderControls()

    expect(startRecording).not.toHaveBeenCalled()
    expect(screen.getByText(/tarayıcı/i)).toBeInTheDocument()
  })

  it('okuma BASARISIZ olsa bile sure sinyali verilir — akis kilitlenmez', () => {
    const { props } = renderControls()

    act(() => lastSpeech().options.onError?.('synthesis-failed'))

    expect(props.onSpeechComplete).toHaveBeenCalledTimes(1)
  })

  it('transkript icin en guncel value prop degerini kullanir', async () => {
    const onChange = vi.fn()
    const { rerender } = renderControls({ value: 'ilk', onChange })

    await finishSpeechAndListen()

    rerender(
      <VoiceControls
        interviewId="int-1"
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

    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'ek' })
    await act(async () => {
      recordingHandlers().onStop(
        new Blob(['ses'], { type: 'audio/webm' }),
        'audio/webm',
      )
    })

    expect(onChange).toHaveBeenCalledWith('guncel ek')
  })
})
