import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError, getSharedReport, type SharedReport } from '@/lib/interview-client'
import { QuestionAnswerList } from '@/components/interview/question-answer-list'
import { ReportSections } from '@/components/interview/report-sections'
import { Logo } from '@/components/logo'
import { SiteFooter } from '@/components/site-footer'
import { useTranslation } from '@/lib/i18n/language-provider'

// Paylasim linkiyle acilan HERKESE ACIK rapor sayfasi (/r/:token).
//
// AppShell KULLANILMAZ: kabuk oturum menusu/gezinme tasir, buraya gelen kisinin
// hesabi yoktur. Sayfa salt okunurdur — yeniden deneme, PDF, silme YOK.
export default function SharedReportPage() {
  const { t } = useTranslation('interview')
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'error'; message: string }
    | { kind: 'ready'; data: SharedReport }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void getSharedReport(token)
      .then((data) => {
        if (!cancelled) setState({ kind: 'ready', data })
      })
      .catch((err) => {
        if (cancelled) return
        // 404 = token yok / suresi dolmus / rapor silinmis. Sunucu bunlari
        // AYIRT ETMEZ (bilgi sizmasin diye), arayuz de ayirt etmemeli.
        setState({
          kind: 'error',
          message:
            err instanceof ApiError && err.status === 404
              ? t('share.notFound')
              : t('report.loadFailed'),
        })
      })
    return () => {
      cancelled = true
    }
  }, [token, t])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)]">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <Link to="/" className="inline-flex items-center gap-2">
          <Logo />
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        {state.kind === 'loading' && (
          <p className="text-[var(--color-text-muted)]">{t('session.loading')}</p>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
            <p className="text-[var(--color-text)]">{state.message}</p>
            <Link
              to="/"
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)]"
            >
              {t('share.goHome')}
            </Link>
          </div>
        )}

        {state.kind === 'ready' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-xl font-bold text-[var(--color-text)] sm:text-2xl">
                {t('report.title')}
              </h1>
              {state.data.position && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  {state.data.position}
                </p>
              )}
              <p className="text-xs text-[var(--color-text-muted)]">
                {t('share.readOnlyNotice')}
              </p>
            </div>

            {state.data.answeredPairs.length > 0 && (
              <QuestionAnswerList
                pairs={state.data.answeredPairs}
                feedback={state.data.report.questionFeedback}
              />
            )}

            <ReportSections report={state.data.report} />
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
