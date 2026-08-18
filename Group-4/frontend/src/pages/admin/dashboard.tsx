import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listInterviews,
  type AdminInterviewListResponse,
} from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'
import { ErrorRetry } from '@/components/interview/error-retry'
import { InterviewTable } from '@/components/admin/interview-table'
import { ProfessionFilter } from '@/components/admin/profession-filter'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US1 / T019 (FR-002, FR-003, FR-004, FR-014): tum kullanicilarin
// gorusmeleri, meslek filtresi ve sayfalama. SALT-OKUNUR (FR-008) — sayfada
// hicbir yazma aksiyonu yok.
export default function AdminDashboardPage() {
  const { t } = useTranslation('admin')
  const [data, setData] = useState<AdminInterviewListResponse | null>(null)
  const [position, setPosition] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  // Filtre secenekleri daralmasin diye ilk (filtresiz) yuklemede toplanan
  // pozisyonlar korunur; filtre uygulaninca liste kucululur ama secenekler kalir.
  const professionsRef = useRef<string[]>([])

  const load = useCallback(async () => {
    setRetrying(true)
    setError('')
    try {
      const result = await listInterviews({
        position: position || undefined,
        page,
      })
      const seen = new Set(professionsRef.current)
      for (const item of result.items) {
        if (item.position) seen.add(item.position)
      }
      professionsRef.current = [...seen].sort((a, b) => a.localeCompare(b, 'tr'))
      setData(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('dashboard.loadError'))
    } finally {
      setRetrying(false)
    }
  }, [position, page, t])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.description')}
        actions={
          <ProfessionFilter
            professions={professionsRef.current}
            value={position}
            onChange={(next) => {
              setPosition(next)
              setPage(1)
            }}
          />
        }
      />

      <div className="mt-6">
        {error ? (
          <ErrorRetry message={error} onRetry={load} retrying={retrying} />
        ) : !data ? (
          <p className="text-[var(--color-text-muted)]">{t('dashboard.loading')}</p>
        ) : data.items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
            <p className="text-[var(--color-text-muted)]">
              {t('dashboard.empty')}
            </p>
          </div>
        ) : (
          <>
            <InterviewTable items={data.items} />

            <nav
              aria-label={t('dashboard.pagination')}
              className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm"
            >
              <p className="text-[var(--color-text-muted)]">
                {t('dashboard.totalRecords', { count: data.total })} ·{' '}
                {t('dashboard.pageOf', { page: data.page, totalPages })}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('dashboard.previous')}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={data.page >= totalPages}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('dashboard.next')}
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
    </>
  )
}
