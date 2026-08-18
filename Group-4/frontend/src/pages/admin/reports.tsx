import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProblemReports, type AdminProblemReport } from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'
import { ErrorRetry } from '@/components/interview/error-retry'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'

// "Bildir" (interview-card ucgen menu) ile gelen serbest metin sikayetlerin
// salt-okunur admin gorunumu. Sayfalama yok — hacim dusuk (case-study olcegi),
// eklenirse dashboard'daki page/pageSize deseni buraya da tasinir.
export default function AdminReportsPage() {
  const { t } = useTranslation('admin')
  const [items, setItems] = useState<AdminProblemReport[] | null>(null)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    setRetrying(true)
    setError('')
    try {
      setItems(await listProblemReports())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('reports.loadError'))
    } finally {
      setRetrying(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.description')} />

      <div className="mt-6">
        {error ? (
          <ErrorRetry message={error} onRetry={load} retrying={retrying} />
        ) : !items ? (
          <p className="text-[var(--color-text-muted)]">{t('reports.loading')}</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
            <p className="text-[var(--color-text-muted)]">{t('reports.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-text-muted)]">
                  <span>
                    {item.ownerEmail} · {item.positionLabel}
                  </span>
                  <span>{new Date(item.createdAt).toLocaleString('tr-TR')}</span>
                </div>
                <Link
                  to={`/admin/interview/${item.interviewId}`}
                  className="mt-1 inline-block text-sm font-medium text-[var(--color-accent)] hover:underline"
                >
                  {t('reports.viewInterview')}
                </Link>
                <p className="mt-2 whitespace-pre-wrap text-[var(--color-text)]">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
