import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError, getPreAssessment, type PreAssessmentWithReport } from '@/lib/pre-assessment-client'
import { ReportView } from '@/components/pre-assessment/report-view'
import { ErrorRetry } from '@/components/interview/error-retry'
import { useTranslation } from '@/lib/i18n/language-provider'

// §GET /:id — sahibi veya admin gorur; yabanci/yok kayit ErrorRetry'da 404
// mesaji olarak yansir (sizinti onleme, contracts §1 — 403 ile AYIRT EDILEMEZ).
export default function PreAssessmentReportPage() {
  const { t } = useTranslation('preAssessment')
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<PreAssessmentWithReport | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      setRecord(await getPreAssessment(id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('report.loadError'))
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorRetry message={error} onRetry={load} />
      </div>
    )
  }

  if (!record) return <p className="text-[var(--color-text-muted)]">{t('report.loading')}</p>

  return (
    <div className="mx-auto max-w-2xl">
      {record.report ? (
        <ReportView report={record.report} />
      ) : (
        <p className="text-[var(--color-text-muted)]">{t('report.noReport')}</p>
      )}
    </div>
  )
}
