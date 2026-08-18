import { RefreshCw } from 'lucide-react'
import { SupportEscape } from '@/components/support-link'
import { useTranslation } from '@/lib/i18n/language-provider'
// FR-008/FR-008b (H3): hata + "Tekrar dene" - OTOMATIK yeniden deneme YOK, yalnizca
// kullanici tetikli (error-retry.tsx ile ayni davranis, bu dilime ozgu metinlerle).
export function GenerationPending() {
  const { t } = useTranslation('preAssessment')
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      <p className="text-sm text-[var(--color-text-muted)]">
        {t('generation.pending')}
      </p>
    </div>
  )
}

export function GenerationError({
  message,
  retryAfterSeconds,
  onRetry,
  retrying,
}: {
  message: string
  retryAfterSeconds?: number
  onRetry: () => void
  retrying?: boolean
}) {
  const { t } = useTranslation('preAssessment')
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <p className="text-sm font-medium text-[var(--color-danger)]">{message}</p>
      {retryAfterSeconds !== undefined && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('generation.retryAfter', { minutes: Math.ceil(retryAfterSeconds / 60) })}
        </p>
      )}
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw aria-hidden className={`size-4 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? t('common:retrying') : t('common:retry')}
      </button>
      <SupportEscape />
    </div>
  )
}
