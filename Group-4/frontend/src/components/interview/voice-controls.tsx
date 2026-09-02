import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  startRecording,
  speak,
  voiceSupport,
  hasVoiceFor,
  loadVoices,
  MicrophoneDeniedError,
  type Recording,
  type SpeechHandle,
} from '@/lib/voice-client'
import { transcribeAudio } from '@/lib/interview-client'
import { buildPreQuestionSpeech } from '@/lib/speech/interview-script'
import {
  QUESTION_TIME_LIMIT_SECONDS,
  VOICE_SILENCE_TIMEOUT_MS,
  VOICE_MIC_WARMUP_MS,
} from '@/lib/interview-config'
import i18n from '@/lib/i18n'
import { useTranslation } from '@/lib/i18n/language-provider'

// ADR-0010 / R2, R3 — FR-008, FR-025, FR-037..FR-040.
//
// Asistan artik soru okuyan bir hoparlor degil, gorusmeyi YURUTEN bir akis:
//   karsilama -> soru -> dinleme -> transkript onayi -> gecis -> sonraki soru
//
// Iki kural akisin her yerinde gecerli:
//   1. Asistan konusurken mikrofon KAPALI (FR-039) — aksi halde asistanin
//      kendi sesi transkripte karisir.
//   2. Transkript GONDERIM ONCESI kullanicida durur ve duzenlenebilir
//      (ADR-0010 / R2) — otomatik gonderim YOK. Gonderme eylemi ust bilesende
//      tek bir "Gonder" dugmesinde kalir; burada ikinci bir gonderim yolu
//      acilmaz.
type Phase = 'speaking' | 'listening' | 'transcribing' | 'reviewing' | 'idle'

