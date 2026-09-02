import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ApiError,
  getInterview,
  retryReport,
  type AnsweredPair,
  type Report,
} from '@/lib/interview-client'
import { ReportFailed, ReportPending } from '@/components/interview/report-state'
import { QuestionAnswerList } from '@/components/interview/question-answer-list'
import { ErrorRetry } from '@/components/interview/error-retry'
import { PdfExportButton } from '@/components/interview/pdf-export-button'
import { ReportSections } from '@/components/interview/report-sections'
import { ShareReportButton } from '@/components/interview/share-report-button'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'

// T078 (002-interview) — Hikaye 5. Raporun gorsel govdesi ReportSections'a
// tasindi: paylasim linkiyle acilan herkese acik sayfa ayni bileseni kullanir.

// 004-history (US3, FR-007/FR-008) — bu sayfa "Gorusme Detayi" ekranidir:
// soru/cevap ciftleri + rapor birlikte gosterilir. Veri kaynagi getReport()
// yerine getInterview() oldu (tek cagrida hem answeredPairs hem report gelir,
// contracts/interview-api.md §3).
type ViewState =
  | { kind: 'loading' }
  | { kind: 'load-error'; message: string }
  | {
      kind: 'ready'
      position: string | null
      answeredPairs: AnsweredPair[]
      reportStatus: 'not_applicable' | 'pending' | 'ready' | 'failed'
      report: Report | null
    }

export default function InterviewReportPage() {
  const { t } = useTranslation('interview')
  const { id } = useParams<{ id: string }>()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<{
    message: string
    retryAfterSeconds?: number
  } | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setState({ kind: 'loading' })
    try {
      const data = await getInterview(id)
      setState({
        kind: 'ready',
        position: data.position,
        answeredPairs: data.answeredPairs,
        reportStatus: data.reportStatus,
        report: data.report,
      })
    } catch (err) {
      setState({
        kind: 'load-error',
        message: err instanceof ApiError ? err.message : t('report.loadFailed'),
      })
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRetry() {
    if (!id) return
    setRetrying(true)
    setRetryError(null)
    try {
      const data = await retryReport(id)
      setState((prev) =>
        prev.kind === 'ready'
          ? { ...prev, reportStatus: 'ready', report: data.report }
          : prev,
      )
    } catch (err) {
      setRetryError({
        message: err instanceof ApiError ? err.message : t('report.retryFailed'),
        retryAfterSeconds:
          err instanceof ApiError
            ? (err.body.details?.retryAfterSeconds as number | undefined)
            : undefined,
      })
    } finally {
      setRetrying(false)
    }
  }

  if (state.kind === 'loading') return <p className="text-[var(--color-text-muted)]">{t('session.loading')}</p>
  if (state.kind === 'load-error')
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorRetry message={state.message} onRetry={load} />
      </div>
    )

  const { position, answeredPairs, reportStatus, report } = state

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('report.title')}
        subtitle={position ?? undefined}
        actions={
          reportStatus === 'ready' ? (
            <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
              {t('report.aiGenerated')}
            </span>
          ) : undefined
        }
      />

      {/* #68: geri bildirim raporun bir parcasi — rapor hazir degilse (pending/
          failed) liste eskisi gibi sade soru/cevap olarak gosterilir. */}
      {answeredPairs.length > 0 && (
        <QuestionAnswerList
          pairs={answeredPairs}
          feedback={report?.questionFeedback}
        />
      )}

      {reportStatus === 'pending' && <ReportPending />}

      {reportStatus === 'failed' && (
        <ReportFailed
          message={retryError?.message ?? t('report.retryFailed')}
          retryAfterSeconds={retryError?.retryAfterSeconds}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}

      {reportStatus === 'ready' && report && (
        <>
          <ReportSections report={report} />
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/dashboard"
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
            >
              {t('report.backToHome')}
            </Link>
            <PdfExportButton
              report={report}
              position={position}
              pairs={answeredPairs}
            />
          </div>

          {/* Paylasim linki: mentor/arkadas raporu HESAP ACMADAN gorebilsin.
              Link sureli (7 gun) ve istenildigi an iptal edilebilir. */}
          <ShareReportButton interviewId={id!} />
        </>
      )}
    </div>
  )
}
