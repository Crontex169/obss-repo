import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, listInterviews, type InterviewListItem } from '@/lib/interview-client'
import {
  EMPTY_FILTERS,
  applyFilters,
  facetCounts,
  isFiltering,
  type FilterState,
} from '@/lib/interview-filter'
import { InterviewCard } from '@/components/interview/interview-card'
import { InterviewFilterBar } from '@/components/interview/interview-filter-bar'
import { PageHeader } from '@/components/page-header'
import { ErrorRetry } from '@/components/interview/error-retry'
import { useTranslation } from '@/lib/i18n/language-provider'

// T086 (002-interview) + 004-history genisletmesi — "Gorusmelerim" ekrani:
// tam gorusme listesi, devam etme, silme. Skor trendi /dashboard'a tasindi
// (genel bakis orada, bu ekran yonetime odaklanir). Meslek/admin filtresi
// bu dilimin kapsami disindadir (spec Kapsam Notu).
//
// filtre-arama.md (issue #42): durum/seviye/mod cipleri + arama kutusu, tamami
// istemci tarafinda (FR-025) — liste zaten tek istekte tam geliyor.
export default function InterviewListPage() {
  const { t } = useTranslation('interview')
  const [interviews, setInterviews] = useState<InterviewListItem[] | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)

  const load = useCallback(async () => {
    setRetrying(true)
    setError('')
    try {
      // FR-003 guvenlik agi: sunucu zaten createdAt DESC dondurur (contracts §1),
      // istemci tarafi sort burada garanti eder.
      const data = await listInterviews()
      setInterviews(
        [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('list.loadFailed'))
    } finally {
      setRetrying(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => (interviews ? applyFilters(interviews, filters) : []),
    [interviews, filters],
  )
  const counts = useMemo(() => facetCounts(interviews ?? [], filters), [interviews, filters])
  const filtering = isFiltering(filters)

  return (
    <>
      <PageHeader
        title={t('list.title')}
        actions={
          <Link
            to="/interview/new"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)]"
          >
            {t('list.newInterview')}
          </Link>
        }
      />

      {/* FR-024: hic gorusme yokken filtre cubugu hic render edilmez. */}
      {interviews && interviews.length > 0 && (
        <div className="mt-6">
          <InterviewFilterBar filters={filters} counts={counts} onChange={setFilters} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
            <p aria-live="polite" className="text-sm text-[var(--color-text-muted)]">
              {interviews.length} görüşmeden {visible.length} tanesi gösteriliyor
            </p>
            {filtering && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-sm font-medium text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-strong)]"
              >
                Filtreleri temizle
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {error ? (
          <ErrorRetry message={error} onRetry={load} retrying={retrying} />
        ) : !interviews ? (
          <p className="text-[var(--color-text-muted)]">{t('session.loading')}</p>
        ) : interviews.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <p className="text-[var(--color-text-muted)]">
              {t('list.empty')}
            </p>
          </div>
        ) : visible.length === 0 ? (
          /* FR-023: filtre sonucu bos — "hic gorusme yok" durumundan ayirt edilir. */
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <p className="text-[var(--color-text-muted)]">
              Seçtiğin filtrelerle eşleşen görüşme yok.
            </p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)]"
            >
              Filtreleri temizle
            </button>
          </div>
        ) : (
          visible.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              onDeleted={(id) =>
                setInterviews((prev) => prev?.filter((i) => i.id !== id) ?? null)
              }
            />
          ))
        )}
      </div>
    </>
  )
}
