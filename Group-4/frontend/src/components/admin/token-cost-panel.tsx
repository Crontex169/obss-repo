import type { AdminTokenUsageSummary } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US2 / T028 (FR-007): gorusme basina token/maliyet ozeti.
// Kayit yoksa hata firlatilmaz — zarif "maliyet bilgisi yok" durumu gosterilir.
export function TokenCostPanel({
  tokenUsage,
}: {
  tokenUsage: AdminTokenUsageSummary | null
}) {
  const { t } = useTranslation('admin')
  return (
    <section
      aria-label={t('tokenCostPanel.heading')}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
    >
      <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
        {t('tokenCostPanel.heading')}
      </h2>

      {!tokenUsage ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {t('tokenCostPanel.empty')}
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-[var(--color-text-muted)]">
              {t('tokenCostPanel.totalTokens')}
            </dt>
            <dd className="font-data mt-0.5 text-xl font-semibold text-[var(--color-text)]">
              {tokenUsage.totalTokens}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--color-text-muted)]">
              {t('tokenCostPanel.estimatedCost')}
            </dt>
            <dd className="font-data mt-0.5 text-xl font-semibold text-[var(--color-text)]">
              ${tokenUsage.estimatedCostUsd}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
