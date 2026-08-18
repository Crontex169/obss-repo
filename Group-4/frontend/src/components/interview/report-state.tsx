import { SupportEscape } from '@/components/support-link'
import { useTranslation } from '@/lib/i18n/language-provider'

// T079 — FR-015 / Ilke VII: rapor bekleme ve hata durumlari. Sessiz basarisizlik
// yok; kullanici ne oldugunu ve ne yapabilecegini gorur.
export function ReportPending() {
  const { t } = useTranslation('interview')
  return (
    <div className="rounded-xl bg-[var(--color-surface)] p-6 text-center shadow">
      <p className="font-medium text-[var(--color-text)]">
        {t('reportState.pendingTitle')}
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        {t('reportState.pendingSubtitle')}
      </p>
    </div>
  )
}

export function ReportFailed({
  message,
  retryAfterSeconds,
  onRetry,
  retrying,
}: {
  message: string
  /** 429 durumunda dolu gelir — ne zaman tekrar denenebilecegi soylenir. */
  retryAfterSeconds?: number
  onRetry: () => void
  retrying: boolean
}) {
  const { t } = useTranslation('interview')
  const { t: tCommon } = useTranslation('common')
  const rateLimited = retryAfterSeconds !== undefined

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-6 shadow">
      <p className="font-medium text-[var(--color-danger)]">{message}</p>
      {rateLimited ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('reportState.rateLimited', { minutes: Math.ceil(retryAfterSeconds / 60) })}
        </p>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          {t('reportState.safeToRetry')}
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying || rateLimited}
        className="self-start rounded bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-on-accent)] disabled:opacity-50"
      >
        {retrying ? tCommon('retrying') : tCommon('retry')}
      </button>
      <SupportEscape />
    </div>
  )
}
