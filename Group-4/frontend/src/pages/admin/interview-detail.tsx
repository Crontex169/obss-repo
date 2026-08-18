import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getInterview,
  type AdminInterviewDetail,
  type AdminQuestionFeedback,
} from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'
import { ErrorRetry } from '@/components/interview/error-retry'
import { TokenCostPanel } from '@/components/admin/token-cost-panel'
import { useTranslation } from '@/lib/i18n/language-provider'
import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'

// 005-admin US2 / T029 (FR-004, FR-005, FR-006, FR-007): herhangi bir
// kullanicinin gorusme detayi — silinmis olsa dahi eksiksiz. SALT-OKUNUR:
// hicbir duzenleme/silme aksiyonu render EDILMEZ (FR-008).

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function levelLabel(level: 'intern' | 'junior' | 'mid' | 'senior', t: TFunction): string {
  return t(`interviewDetail.level.${level}`, { ns: 'admin' })
}
function modeLabel(mode: 'written' | 'voice', t: TFunction): string {
  return t(`interviewDetail.mode.${mode}`, { ns: 'admin' })
}

// FR-006: rapor uretilmemis/basarisizsa DURUM acikca belirtilir; ic hata
// detayi (saglayici yaniti, stack trace) sunucudan zaten hic gelmez.
function reportStateMessage(
  reportStatus: string,
  t: TFunction,
): string {
  if (reportStatus === 'pending' || reportStatus === 'failed' || reportStatus === 'not_applicable') {
    return t(`interviewDetail.reportState.${reportStatus}`, { ns: 'admin' })
  }
  return t('interviewDetail.reportState.none', { ns: 'admin' })
}

// #76 (issue #68'in admin karsiligi): kullanicinin raporunda gosterilen soru
// bazli geri bildirim burada da gorunur (FR-005 "eksiksiz"). Kullanici
// ekranindan farki KASITLI: orada panel katlanir, burada her sey acik —
// admin bir gorusmeyi incelerken tek tek acmak zorunda kalmamali.
const VERDICT_STYLE: Record<
  AdminQuestionFeedback['verdict'],
  { icon: string; className: string }
> = {
  dogru: {
    icon: '✓',
    className:
      'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]',
  },
  kismen: {
    icon: '◑',
    className:
      'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]',
  },
  yetersiz: {
    icon: '!',
    className:
      'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]',
  },
}

function QuestionFeedback({
  feedback,
  isMultipleChoice,
}: {
  feedback: AdminQuestionFeedback | undefined
  isMultipleChoice: boolean
}) {
  const { t } = useTranslation('admin')
  if (!feedback) return null

  const style = VERDICT_STYLE[feedback.verdict]

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-[var(--color-border)] pl-3">
      {/* Renk tek sinyal degil: ikon + metin etiketi de tasinir. */}
      <span
        className={cn(
          'inline-flex items-center gap-1 self-start rounded-full border px-2 py-0.5 text-xs font-medium',
          style.className,
        )}
      >
        <span aria-hidden="true">{style.icon}</span>
        {t(`interviewDetail.feedback.verdict.${feedback.verdict}`)}
      </span>
      <p className="text-sm break-words text-[var(--color-text)]">
        <span className="text-[var(--color-text-muted)]">
          {isMultipleChoice
            ? t('interviewDetail.feedback.correctAnswer')
            : t('interviewDetail.feedback.expectedAnswer')}
          :{' '}
        </span>
        {feedback.correctAnswer}
      </p>
      <p className="text-sm break-words text-[var(--color-text-muted)]">
        {feedback.explanation}
      </p>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-[var(--color-text)]">
        {value}
      </dd>
    </div>
  )
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-muted)] p-3 text-center">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="font-data mt-1 text-2xl font-bold text-[var(--color-accent)]">
        {score}
      </p>
    </div>
  )
}

