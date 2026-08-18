import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  startDictation,
  speak,
  stopSpeaking,
  voiceSupport,
  hasVoiceFor,
  loadVoices,
  type Dictation,
  type SpeechHandle,
} from '@/lib/voice-client'
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
type Phase = 'speaking' | 'listening' | 'reviewing' | 'idle'

export function VoiceControls({
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
  // Canli onizleme: kullanici mikrofonun GERCEKTEN duydugunu gormeli, yoksa
  // calisip calismadigini anlamasinin tek yolu beklemek olur (FR-025).
  const [interim, setInterim] = useState('')
  const [voiceMissing, setVoiceMissing] = useState(false)

  const dictationRef = useRef<Dictation | null>(null)
  const speechRef = useRef<SpeechHandle | null>(null)
  const silenceTimerRef = useRef<number | null>(null)
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

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const clearMicStartTimer = useCallback(() => {
    if (micStartTimerRef.current !== null) {
      window.clearTimeout(micStartTimerRef.current)
      micStartTimerRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    clearSilenceTimer()
    clearMicStartTimer()
    setInterim('')
    dictationRef.current?.stop()
    dictationRef.current = null
  }, [clearMicStartTimer, clearSilenceTimer])

  const beginListening = useCallback(() => {
    setError('')
    setInterim('')
    // Sessizlik = "konusmayi bitirdi" (FR-039). Her yeni parcada sifirlanir,
    // boylece cumle arasi dusunme molasi cevabin sonu sayilmaz.
    //
    // Sayac dinleme BASLARKEN kurulMAZ, ancak GERCEK KONUSMA duyulunca kurulur:
    // aday soruyu duyup dusunurken gecen sure "cevap bitti" demek degildir.
    // Aday hic konusmazsa kaydi soru suresi sonlandirir (FR-027).
    const armSilenceTimer = () => {
      clearSilenceTimer()
      silenceTimerRef.current = window.setTimeout(() => {
        stopListening()
        setPhase('reviewing')
      }, VOICE_SILENCE_TIMEOUT_MS)
    }

    try {
      dictationRef.current = startDictation(language, {
        onFinal: (text) => {
          setInterim('')
          onChange(`${valueRef.current} ${text}`.trim())
          armSilenceTimer()
        },
        onInterim: (text) => {
          setInterim(text)
          armSilenceTimer()
        },
        onSpeechStart: armSilenceTimer,
        onError: (err) => {
          clearSilenceTimer()
          setPhase('idle')
          // R3: izin reddi kurtarilabilir bir durum degil — yazili moda dus.
          if (err === 'not-allowed' || err === 'service-not-allowed') {
            setError(t('voiceControls.micDenied'))
            onFallbackToWritten()
          } else if (err === 'audio-capture') {
            setError(t('voiceControls.noMicrophone'))
          } else if (err === 'network') {
            setError(t('voiceControls.networkError'))
          } else {
            setError(t('voiceControls.voiceError'))
          }
        },
        onEnd: () => {
          clearSilenceTimer()
          setInterim('')
          // Tanima KALICI olarak bittiyse onay adimina gecilir. Gecici
          // kesintiler (no-speech) artik buraya ulasmaz — voice-client
          // oturumu kendisi yeniden baslatir.
          setPhase((current) => (current === 'listening' ? 'reviewing' : current))
        },
      })
      setPhase('listening')
    } catch {
      setError(t('voiceControls.notSupported'))
      onFallbackToWritten()
    }
  }, [
    clearSilenceTimer,
    language,
    onChange,
    onFallbackToWritten,
    stopListening,
    t,
  ])

  // Her yeni soruda: (varsa) karsilama/gecis + soru okunur, sonra dinlenir.
  // Bagimlilik yalnizca SORU — replik/dil ayni soru icinde degismez.
  useEffect(() => {
    stopListening()

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
      stopListening()
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

  useEffect(() => () => stopSpeaking(), [])

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

      {/* Dinlerken mikrofonun ne duydugu GORUNUR olur: aksi halde calismayan
          bir mikrofonla sessizce bekleyen bir mikrofon ayirt edilemez. */}
      {phase === 'listening' && (
        <p
          aria-live="polite"
          className="min-h-5 text-sm italic text-[var(--color-text-muted)]"
        >
          {interim || t('voiceControls.listeningHint')}
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
          onClick={() => {
            if (phase === 'listening') {
              stopListening()
              setPhase('reviewing')
            } else {
              speechRef.current?.cancel()
              clearMicStartTimer()
              beginListening()
            }
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium transition-colors hover:border-[var(--color-accent)]"
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
            stopListening()
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
              stopListening()
              setPhase('reviewing')
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
