import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeRms,
  pickSupportedMimeType,
  recordingSupported,
  voiceSupport,
  isSupported,
  startRecording,
  VoiceUnsupportedError,
  MicrophoneDeniedError,
} from '@/lib/voice-client'

// ADR-0014: sozlu mod STT'si Groq Whisper'a (backend) tasindi. Testlerde
// GERCEK tarayici API'si yok (jsdom) — MediaRecorder/getUserMedia/AudioContext
// stub'lanir. TTS testleri BU DOSYADA DEGIL (speech-queue/speech-segment).

describe('computeRms', () => {
  it('tam sessizlikte (128 = orta nokta) 0 doner', () => {
    expect(computeRms(new Uint8Array([128, 128, 128, 128]))).toBeCloseTo(0)
  })

  it('uc deger genliginde 1e yakin doner', () => {
    expect(computeRms(new Uint8Array([255, 1, 255, 1]))).toBeGreaterThan(0.9)
  })
})

describe('pickSupportedMimeType', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('MediaRecorder yoksa undefined doner', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickSupportedMimeType()).toBeUndefined()
  })

  it('desteklenen ILK adayi doner', () => {
    vi.stubGlobal('MediaRecorder', {
      isTypeSupported: (type: string) => type === 'audio/webm',
    })
    expect(pickSupportedMimeType()).toBe('audio/webm')
  })

  it('hicbir aday desteklenmiyorsa undefined doner', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false })
    expect(pickSupportedMimeType()).toBeUndefined()
  })
})

// Ortak sahte MediaRecorder/AudioContext kurulumu — startRecording testleri
// bunu paylasir.
let instances: FakeMediaRecorder[] = []
let fakeLevelSamples = new Uint8Array([128, 128, 128, 128]) // varsayilan: sessizlik

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
  // Parametre ozellikleri (public stream: ...) erasableSyntaxOnly ile
  // kullanilamaz — alanlar acikca atanir.
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

describe('recordingSupported / voiceSupport / isSupported (yetenek tespiti)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('kayit desteklenmiyorsa recognition:false doner', () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    vi.stubGlobal('MediaRecorder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    expect(recordingSupported()).toBe(false)
    expect(voiceSupport().recognition).toBe(false)
    expect(isSupported()).toBe(false)
  })

  it('kayit destekleniyorsa recognition:true doner', () => {
    stubBrowserApis()
    expect(recordingSupported()).toBe(true)
    expect(voiceSupport().recognition).toBe(true)
    expect(isSupported()).toBe(true)
  })

  it('AudioContext eksikse false doner (ses seviyesi olculemez)', () => {
    stubBrowserApis()
    vi.stubGlobal('AudioContext', undefined)
    expect(recordingSupported()).toBe(false)
  })
})

describe('startRecording', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('destekleniyorsa kayit baslar', async () => {
    stubBrowserApis()
    const recording = await startRecording(1000, { onStop: vi.fn() })
    expect(recording.stop).toBeInstanceOf(Function)
    expect(instances).toHaveLength(1)
  })

  it('desteklenmiyorsa VoiceUnsupportedError firlatir', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    vi.stubGlobal('MediaRecorder', undefined)
    vi.stubGlobal('AudioContext', undefined)
    await expect(
      startRecording(1000, { onStop: vi.fn() }),
    ).rejects.toBeInstanceOf(VoiceUnsupportedError)
  })

  it('mikrofon izni reddedilirse MicrophoneDeniedError firlatir', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
    })
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
    vi.stubGlobal('AudioContext', FakeAudioContext)

    await expect(
      startRecording(1000, { onStop: vi.fn() }),
    ).rejects.toBeInstanceOf(MicrophoneDeniedError)
  })

  it('elle stop() cagrilinca kayit biter, onStop blob ile tetiklenir', async () => {
    stubBrowserApis()
    const onStop = vi.fn()
    const recording = await startRecording(1000, { onStop })

    recording.stop()

    expect(onStop).toHaveBeenCalledTimes(1)
    const [blob, mimeType] = onStop.mock.calls[0] as [Blob, string]
    expect(blob).toBeInstanceOf(Blob)
    expect(mimeType).toBe('audio/webm')
  })

  it('konusma sonrasi sessizlik esigi dolunca kayit KENDILIGINDEN biter', async () => {
    stubBrowserApis()
    fakeLevelSamples = new Uint8Array([255, 1, 255, 1]) // "konusma" seviyesi
    const onStop = vi.fn()
    const onSpeechStart = vi.fn()
    await startRecording(1000, { onStop, onSpeechStart })

    // Ses seviyesi dongusu 100ms'de bir kosar; konusma algilanir, sessizlik
    // sayaci KURULUR. Sayac HER "konusma" tespitinde YENIDEN kurulur — bu
    // yuzden esik dolmadan ONCE sessizlige gecmek SART.
    await vi.advanceTimersByTimeAsync(100)
    expect(onSpeechStart).toHaveBeenCalledTimes(1)
    expect(onStop).not.toHaveBeenCalled()

    // Aday susuyor: interval artik sessizlik olcer, sayaci BIR DAHA kurmaz.
    fakeLevelSamples = new Uint8Array([128, 128, 128, 128])
    await vi.advanceTimersByTimeAsync(1000)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it('konusma HIC algilanmazsa sessizlik sayaci hic kurulmaz, kayit surer', async () => {
    stubBrowserApis() // varsayilan: sessizlik
    const onStop = vi.fn()
    await startRecording(1000, { onStop })

    // Aday soruyu duyup dusunuyor: bu sure cevabin sonu DEGILDIR. Kayit elle
    // durdurulmadikca surer (soru suresi cagiran tarafta ayrica sinirlar).
    await vi.advanceTimersByTimeAsync(5000)
    expect(onStop).not.toHaveBeenCalled()
  })

  it('stop() sonrasi mikrofon KAPATILIR (track.stop cagrilir)', async () => {
    const { tracks } = stubBrowserApis()
    const recording = await startRecording(1000, { onStop: vi.fn() })

    recording.stop()

    expect(tracks[0].stop).toHaveBeenCalledTimes(1)
  })
})
