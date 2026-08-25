import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { VoiceControls } from '@/components/interview/voice-controls'
import { speak, voiceSupport, loadVoices, hasVoiceFor } from '@/lib/voice-client'
import { transcribeAudio } from '@/lib/interview-client'
import type { SpeakOptions } from '@/lib/speech/speech-queue'
import { VOICE_MIC_WARMUP_MS } from '@/lib/interview-config'

// ADR-0014: sozlu mod STT'si Groq Whisper'a (backend) tasindi. `speak` ve
// destek/tespit fonksiyonlari sahtelenir, ama `startRecording` GERCEK
// calisir — MediaRecorder/getUserMedia/AudioContext jsdom'da yok, bu yuzden
// Task 12'nin voice-client.test.ts'teki sahte tarayici API'leri BIREBIR
// buraya da kopyalanir (paylasilan yardimci dosya YARATILMAZ — ponytail: iki
// kopya, tek yardimci dosyadan daha az soyutlama riski tasir).
vi.mock('@/lib/voice-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/voice-client')>()
  return {
    ...actual,
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    voiceSupport: vi.fn(() => ({ recognition: true, synthesis: true })),
    loadVoices: vi.fn(() => Promise.resolve([])),
    hasVoiceFor: vi.fn(() => true),
  }
})

vi.mock('@/lib/interview-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/interview-client')>()
  return { ...actual, transcribeAudio: vi.fn() }
})

// Ortak sahte MediaRecorder/AudioContext kurulumu — voice-client.test.ts ile
// AYNI (bkz. o dosyadaki yorum).
class FakeAnalyser {
  fftSize = 0
  frequencyBinCount = 4
  connect() {}
  getByteTimeDomainData(out: Uint8Array) {
    out.set(fakeLevelSamples)
  }
}

class FakeAudioContext {
  createMediaStreamSource() {
    return { connect() {} }
  }
  createAnalyser() {
    return new FakeAnalyser()
  }
  close() {
    return Promise.resolve()
  }
}

class FakeMediaRecorder {
  static isTypeSupported = () => true
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  mimeType = 'audio/webm'
  stream: unknown
  opts?: unknown
  constructor(stream: unknown, opts?: unknown) {
    this.stream = stream
    this.opts = opts
    instances.push(this)
  }
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}

let instances: FakeMediaRecorder[] = []
let fakeLevelSamples = new Uint8Array([128, 128, 128, 128]) // varsayilan: sessizlik

function stubBrowserApis() {
  instances = []
  fakeLevelSamples = new Uint8Array([128, 128, 128, 128])
  const tracks = [{ stop: vi.fn() }]
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }),
    },
  })
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { tracks }
}

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
 * Okumayi bitirir ve mikrofonun (gercek startRecording ile) acilmasini
 * bekler. Mikrofon okuma biter bitmez DEGIL, kisa bir isinma gecikmesinden
 * sonra acilir (VOICE_MIC_WARMUP_MS); startRecording da getUserMedia'yi
 * await'ledigi icin zamanlayici ilerletildikten sonra mikro-gorevlerin de
 * bosaltilmasi gerekir (advanceTimersByTimeAsync bunu yapar).
 */
