// Sozlu mod — ADR-0010: tarayici Web Speech API.
// Sunucuda ses isleme YOK, saglayici anahtari YOK, yeni bagimlilik YOK.
// Istemci konusmayi metne cevirir; sunucu cevabi yazili modla AYNI sekilde alir (FR-008).
//
// Bedeli: tarayici bagimliligi (Chrome/Edge). Desteklenmeyen tarayicida sozlu mod
// UI'da DEVRE DISI gosterilir — sessiz basarisizlik yasak (FR-025).

import {
  speakText,
  hasVoiceFor,
  loadVoices,
  type SpeakOptions,
  type SpeechHandle,
} from './speech/speech-queue';

export type { SpeakOptions, SpeechHandle };
export { hasVoiceFor, loadVoices };

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  resultIndex: number;
}

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export interface VoiceSupport {
  /** Konusma -> metin (soru cevaplama). Sozlu mod icin ZORUNLU. */
  recognition: boolean;
  /** Metin -> konusma (sorunun sesli okunmasi). Yoksa mod yine calisir. */
  synthesis: boolean;
}

export function voiceSupport(): VoiceSupport {
  return {
    recognition: recognitionCtor() !== undefined,
    synthesis:
      typeof window !== 'undefined' && 'speechSynthesis' in window,
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

export interface DictationHandlers {
  /** Kesinlesmis metin parcasi — cevap alanina eklenir. */
  onFinal(text: string): void;
  /** Henuz kesinlesmemis metin — canli onizleme (opsiyonel). */
  onInterim?(text: string): void;
  /** Mikrofonda GERCEK konusma duyuldu. Sessizlik sayaci ancak bundan sonra anlamli. */
  onSpeechStart?(): void;
  onError?(error: string): void;
  /** Oturum KALICI olarak bitti (stop() cagrildi veya kurtarilamaz hata). */
  onEnd?(): void;
}

export interface Dictation {
  stop(): void;
}

// Tarayici oturumu kendiliginden bitirdiginde yeniden baslatma araligi.
// 0 olmaz: Chrome onend icinde start() cagrisini "already started" diye
// reddedebiliyor; bir tick beklemek bunu gecirir.
export const DICTATION_RESTART_DELAY_MS = 250;

// Sonsuz yeniden baslatma dongusune karsi sigorta. Gercek konusma duyulunca
// sayac sifirlanir, yani sinir "hic ses gelmeden ust uste kac deneme"dir.
export const DICTATION_RESTART_LIMIT = 40;

// Bunlar oturumun bittigini soyler, sozlu modun bozuldugunu DEGIL:
//   no-speech — Chrome birkac saniye sessizlikten sonra oturumu kapatir.
//   aborted   — baska bir tanima baslatildiginda / sekme degistiginde.
// Ikisinde de aday hala cevap vermeye hazirdir; dinleme SURMELIDIR.
const RECOVERABLE_ERRORS = new Set(['no-speech', 'aborted']);

// Dikkat: dil, gorusmenin kayitli dilinden gelir (Interview.language) — tarayici
// diline birakilmaz, aksi halde TR gorusmede EN tanima yapilir.
//
// continuous=true YETMEZ: Chrome birkac saniye sessizlikte oturumu no-speech
// ile kapatir. Aday soruyu dinleyip dusunurken bu neredeyse HER ZAMAN olur —
// sonra konusmaya baslar ama dinleyen kimse yoktur ("mikrofon acik gorunuyor,
// hicbir sey algilanmiyor"). Bu yuzden oturum, cagiran stop() DEMEDIKCE
// yeniden baslatilir; onEnd yalnizca gercekten bittiginde tetiklenir.
export function startDictation(
  language: 'tr' | 'en',
  handlers: DictationHandlers,
): Dictation {
  const Ctor = recognitionCtor();
  if (!Ctor) throw new VoiceUnsupportedError();

  const recognition = new Ctor();
  recognition.lang = language === 'tr' ? 'tr-TR' : 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  let stopped = false;
  let endEmitted = false;
  let restarts = 0;
  let restartTimer: number | undefined;

  // Tarayici onerror'dan SONRA onend de tetikler; onEnd'in tam olarak bir kez
  // gitmesi cagirandaki faz makinesi icin sart.
  const emitEnd = () => {
    if (endEmitted) return;
    endEmitted = true;
    handlers.onEnd?.();
  };

  recognition.onresult = (event) => {
    // Ses geliyor: yeniden baslatma sigortasi bastan sayilsin.
    restarts = 0;
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) handlers.onFinal(transcript);
      else handlers.onInterim?.(transcript);
    }
  };

  recognition.onspeechstart = () => {
    restarts = 0;
    handlers.onSpeechStart?.();
  };

  recognition.onerror = (event) => {
    // Kurtarilabilir hata rapor EDILMEZ: cagiran bunu "cevap bitti" sanip
    // akisi keserdi. onend yeniden baslatmayi zaten yapacak.
    if (RECOVERABLE_ERRORS.has(event.error)) return;
    stopped = true;
    handlers.onError?.(event.error);
    emitEnd();
  };

  recognition.onend = () => {
    if (stopped) {
      emitEnd();
      return;
    }
    restarts += 1;
    if (restarts > DICTATION_RESTART_LIMIT) {
      stopped = true;
      emitEnd();
      return;
    }
    restartTimer = window.setTimeout(() => {
      if (stopped) return;
      try {
        recognition.start();
      } catch {
        // Zaten calisiyor olabilir — dinleme surdugu icin sorun degil.
      }
    }, DICTATION_RESTART_DELAY_MS);
  };

  recognition.start();

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (restartTimer !== undefined) window.clearTimeout(restartTimer);
      // Oturum yeniden baslatma beklerken duruyorsa onend hic gelmez —
      // bitis sinyali burada verilir (emitEnd tekrar korumali).
      recognition.stop();
      emitEnd();
    },
  };
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
