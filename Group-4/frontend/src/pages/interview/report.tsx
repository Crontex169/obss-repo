import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
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
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'

// T078 (002-interview) — Hikaye 5. ADR-0011: Recharts, shadcn ChartContainer
// uzerinden. accessibilityLayer ACIK ve skorlar grafigin yaninda METIN olarak
// da gosterilir — grafik TEK bilgi kaynagi olmaz (Ilke VII, ADR-0011 / R2).
const chartConfig = {
  score: { label: 'Skor', color: 'var(--color-accent)' },
} satisfies ChartConfig

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
        </>
      )}
    </div>
  )
}

function ReportSections({ report }: { report: Report }) {
  const { t } = useTranslation('interview')
  const axes = [
    { axis: t('report.axisTechnical'), score: report.technicalScore },
    { axis: t('report.axisBehavioral'), score: report.behavioralScore },
    { axis: t('report.axisGeneral'), score: report.generalScore },
  ]

  return (
    <>
      {/* Ortalama skor METIN olarak grafigin yaninda gosterilir (FR-026, Ilke VII, ADR-0011/R2). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <span className="font-medium text-[var(--color-text)]">{t('report.overallScore')}</span>
        <span className="text-2xl font-semibold text-[var(--color-accent)]">
          {report.overallScore}/100
        </span>
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-72">
          {/* margin/outerRadius: varsayilan 5px kenar bosluğu "Genel
              Yetkinlik" gibi uzun eksen etiketlerini konteynerin disina
              tasirip kirpiyordu — etiketlere yer acmak icin buyutuldu. */}
          {/* accessibilityLayer=false: burada Tooltip yok, skorlar zaten
              METIN olarak asagida veriliyor (ADR-0011/R2) — acik birakilirsa
              Recharts SVG'yi tabIndex=0 yapiyor ve tiklamada tarayicinin
              varsayilan odak cercevesi (siyah kutu) + rastgele bir "aktif
              nokta" gorunuyor, hicbir bilgi tasimadan. */}
          <RadarChart
            data={axes}
            accessibilityLayer={false}
            outerRadius="60%"
            margin={{ top: 16, right: 32, bottom: 16, left: 56 }}
          >
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            {/* PDF ciktisi (report-pdf.ts drawRadar) skoru sabit 0-100
                olcekte cizer; ayni sabit olcek burada da kilitlenmezse
                Recharts eksenini veriye gore otomatik olceklendirip web ve
                PDF gorunumlerini tutarsiz hale getirir. */}
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.5}
              stroke="var(--color-score)"
              activeDot={false}
            />
          </RadarChart>
        </ChartContainer>

        {/* Skorlar METIN olarak da: grafik tek bilgi kaynagi degil (ADR-0011 / R2). */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {axes.map((a) => (
            <div key={a.axis}>
              <dt className="text-xs text-[var(--color-text-muted)] sm:text-sm">{a.axis}</dt>
              <dd className="font-data mt-0.5 text-lg font-semibold text-[var(--color-text)] sm:text-2xl">
                {a.score}/100
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <TextBlock title={t('report.overallImpression')}>
        <p className="break-words text-[var(--color-text)]">{report.overallImpression}</p>
      </TextBlock>

      <TextBlock title={t('report.strengths')}>
        <BulletList items={report.strengths} />
      </TextBlock>

      <TextBlock title={t('report.improvementAreas')}>
        <BulletList items={report.improvementAreas} />
      </TextBlock>

      {report.additionalNotes.length > 0 && (
        <TextBlock title={t('report.additionalNotes')}>
          <BulletList items={report.additionalNotes} />
        </TextBlock>
      )}
    </>
  )
}

function TextBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h2 className="font-display mb-2 font-semibold text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc break-words text-[var(--color-text)]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
