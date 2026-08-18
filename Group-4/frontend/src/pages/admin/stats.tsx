import { useCallback, useEffect, useState } from 'react'
import { getStats, type AdminStatsResponse } from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'
import { ErrorRetry } from '@/components/interview/error-retry'
import { ProfessionBarChart } from '@/components/admin/profession-bar-chart'
import { CompletionPieChart } from '@/components/admin/completion-pie-chart'
import { TokenLineChart } from '@/components/admin/token-line-chart'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'
import type { TFunction } from 'i18next'

// 005-admin US3 / T041 (FR-009..FR-013): meslek bazli sayi, ortalama sure,
// tamamlanma orani ve gunluk token serisi. Tum toplamlar silinmis gorusmeler
// DAHIL hesaplanir (Clarifications Q1) — bu sunucu tarafinda garantilenir.
const TOKEN_WINDOW_DAYS = 30

/** FR-010: saniyeyi okunabilir sureye cevirir; veri yoksa "—". */
function formatDuration(seconds: number | null, t: TFunction): string {
  if (seconds === null) return '—'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return minutes > 0
    ? t('stats.durationMinutesSeconds', { minutes, seconds: rest })
    : t('stats.durationSecondsOnly', { seconds: rest })
}

export default function AdminStatsPage() {
  const { t } = useTranslation('admin')
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setRetrying(true)
    setError('')
    try {
      setStats(await getStats({ tokenWindowDays: TOKEN_WINDOW_DAYS }))
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('stats.loadError'),
      )
    } finally {
      setRetrying(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (error) return <ErrorRetry message={error} onRetry={load} retrying={retrying} />
  if (!stats) return <p className="text-[var(--color-text-muted)]">{t('stats.loading')}</p>

  const totalInterviews =
    stats.completionRatio.completed + stats.completionRatio.inProgress

  return (
    <>
      <PageHeader title={t('stats.title')} subtitle={t('stats.description')} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs text-[var(--color-text-muted)]">{t('stats.totalInterviews')}</p>
          <p className="font-data mt-1 text-3xl font-bold text-[var(--color-text)]">
            {totalInterviews || '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs text-[var(--color-text-muted)]">
            {t('stats.averageDuration')}
          </p>
          <p className="font-data mt-1 text-3xl font-bold text-[var(--color-text)]">
            {formatDuration(stats.averageDurationSeconds, t)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-xs text-[var(--color-text-muted)]">{t('stats.professionCount')}</p>
          <p className="font-data mt-1 text-3xl font-bold text-[var(--color-text)]">
            {stats.countsByProfession.length || '—'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <ProfessionBarChart data={stats.countsByProfession} />
        <CompletionPieChart ratio={stats.completionRatio} />
      </div>

      <div className="mt-4">
        <TokenLineChart
          data={stats.dailyTokenUsage}
          windowDays={TOKEN_WINDOW_DAYS}
          totalCostUsd={stats.totalCostUsd}
        />
      </div>
    </>
  )
}