async function finishSpeechAndListen() {
  act(() => {
    lastSpeech().options.onEnd?.()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(VOICE_MIC_WARMUP_MS)
  })
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

function renderControls(
  overrides: Partial<Parameters<typeof VoiceControls>[0]> = {},
) {
  const props = {
    interviewId: 'interview-1',
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

describe('VoiceControls — Whisper tabanli kayit akisi (ADR-0014)', () => {
  let tracks: { stop: ReturnType<typeof vi.fn> }[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockReset()
    vi.mocked(speak).mockReturnValue({ cancel: vi.fn() })
    vi.mocked(voiceSupport).mockReset()
    vi.mocked(voiceSupport).mockReturnValue({ recognition: true, synthesis: true })
    vi.mocked(loadVoices).mockReset()
    vi.mocked(loadVoices).mockReturnValue(Promise.resolve([]))
    vi.mocked(hasVoiceFor).mockReset()
    vi.mocked(hasVoiceFor).mockReturnValue(true)
    vi.mocked(transcribeAudio).mockReset()
    // Varsayilan: hic cozulmez — testler ihtiyaci olanlarda kendi
    // mockResolvedValue/mockRejectedValue'sunu verir. Bu sadece unmount'ta
    // (efekt cleanup'i stopRecording -> onStop) transcribeAudio'nun tanimsiz
    // donmemesi icindir.
    vi.mocked(transcribeAudio).mockReturnValue(new Promise(() => {}))
    ;({ tracks } = stubBrowserApis())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('soru okunduktan sonra otomatik akista kayit baslar (listening fazi)', async () => {
    renderControls()

    await finishSpeechAndListen()

    expect(screen.getByText('Sizi dinliyorum')).toBeInTheDocument()
    expect(instances).toHaveLength(1)
  })

  it("kayit bitince (onStop) 'transcribing' fazina gecilir, transcribeAudio cagrilir", async () => {
    vi.mocked(transcribeAudio).mockReturnValue(new Promise(() => {}))
    renderControls()
    await finishSpeechAndListen()

    fireEvent.click(screen.getByText('Kaydı durdur'))

    expect(screen.getAllByText('Ses metne çevriliyor...').length).toBeGreaterThan(0)
    expect(transcribeAudio).toHaveBeenCalledWith(
      'interview-1',
      expect.any(Blob),
      'audio/webm',
    )
  })

  it('transcribeAudio basarili donerse metin onChange ile cevaba eklenir, faz reviewing olur', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue({ text: 'bir projede calistim' })
    const onChange = vi.fn()
    renderControls({ onChange, value: 'onceki cevap' })
    await finishSpeechAndListen()

    fireEvent.click(screen.getByText('Kaydı durdur'))
    await flushPromises()

    expect(onChange).toHaveBeenCalledWith('onceki cevap bir projede calistim')
    expect(screen.getByText('Cevabınızı kontrol edin')).toBeInTheDocument()
  })

  it('transcribeAudio hata donerse hata mesaji gosterilir VE onFallbackToWritten cagrilir', async () => {
    vi.mocked(transcribeAudio).mockRejectedValue(new Error('network'))
    const { props } = renderControls()
    await finishSpeechAndListen()

    fireEvent.click(screen.getByText('Kaydı durdur'))
    await flushPromises()

    expect(
      screen.getByText('Ses alınamadı. Tekrar deneyin veya cevabınızı yazın.'),
    ).toBeInTheDocument()
    expect(props.onFallbackToWritten).toHaveBeenCalledTimes(1)
  })

  it('MicrophoneDeniedError firlarsa onFallbackToWritten cagrilir (mevcut davranis korunur)', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    })
    const { props } = renderControls()
    await finishSpeechAndListen()

    expect(props.onFallbackToWritten).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText('Mikrofon izni verilmedi. Cevabınızı yazarak girebilirsiniz.'),
    ).toBeInTheDocument()
  })

  it('tarayici desteklenmiyorsa (recordingSupported() === false) notSupportedFallback metni gosterilir', () => {
    vi.mocked(voiceSupport).mockReturnValue({ recognition: false, synthesis: true })

    renderControls()

    expect(
      screen.getByText(
        'Bu tarayıcı sesli girişi desteklemiyor — cevabınızı yazarak girin.',
      ),
    ).toBeInTheDocument()
  })

  // Critical #1 duzeltmesi: 90sn QuestionTimer soruyu aday HALA konusurken
  // otomatik ilerletebilir — bu ESKI sorunun devam eden kaydi, YENI sorunun
  // cevap kutusuna YUKLENMEMELI.
  it('soru degisirken (dinleme sirasinda) devam eden kayit iptal edilir, transcribeAudio cagrilmaz', async () => {
    const onChange = vi.fn()
    const { rerender } = renderControls({
      onChange,
      value: 'onceki cevap',
      questionText: 'Soru 1',
      questionOrder: 1,
    })
    await finishSpeechAndListen()

    expect(screen.getByText('Sizi dinliyorum')).toBeInTheDocument()
    expect(instances).toHaveLength(1)

    rerender(
      <VoiceControls
        interviewId="interview-1"
        questionText="Soru 2"
        questionOrder={2}
        questionCount={5}
        position="Yazilim Gelistirici"
        language="tr"
        interviewerRemark={null}
        value="onceki cevap"
        onChange={onChange}
        onSpeechComplete={vi.fn()}
        onFallbackToWritten={vi.fn()}
      />,
    )

    // Kayit YUKLENMEDEN (onStop tetiklenmeden) iptal edildi: transcribeAudio
    // hic cagrilmadi, eski sorunun cevap degeri degismedi, mikrofon kapandi.
    expect(transcribeAudio).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  // Critical #2 duzeltmesi: getUserMedia izni COK GEC gelirse ve o sirada
  // soru zaten degismisse, gec gelen kayit mikrofonu SONSUZA dek acik
  // birakmamali.
  it('mikrofon izni soru degistikten SONRA gelirse, gecersiz nesildeki kayit iptal edilir, listening fazina hic girilmez', async () => {
    let resolveGetUserMedia: (stream: unknown) => void = () => {}
    const pending = new Promise((resolve) => {
      resolveGetUserMedia = resolve
    })
    const lateTracks = [{ stop: vi.fn() }]
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockReturnValue(pending),
      },
    })

    const onChange = vi.fn()
    const { rerender } = renderControls({
      onChange,
      value: 'onceki cevap',
      questionText: 'Soru 1',
      questionOrder: 1,
    })

    // Okuma biter, beginListening() cagrilir -> getUserMedia PENDING kalir.
    act(() => {
      lastSpeech().options.onEnd?.()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(VOICE_MIC_WARMUP_MS)
    })
    expect(screen.queryByText('Sizi dinliyorum')).not.toBeInTheDocument()

    // Izin hala beklerken soru degisir (aday QuestionTimer ile ilerledi).
    rerender(
      <VoiceControls
        interviewId="interview-1"
        questionText="Soru 2"
        questionOrder={2}
        questionCount={5}
        position="Yazilim Gelistirici"
        language="tr"
        interviewerRemark={null}
        value="onceki cevap"
        onChange={onChange}
        onSpeechComplete={vi.fn()}
        onFallbackToWritten={vi.fn()}
      />,
    )

    // Simdi ESKI soru icin verilen izin gelir.
    resolveGetUserMedia({ getTracks: () => lateTracks })
    await flushPromises()

    expect(screen.queryByText('Sizi dinliyorum')).not.toBeInTheDocument()
    expect(transcribeAudio).not.toHaveBeenCalled()
    expect(lateTracks[0].stop).toHaveBeenCalled()
  })
})
