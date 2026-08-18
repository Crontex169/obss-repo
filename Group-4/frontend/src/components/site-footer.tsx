import { SupportLink } from '@/components/support-link'
import { useTranslation } from '@/lib/i18n/language-provider'
import { cn } from '@/lib/utils'

// Issue #51 — site geneli alt bilgi. Repoda daha once hicbir footer yoktu; destek
// adresinin "her sayfada ulasilabilir" olmasi icin uc kabuga da (AppShell,
// AdminShell, landing) buradan ekleniyor.
//
// `dark`: landing koyu zeminde bitiyor, authenticated kabuklar acik zeminde —
// iki gercek kullanim oldugu icin tek boolean yeterli, tema sistemi kurulmadi.
export function SiteFooter({ dark = false }: { dark?: boolean }) {
  const { t } = useTranslation('support')

  return (
    <footer
      className={cn(
        'border-t',
        dark
          ? 'border-[var(--color-border-dark)] bg-[var(--color-bg-dark)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]',
      )}
    >
      <div
        className={cn(
          'mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6',
          dark ? 'text-[var(--color-text-muted-inverse)]' : 'text-[var(--color-text-muted)]',
        )}
      >
        <span>
          © {new Date().getFullYear()} {t('footerRights')}
        </span>
        <span className="flex items-center gap-2">
          <span>{t('heading')}:</span>
          <SupportLink copyable />
        </span>
      </div>
    </footer>
  )
}