export function VoiceControls({
  interviewId,
  questionText,
  questionOrder,
  questionCount,
  position,
  language,
  interviewerRemark,
  value,
  onChange,
  onSpeechComplete,
  onFallbackToWritten,
}: {
  /** ADR-0014: kayit BU gorusmenin ucuna yuklenir (sahiplik + dil ipucu). */
  interviewId: string
  questionText: string
  questionOrder: number
  questionCount: number
  position: string | null
  language: 'tr' | 'en'
  /** FR-038: sunucudan gelen notr gecis repligi; yoksa sablona dusulur. */
  interviewerRemark: string | null
  value: string
  onChange: (text: string) => void
  /** FR-040: soru okunup bitince — sure sayaci ANCAK o zaman baslar. */
  onSpeechComplete: () => void
  onFallbackToWritten: () => void
}) {
  const { t } = useTranslation('interview')
  // ARAYUZ dili kullanicinin sectigi dildir; SESLENDIRME dili gorusmenin
  // dilidir (Interview.language) ve ikisi ayni olmak zorunda DEGIL. Ingilizce
  // bir gorusme Turkce arayuzden baslatilabilir — karsilama/gecis metinleri
  // t() ile alinirsa Ingilizce gorusme TURKCE konusur. Seslendirilecek her
  // metin bu yuzden gorusme diline sabitlenmis speakT ile alinir.
  const speakT = useMemo(
    () => i18n.getFixedT(language, 'interview'),
    [language],
  )
  const support = voiceSupport()
  const [phase, setPhase] = useState<Phase>('idle')
  const [autoFlow, setAutoFlow] = useState(true)
  const [error, setError] = useState('')
  // ADR-0014: canli metin YOK (Whisper toplu calisir) — yalnizca ses seviyesi
  // (0-1). Kullanici mikrofonun GERCEKTEN duydugunu bununla gorur (FR-025 ile
  // ayni gerekce: calismayan mikrofonla sessizce bekleyen mikrofon ayirt
  // edilebilir olmali).
  const [level, setLevel] = useState(0)
  const [voiceMissing, setVoiceMissing] = useState(false)

  const recordingRef = useRef<Recording | null>(null)
  const speechRef = useRef<SpeechHandle | null>(null)
  // silenceTimerRef KALDIRILDI: sessizlik olcumu artik voice-client.ts
  // icinde (startRecording, AnalyserNode ile). micStartTimerRef KALIR —
  // o TTS bitisi ile mikrofon acilisi arasindaki bekleme, STT motorundan
  // BAGIMSIZ.
  const micStartTimerRef = useRef<number | null>(null)
  const valueRef = useRef(value)
  // Efektler bu degerleri OKUR ama onlara BAGLI DEGILDIR: soru okuma yalnizca
  // soru degistiginde tetiklenmeli, kullanici cevabi yazdikca degil.
  const autoFlowRef = useRef(autoFlow)
  const onSpeechCompleteRef = useRef(onSpeechComplete)

  useEffect(() => {
    valueRef.current = value
  }, [value])
  useEffect(() => {
    autoFlowRef.current = autoFlow
  }, [autoFlow])
  useEffect(() => {
    onSpeechCompleteRef.current = onSpeechComplete
  }, [onSpeechComplete])

  const clearMicStartTimer = useCallback(() => {
    if (micStartTimerRef.current !== null) {
      window.clearTimeout(micStartTimerRef.current)
      micStartTimerRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    clearMicStartTimer()
    setLevel(0)
    recordingRef.current?.stop()
    recordingRef.current = null
  }, [clearMicStartTimer])

  const beginListening = useCallback(() => {
    setError('')
    setLevel(0)

    // Sessizlik esigi (VOICE_SILENCE_TIMEOUT_MS) startRecording'in ICINDE
    // olculur: kayit, konusma duyulduktan sonraki sessizlikte kendiliginden
    // biter ve blob onStop ile gelir (ADR-0014).
    startRecording(VOICE_SILENCE_TIMEOUT_MS, {
      onLevel: setLevel,
      onStop: (blob, mimeType) => {
        setLevel(0)
        recordingRef.current = null
        setPhase('transcribing')
        transcribeAudio(interviewId, blob, mimeType)
          .then(({ text }) => {
            onChange(`${valueRef.current} ${text}`.trim())
            setPhase('reviewing')
          })
          .catch(() => {
            // Spec karari (2026-08-24): STT hatasi mikrofon izni reddiyle
            // AYNI yoldan gecer — hata goster + yaziliya dus, otomatik
            // yeniden deneme YOK.
            setError(t('voiceControls.voiceError'))
            setPhase('idle')
            onFallbackToWritten()
          })
      },
      onError: () => {
        setError(t('voiceControls.voiceError'))
        setPhase('idle')
      },
    })
      .then((recording) => {
        recordingRef.current = recording
        setPhase('listening')
      })
      .catch((err: unknown) => {
        setPhase('idle')
        // R3: izin reddi kurtarilabilir bir durum degil — yazili moda dus.
        if (err instanceof MicrophoneDeniedError) {
          setError(t('voiceControls.micDenied'))
        } else {
          setError(t('voiceControls.notSupported'))
        }
        onFallbackToWritten()
      })
  }, [interviewId, onChange, onFallbackToWritten, t])

  // Her yeni soruda: (varsa) karsilama/gecis + soru okunur, sonra dinlenir.
  // Bagimlilik yalnizca SORU — replik/dil ayni soru icinde degismez.
  useEffect(() => {
    stopRecording()

    const preQuestion = buildPreQuestionSpeech({
      isFirstQuestion: questionOrder === 1,
      greeting: speakT(
        position ? 'voiceControls.greeting' : 'voiceControls.greetingNoPosition',
        {
          position,
          count: questionCount,
          seconds: QUESTION_TIME_LIMIT_SECONDS,
        },
      ),
      interviewerRemark,
      transitionPool: speakT('voiceControls.transitions', {
        returnObjects: true,
      }) as string[],
      questionIndex: questionOrder - 1,
    })

    setPhase('speaking')
    speechRef.current = speak(
      [...preQuestion, questionText].join(' '),
      language,
      {
        onEnd: () => {
          // FR-040: sure ANCAK okuma bittiginde baslar — aday soruyu daha
          // duymadan saniyeleri harcamaz.
          onSpeechCompleteRef.current()
          if (!autoFlowRef.current) {
            setPhase('idle')
            return
          }
          // Mikrofon ayni tick'te acilirsa Chrome'da sentezin kapanan ses
          // cihazina denk gelip ilk kelimeleri kaciriyor.
          clearMicStartTimer()
          micStartTimerRef.current = window.setTimeout(() => {
            micStartTimerRef.current = null
            beginListening()
          }, VOICE_MIC_WARMUP_MS)
        },
        onError: () => {
          onSpeechCompleteRef.current()
          setPhase('idle')
        },
      },
    )

    return () => {
      speechRef.current?.cancel()
      stopRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText, questionOrder])

  // FR-036: dile ait kurulu ses yoksa tarayici SISTEM varsayilanini kullanir —
  // Ingilizce metin Turkce sesle okunur. Sessizce gecmek yerine soylenir.
  useEffect(() => {
    if (!support.synthesis) return
    let active = true
    void loadVoices().then(() => {
      if (active) setVoiceMissing(!hasVoiceFor(language))
    })
    return () => {
      active = false
    }
  }, [language, support.synthesis])

  // Burada eskiden `useEffect(() => () => stopSpeaking(), [])` vardi.
  // stopSpeaking() GLOBAL'dir: speechSynthesis.cancel() tum kuyrugu oldurur,
  // yalnizca bu bilesenin okumasini degil. Son cevaptan sonra bu bilesen
  // unmount olurken ust bilesenin (session.tsx) YENI baslattigi kapanis
  // repligini de kesiyordu — FR-037 metni hic duyulmuyordu.
  // Kendi okumamizi zaten yukaridaki efektin temizligi (speechRef.cancel())
  // durduruyor ve o handle "bitti" isaretini tasidigi icin baskasinin
  // okumasina dokunmaz. Ikinci, global bir iptale gerek yok.

  if (!support.recognition) {
    // Sessiz basarisizlik yok: neden calismadigi soylenir ve yaziliya dusulur.
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        {t('voiceControls.notSupportedFallback')}
      </p>
    )
  }

  // Faz adlari i18n anahtarlariyla birebir ayni tutulur — eslestirme tablosu yok.
  const statusLabel = t(`voiceControls.status.${phase}`)

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      {/* Kriter 8: kullanici her an sirasinin kimde oldugunu GORUR. */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            phase === 'listening'
              ? 'animate-pulse bg-[var(--color-danger)]'
              : phase === 'speaking'
                ? 'animate-pulse bg-[var(--color-accent)]'
                : 'bg-[var(--color-border)]'
          }`}
        />
        <p
          aria-live="polite"
          className="text-sm font-medium text-[var(--color-text)]"
        >
          {statusLabel}
        </p>
      </div>

      {/* Dinlerken mikrofonun duydugu GORUNUR olur: canli metin yerine ses
          seviyesi bari (Whisper toplu calisir, ADR-0014). */}
      {phase === 'listening' && (
        <div className="flex flex-col gap-1">
          <p
            aria-live="polite"
            className="min-h-5 text-sm italic text-[var(--color-text-muted)]"
          >
            {t('voiceControls.listeningHint')}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full bg-[var(--color-danger)] transition-[width] duration-100"
              style={{ width: `${Math.min(100, level * 400)}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'transcribing' && (
        <p
          aria-live="polite"
          className="text-sm italic text-[var(--color-text-muted)]"
        >
          {t('voiceControls.transcribing')}
        </p>
      )}

      {phase === 'reviewing' && (
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('voiceControls.reviewHint')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          // 'transcribing' fazinda else dali YENI bir kayit baslatirdi ve
          // suren Whisper istegiyle yarisirdi.
          disabled={phase === 'transcribing'}
          onClick={() => {
            if (phase === 'listening') {
              // Elle durdurma da onStop zincirini tetikler (recorder.stop()
              // -> onstop -> yukleme); burada yalnizca UI hemen guncellenir,
              // 'reviewing'e gecis transkript donunce olur.
              stopRecording()
              setPhase('transcribing')
            } else {
              speechRef.current?.cancel()
              clearMicStartTimer()
              beginListening()
            }
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === 'listening'
            ? t('voiceControls.stopRecording')
            : phase === 'reviewing'
              ? t('voiceControls.speakAgain')
              : t('voiceControls.speakAnswer')}
        </button>

        <button
          type="button"
          onClick={() => {
            speechRef.current?.cancel()
            stopRecording()
            setPhase('speaking')
            // Yalnizca SORU tekrar okunur (karsilama/gecis degil); soru metni
            // sunucudan zaten gorusme dilinde gelir.
            speechRef.current = speak(questionText, language, {
              onEnd: () => setPhase('idle'),
              onError: () => setPhase('idle'),
            })
          }}
          disabled={!support.synthesis}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
        >
          {t('voiceControls.replayQuestion')}
        </button>
      </div>

      {/* Ilke VII: otomatik akis kullanicidan kontrolu ALMAZ, geri verilebilir. */}
      <label className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={autoFlow}
          onChange={(event) => {
            const next = event.target.checked
            setAutoFlow(next)
            if (!next && phase === 'listening') {
              stopRecording()
              setPhase('transcribing')
            }
          }}
        />
        {t('voiceControls.autoFlowLabel')}
        <span className="text-xs">{t('voiceControls.autoFlowHint')}</span>
      </label>

      {voiceMissing && (
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('voiceControls.voiceMissing', {
            language: t(`voiceControls.languageName.${language}`),
          })}
        </p>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
