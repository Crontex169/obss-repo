import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { LogOut, Send } from 'lucide-react'
import {
  ApiError,
  getInterview,
  submitAnswer,
  type AnsweredPair,
  type InterviewSummary,
  type Question,
} from '@/lib/interview-client'
import { QuestionCard } from '@/components/interview/question-card'
import { HintGuidancePanel } from '@/components/interview/hint-guidance-panel'
import { QuestionTimer } from '@/components/interview/question-timer'
import { VoiceControls } from '@/components/interview/voice-controls'
import { speak } from '@/lib/voice-client'
import { QUESTION_TIME_LIMIT_SECONDS } from '@/lib/interview-config'
import { ErrorRetry } from '@/components/interview/error-retry'
import i18n from '@/lib/i18n'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 2: sirali soru-cevap akisi. Soru i+1 sunucudan ancak soru i
// cevaplandiktan SONRA gelir (FR-006) — istemci hicbir zaman ileri soruyu
// elinde tutmaz, dolayisiyla "sizdirmama" istemci mantigina degil sunucu
// sozlesmesine dayanir.
export default function InterviewSessionPage() {
  const { t } = useTranslation('interview')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [interview, setInterview] = useState<InterviewSummary | null>(null)
  const [question, setQuestion] = useState<Question | null>(null)
  // Resume: yarida birakilan gorusmede onceki ciftler DEGISMEDEN gosterilir (FR-009).
  const [history, setHistory] = useState<AnsweredPair[]>([])
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'submitting' | 'error'>('loading')
  const [error, setError] = useState('')
  // Sozlu modda mikrofon calismazsa yaziliya dusulur (ADR-0010 / R3).
  const [forceWritten, setForceWritten] = useState(false)
  // FR-038: son cevaptan sonra sunucudan gelen notr gecis repligi. Kalici
  // degil — yalnizca siradaki soru okunurken bir kez seslendirilir.
  const [interviewerRemark, setInterviewerRemark] = useState<string | null>(null)
  // FR-040: sozlu modda sayac, asistan soruyu OKUYUP BITIRINCE baslar.
  const [questionSpoken, setQuestionSpoken] = useState(false)
  // FR-007: her soru icin ayri "emin misin" onayi yerine, yalnizca ilk soruda
  // bir kerelik bilgilendirme gosterilir (cevaplar kaydedilir, geri donulemez).
  const [firstQuestionNoticeSeen, setFirstQuestionNoticeSeen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)

  const load = useCallback(() => {
    if (!id) return
    setStatus('loading')
    setError('')
    getInterview(id)
      .then((data) => {
        setInterview(data)
        setQuestion(data.currentQuestion)
        setHistory(data.answeredPairs)
        setStatus('ready')
      })
      .catch((err) => {
        setStatus('error')
        setError(err instanceof ApiError ? err.message : t('session.loadFailed'))
      })
  }, [id, t])

  useEffect(() => {
    load()
  }, [load])

  // Ilk soruda bir kerelik bilgilendirme: cevaplar gonderildigi an kaydedilir
  // ve geri donulemez. Sonraki sorularda tekrar gosterilmez.
  useEffect(() => {
    if (interview?.currentQuestionOrder === 1 && !firstQuestionNoticeSeen) {
      setNoticeOpen(true)
    }
  }, [interview, firstQuestionNoticeSeen])

  // FR-014 — baska cihazda/sekmede tamamlanmis bir gorusmeye "Devam Et" ile
  // gelinirse kullanici otomatik olarak rapor/detay ekranina yonlendirilir.
  useEffect(() => {
    if (interview?.status === 'completed') {
      navigate(`/interview/${interview.id}/report`, { replace: true })
    }
  }, [interview, navigate])

  async function doSubmit(currentQuestion: Question, answerText: string) {
    setStatus('submitting')
    setError('')
    try {
      const result = await submitAnswer(id!, currentQuestion.order, answerText)
      // Cevaplanan soru gecmise tasinir (chat tarzi akis).
      setHistory((prev) => [
        ...prev,
        {
          order: currentQuestion.order,
          type: currentQuestion.type,
          text: currentQuestion.text,
          options: currentQuestion.options,
          tip: currentQuestion.tip,
          rationale: currentQuestion.rationale,
          answer: { content: answerText, answeredAt: new Date().toISOString() },
        },
      ])
      setInterview(result.interview)
      setQuestion(result.currentQuestion)
      setInterviewerRemark(result.interviewerRemark)
      // Yeni soru geldi: okunmadan sayac baslamamali (FR-040).
      setQuestionSpoken(false)
      setAnswer('')
      setStatus('ready')

      // Sozlu modda kapanis (FR-037): son cevap gonderildi, artik soru yok.
      // Rapor ekranina yonlendirme useEffect'te oluyor; kapanis repligi ondan
      // ONCE baslatilir ve iptal EDILMEZ — okuma yonlendirmeye ragmen surer.
      if (!result.currentQuestion && interview?.mode === 'voice' && !forceWritten) {
        // Seslendirilen metin ARAYUZ dilinden degil, GORUSME dilinden gelir:
        // Turkce arayuzden baslatilan Ingilizce gorusme Turkce kapanmamali.
        const speakT = i18n.getFixedT(interview.language, 'interview')
        speak(speakT('voiceControls.closing'), interview.language)
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : t('session.submitFailed'))
    }
  }

  // FR-007: cevap gonderildikten sonra degistirilemez. Bu artik her soruda
  // ayri bir onay istemiyor — kullanici ilk soruda bir kerelik bilgilendirme
  // goruyor (asagidaki bildirim dialogu), sonrasinda gonderim dogrudan olur.
  function confirmSubmit() {
    if (!id || !question || answer.trim().length === 0) return
    void doSubmit(question, answer)
  }

  // FR-027/SC-015: sure dolunca o ana kadarki girdi otomatik gonderilir; hic
  // girdi yoksa bos string gider — akis kesintisiz sonraki soruya gecer.
  function handleTimeExpire() {
    if (!id || !question || status === 'submitting') return
    void doSubmit(question, answer)
  }

  if (status === 'loading') return <p className="text-[var(--color-text-muted)]">{t('session.loading')}</p>
  if (!interview)
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorRetry message={error} onRetry={load} />
      </div>
    )

  if (interview.status === 'completed') {
    // Yonlendirme useEffect'te otomatik tetiklenir (FR-014); bu, o gerceklesene
    // kadarki kisa an icin gosterilen sessiz-basarisizlik-degil ara durumdur.
    return (
      <p className="text-[var(--color-text-muted)]">
        {t('session.completedRedirect')}
      </p>
    )
  }

  const useVoice = interview.mode === 'voice' && !forceWritten
  // Sure iki nedenle beklet: (a) ilk soruda bilgilendirme kabul edilene kadar,
  // (b) sozlu modda asistan soruyu okuyup bitirene kadar (FR-040) — aday
  // soruyu daha duymadan saniyeleri harcamamali.
  // (b) yalnizca VoiceControls'un GERCEKTEN render edildigi durumda gecerli;
  // aksi halde okuma sinyali hic gelmez ve sayac sonsuza kadar bloklanirdi.
  const timerBlocked =
    (interview.currentQuestionOrder === 1 && !firstQuestionNoticeSeen) ||
    (useVoice && question?.type === 'open_ended' && !questionSpoken)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="font-data text-sm font-medium whitespace-nowrap text-[var(--color-accent)]">
          {t('session.questionProgress', {
            current: interview.currentQuestionOrder,
            total: interview.questionCount,
          })}
        </p>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{
              width: `${Math.min(100, (interview.currentQuestionOrder / interview.questionCount) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Onceki soru-cevap ciftleri — DEGISTIRILEMEZ (FR-007). */}
      {history.map((pair) => (
        <div key={pair.order} className="flex flex-col gap-1 opacity-70">
          <p className="max-w-[90%] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm break-words">
            {pair.text}
          </p>
          <p className="max-w-[90%] self-end rounded-xl bg-[var(--color-accent-soft)] p-3 text-sm break-words text-[var(--color-text)]">
            {pair.answer.content}
          </p>
        </div>
      ))}

      {question ? (
        <>
          {!timerBlocked && (
            <QuestionTimer
              key={question.order}
              seconds={QUESTION_TIME_LIMIT_SECONDS}
              onExpire={handleTimeExpire}
            />
          )}
          <QuestionCard
            // Her soruda duzenleme kapali baslar (kalem durumu tasinmaz).
            // Onek SART: kardes QuestionTimer da question.order kullaniyor,
            // ciplak deger ayni ebeveynde key CAKISMASI yaratir ve eski kart
            // DOM'da asili kalir.
            key={`card-${question.order}`}
            question={question}
            value={answer}
            onChange={setAnswer}
            disabled={status === 'submitting'}
            voice={useVoice}
          />

          {/* Hikaye 6 (FR-031/FR-032): yazili VE sozlu modda ayni panel;
              key={question.order} ile her soruda kapali/sifir durumdan baslar. */}
          <HintGuidancePanel
            key={question.order}
            interviewId={id!}
            questionOrder={question.order}
            tip={question.tip}
            rationale={question.rationale}
          />

          {useVoice && question.type === 'open_ended' && (
            <VoiceControls
              interviewId={id!}
              questionText={question.text}
              questionOrder={question.order}
              questionCount={interview.questionCount}
              position={interview.position}
              language={interview.language}
              interviewerRemark={interviewerRemark}
              value={answer}
              onChange={setAnswer}
              onSpeechComplete={() => setQuestionSpoken(true)}
              onFallbackToWritten={() => setForceWritten(true)}
            />
          )}
        </>
      ) : (
        <p className="text-[var(--color-text-muted)]">
          {t('session.questionLoading')}
        </p>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={confirmSubmit}
          disabled={status === 'submitting' || answer.trim().length === 0}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-center text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {status !== 'submitting' && <Send aria-hidden className="size-4" />}
          {status === 'submitting' ? t('session.sending') : t('session.send')}
        </button>

        {/* FR-009: her cevap anlik kaydedilir, resume zaten calisir — cikis
            guvenli oldugu icin kullaniciya ACIKCA soylenir. */}
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] sm:w-auto"
        >
          <LogOut aria-hidden className="size-4" />
          {t('session.saveAndExit')}
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t('session.progressSaved')}
      </p>

      {/* Her soruda ayri "emin misin" onayi yerine, yalnizca ilk soruda
          gosterilen bir kerelik bilgilendirme. Gorsel dil onay kapisi ile
          tutarli (bkz. consent-gate-dialog.tsx). */}
      <AlertDialogPrimitive.Root open={noticeOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <AlertDialogPrimitive.Content
            onEscapeKeyDown={(e) => e.preventDefault()}
            className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-[440px] sm:-translate-x-1/2"
          >
            <div className="border-b border-[var(--color-border)] px-6 py-5">
              <AlertDialogPrimitive.Title className="font-display text-lg font-bold text-[var(--color-text)]">
                {t('session.notice.title')}
              </AlertDialogPrimitive.Title>
            </div>

            <AlertDialogPrimitive.Description asChild>
              <p className="px-6 py-5 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {t('session.notice.description')}
              </p>
            </AlertDialogPrimitive.Description>

            <div className="border-t border-[var(--color-border)] px-6 py-5">
              <button
                type="button"
                onClick={() => {
                  setNoticeOpen(false)
                  setFirstQuestionNoticeSeen(true)
                }}
                className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)]"
              >
                {t('session.notice.confirm')}
              </button>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </div>
  )
}
