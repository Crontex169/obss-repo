// Sozlu mod — ADR-0014: STT Groq Whisper (backend), TTS tarayici Web Speech
// API (ADR-0010'dan degismedi). Bu dosya iki motoru da acar: kayit
// (MediaRecorder + AnalyserNode ile ses seviyesi analizi) burada, sesli
// okuma speech/ altindan devredilir.

import {
  speakText,
  hasVoiceFor,
  loadVoices,
  type SpeakOptions,
  type SpeechHandle,
} from './speech/speech-queue';

export type { SpeakOptions, SpeechHandle };
export { hasVoiceFor, loadVoices };

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

/** Tarayicinin destekledigi ILK aday format — hicbiri yoksa undefined (MediaRecorder varsayilanina duser). */
export function pickSupportedMimeType(): string | undefined {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return undefined;
  }
  return CANDIDATE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Zaman-domeni orneklerinden kaba genlik (RMS). 128 = sessizlik (orta nokta,
 * unsigned byte). Donus degeri 0 (sessiz) ile ~1 (uc deger genlik) arasi.
 */
export function computeRms(samples: Uint8Array): number {
  let sumSquares = 0;
  for (const value of samples) {
    const normalized = (value - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / samples.length);
}

export function recordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof window.AudioContext !== 'undefined'
  );
}

export interface VoiceSupport {
  /** Konusma -> metin (Whisper'a kayit gonderme). Sozlu mod icin ZORUNLU. */
  recognition: boolean;
  /** Metin -> konusma (sorunun sesli okunmasi). Yoksa mod yine calisir. */
  synthesis: boolean;
}

export function voiceSupport(): VoiceSupport {
  return {
    recognition: recordingSupported(),
    synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
}

/** FR-025: cagiran bunu false gorurse sozlu mod secenegini devre disi birakir. */
export function isSupported(): boolean {
  return voiceSupport().recognition;
}

export class VoiceUnsupportedError extends Error {
  constructor() {
    super('Bu tarayici sesli girisi desteklemiyor.');
    this.name = 'VoiceUnsupportedError';
  }
}

export class MicrophoneDeniedError extends Error {
  constructor() {
    super('Mikrofon izni reddedildi.');
    this.name = 'MicrophoneDeniedError';
  }
}

export interface RecordingHandlers {
  /** GERCEK ses seviyesi algilandi (esik ustunde) — startDictation'daki
   *  onSpeechStart ile AYNI amac: sessizlik sayaci ancak BUNDAN SONRA anlamli. */
  onSpeechStart?(): void;
  /** Kayit surerken ANLIK ses seviyesi (0-1 kaba genlik) — kayit gostergesi icin. */
  onLevel?(level: number): void;
  /** Sessizlik esigi asildi VEYA stop() cagrildi: kayit bitti, blob HAZIR (Whisper'a yuklenmeye hazir). */
  onStop(blob: Blob, mimeType: string): void;
  onError?(error: string): void;
}

export interface Recording {
  /** Elle durdurma (kullanici "Kaydi Durdur" butonuna bastiginda) — kayit
   *  YUKLENIR (onStop tetiklenir, transkript uretilir). */
  stop(): void;
  /** Yuklemeden vazgecer — onStop TETIKLENMEZ, transkript uretilmez, kota
   *  harcanmaz. Soru degisti / bilesen kalkti gibi "bu kaydin artik anlami
   *  yok" durumlarinda kullanilir; kullanici/sessizlik tetikli stop()'tan
   *  BILINCLI OLARAK farklidir (bkz. review, Critical #1/#2). */
  cancel(): void;
}

// Kaba genlik esigi — bunun USTU "konusma", ALTI "sessizlik" sayilir.
const SPEECH_LEVEL_THRESHOLD = 0.02;
// Ses seviyesi ne siklikta olculur (ms). RequestAnimationFrame yerine sabit
// interval: testlerde sahte zamanlayicilarla (vi.useFakeTimers) deterministik.
const LEVEL_POLL_MS = 100;

/**
 * Mikrofon kaydini baslatir; VOICE_SILENCE_TIMEOUT_MS kadar sessizlik
 * (startDictation ile AYNI sabit, cagiran taraftan gelir) sonrasi kayit
 * KENDILIGINDEN durur ve onStop tetiklenir. Whisper TOPLU calisir (ADR-0014):
 * canli/akan metin YOKTUR, yalnizca ses seviyesi (onLevel) anlik gorunur.
 */
export async function startRecording(
  silenceTimeoutMs: number,
  handlers: RecordingHandlers,
): Promise<Recording> {
  if (!recordingSupported()) throw new VoiceUnsupportedError();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new MicrophoneDeniedError();
  }

  const mimeType = pickSupportedMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const chunks: BlobPart[] = [];
  let stopped = false;
  let discarded = false;
  let silenceTimer: number | undefined;
  let hasSpoken = false;

  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.frequencyBinCount);

  const clearSilenceTimer = () => {
    if (silenceTimer !== undefined) {
      window.clearTimeout(silenceTimer);
      silenceTimer = undefined;
    }
  };

  const armSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimer = window.setTimeout(finish, silenceTimeoutMs);
  };

  const teardown = () => {
    window.clearInterval(levelInterval);
    clearSilenceTimer();
    stream.getTracks().forEach((track) => track.stop());
    void audioCtx.close();
  };

  function finish() {
    if (stopped) return;
    stopped = true;
    teardown();
    recorder.stop();
  }

  function cancelRecording() {
    discarded = true;
    finish();
  }

  const levelInterval = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    const level = computeRms(samples);
    handlers.onLevel?.(level);
    if (level > SPEECH_LEVEL_THRESHOLD) {
      if (!hasSpoken) {
        hasSpoken = true;
        handlers.onSpeechStart?.();
      }
      armSilenceTimer();
    }
  }, LEVEL_POLL_MS);

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    if (discarded) return;
    const finalType = recorder.mimeType || mimeType || 'audio/webm';
    handlers.onStop(new Blob(chunks, { type: finalType }), finalType);
  };
  recorder.onerror = () => {
    if (stopped) return;
    stopped = true;
    teardown();
    handlers.onError?.('recording-failed');
  };

  recorder.start();

  return { stop: finish, cancel: cancelRecording };
}

// Okuma kalitesi speech/ altinda: metin once telaffuz normalizasyonundan ve
// dil segmentasyonundan gecer, sonra cumle cumle en iyi sesle seslendirilir
// (FR-035, FR-036). Buradan yalnizca devredilir.
export function speak(
  text: string,
  language: 'tr' | 'en',
  options: SpeakOptions = {},
): SpeechHandle {
  return speakText(text, language, options);
}

export function stopSpeaking(): void {
  if (voiceSupport().synthesis) window.speechSynthesis.cancel();
}