export default function AdminInterviewDetailPage() {
  const { t } = useTranslation('admin')
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<AdminInterviewDetail | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setRetrying(true)
    setError('')
    try {
      setDetail(await getInterview(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('interviewDetail.loadError'))
    } finally {
      setRetrying(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorRetry message={error} onRetry={load} retrying={retrying} />
  if (!detail) return <p className="text-[var(--color-text-muted)]">{t('interviewDetail.loading')}</p>

  // #76: rapor "ready" degilse `report` zaten null gelir — geri bildirim de
  // gosterilmez, soru/cevap listesi eskisi gibi sade kalir.
  const feedbackByOrder = new Map(
    (detail.report?.questionFeedback ?? []).map((f) => [f.order, f]),
  )

  return (
    <>
      <Link
        to="/admin/dashboard"
        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        ← {t('interviewDetail.backToAll')}
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold break-words text-[var(--color-text)] sm:text-2xl">
            {detail.positionLabel}
          </h1>
          {/* break-all: e-posta bosluksuz tek kelimedir, break-words onu
              kirmaz ve dar ekranda kolonu disari tasirirdi. */}
          <p className="mt-1 text-sm break-all text-[var(--color-text-muted)]">
            {detail.ownerEmail}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
              detail.status === 'completed'
                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                : 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
            )}
          >
            {detail.status === 'completed' ? t('interviewDetail.completed') : t('interviewDetail.incomplete')}
          </span>
          {/* FR-004: silinmis kayit da tam icerikle gorunur. */}
          {detail.deletedAt && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-danger-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-danger)]">
              {t('interviewDetail.deleted')}
            </span>
          )}
        </div>
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:grid-cols-4">
        <Meta label={t('interviewDetail.mode.label')} value={modeLabel(detail.mode, t)} />
        <Meta label={t('interviewDetail.level.label')} value={levelLabel(detail.level, t)} />
        <Meta label={t('interviewDetail.startedAt')} value={dateFormat.format(new Date(detail.createdAt))} />
        <Meta
          label={t('interviewDetail.completedAt')}
          value={
            detail.completedAt
              ? dateFormat.format(new Date(detail.completedAt))
              : '—'
          }
        />
      </dl>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section
          aria-label={t('interviewDetail.questionsAndAnswers')}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
        >
          <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
            {t('interviewDetail.questionsAndAnswers')}
          </h2>
          <ol className="mt-4 flex flex-col gap-4">
            {detail.questions.map((q) => (
              <li
                key={q.order}
                className="border-l-2 border-[var(--color-accent-soft)] pl-4"
              >
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  <span className="font-data text-[var(--color-text-muted)]">
                    {q.order}.
                  </span>{' '}
                  {q.text}
                </p>
                {q.options.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {q.options.map((opt) => (
                      <li
                        key={opt}
                        className="rounded bg-[var(--color-bg-muted)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]"
                      >
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
                <p
                  className={cn(
                    'mt-2 text-sm',
                    q.answer
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)] italic',
                  )}
                >
                  {q.answer ?? t('interviewDetail.unanswered')}
                </p>
                <QuestionFeedback
                  feedback={feedbackByOrder.get(q.order)}
                  isMultipleChoice={q.type === 'multiple_choice'}
                />
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-col gap-5">
          <TokenCostPanel tokenUsage={detail.tokenUsage} />

          <section
            aria-label={t('interviewDetail.report.heading')}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
          >
            <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
              {t('interviewDetail.report.heading')}
            </h2>

            {!detail.report ? (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                {reportStateMessage(detail.reportStatus, t)}
              </p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <ScoreCard label={t('interviewDetail.report.technical')} score={detail.report.technicalScore} />
                  <ScoreCard
                    label={t('interviewDetail.report.behavioral')}
                    score={detail.report.behavioralScore}
                  />
                  <ScoreCard label={t('interviewDetail.report.general')} score={detail.report.generalScore} />
                </div>
                <p className="mt-4 text-sm text-[var(--color-text)]">
                  {detail.report.overallImpression}
                </p>
                {detail.report.strengths.length > 0 && (
                  <>
                    <h3 className="mt-4 text-xs font-semibold text-[var(--color-text-muted)]">
                      {t('interviewDetail.report.strengths')}
                    </h3>
                    <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-text)]">
                      {detail.report.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                {detail.report.improvementAreas.length > 0 && (
                  <>
                    <h3 className="mt-3 text-xs font-semibold text-[var(--color-text-muted)]">
                      {t('interviewDetail.report.improvementAreas')}
                    </h3>
                    <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-text)]">
                      {detail.report.improvementAreas.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
                {/* FR-005 "eksiksiz görüntüleme": kullanıcı tarafı raporu
                    (pages/interview/report.tsx) bu alanı gösteriyor, admin de
                    göstermeli (T048). */}
                {detail.report.additionalNotes.length > 0 && (
                  <>
                    <h3 className="mt-3 text-xs font-semibold text-[var(--color-text-muted)]">
                      {t('interviewDetail.report.additionalNotes')}
                    </h3>
                    <ul className="mt-1 list-disc pl-5 text-sm text-[var(--color-text)]">
                      {detail.report.additionalNotes.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
