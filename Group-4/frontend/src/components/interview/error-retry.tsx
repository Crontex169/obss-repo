import { RefreshCw } from 'lucide-react'
import { SupportEscape } from '@/components/support-link'
import { useTranslation } from '@/lib/i18n/language-provider'
// sessiz basarisizlik yok; kullaniciya anlasilir mesaj + tekrar deneme sunulur.
export function ErrorRetry({
  message,
  onRetry,
  retrying,
}: {
  message: string
  onRetry: () => void
  retrying?: boolean
}) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-6 shadow">
      <p className="font-medium text-[var(--color-danger)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="inline-flex items-center gap-1.5 self-start rounded bg-[var(--color-accent)] px-4 py-2 font-medium text-[var(--color-on-accent)] disabled:opacity-50"
      >
        <RefreshCw aria-hidden className={`size-4 ${retrying ? 'animate-spin' : ''}`} />
        {retrying ? t('retrying') : t('retry')}
      </button>
      <SupportEscape />
    </div>
  )
}
