import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'
import { SupportLink } from '@/components/support-link'
import { useSession } from '@/lib/auth-client'
import { DeleteAccountDialog } from '@/components/settings/delete-account-dialog'
import { getKvkkConsentStatus } from '@/lib/users-client'
import { useSignOut } from '@/lib/use-sign-out'
import { useAppLanguage, useTranslation } from '@/lib/i18n/language-provider'
import { useAppTheme } from '@/lib/theme/theme-provider'
import { cn } from '@/lib/utils'
import type { AppLanguage } from '@/lib/i18n'
import type { AppTheme } from '@/lib/theme'

// Issue #43: kullanicinin gidebilecegi Ayarlar sayfasi — hesap bilgisi
// (ad + e-posta, rol etiketi YOK), dil secimi (TR/EN, arayuz + yeni
// olusturulacak mulakat/rapor icerigi icin), tema secimi ve cikis.
// Ayrica KVKK rizasini geri cekme karsiligi: hesabi kalici olarak silme.
export default function SettingsPage() {
  const { t } = useTranslation('settings')
  const { data } = useSession()
  const { language, setLanguage } = useAppLanguage()
  const { theme, setTheme } = useAppTheme()
  const handleSignOut = useSignOut()
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)

  const user = data?.user
  // role, Better Auth additionalFields ile oturum kullanicisinda tasinir.
  // Hesap silme yalnizca 'user' rolune acik; admin'de bolum HIC render edilmez.
  // Bu salt UX katmanidir — sunucu ayni kurali 403 ile uygular (Ilke V).
  const isAdmin = (user as { role?: string } | undefined)?.role === 'admin'

  // Onay bicimi (sifre mi, onay kutusu mu) hesabin parolasi olup olmamasina
  // bagli; bu bilgi oturumda tasinmadigi icin ayrica okunur.
  useEffect(() => {
    if (!user || isAdmin) return
    let cancelled = false
    void getKvkkConsentStatus()
      .then((status) => {
        if (!cancelled) setHasPassword(status.hasPassword)
      })
      .catch(() => {
        // Okunamadiysa silme bolumu gosterilmez; kullanici sayfayi yenileyebilir.
        if (!cancelled) setHasPassword(null)
      })
    return () => {
      cancelled = true
    }
  }, [user, isAdmin])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-[var(--color-text)] sm:text-2xl">{t('title')}</h1>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">
          {t('account.heading')}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-semibold text-[var(--color-accent)]">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-medium break-words text-[var(--color-text)]">{user?.name}</span>
            <span className="text-sm break-all text-[var(--color-text-muted)]">{user?.email}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">
            {t('language.heading')}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t('language.description')}
          </p>
        </div>
        <LanguageToggle language={language} onChange={setLanguage} />
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">
            {t('theme.heading')}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('theme.description')}</p>
        </div>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </section>

      {/* Issue #51 — kullanicinin "yardim" ararken bakacagi ikinci dogal yer. */}
      <section className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">
          {t('support:heading')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">{t('support:description')}</p>
        <SupportLink copyable />
      </section>

      {!isAdmin && hasPassword !== null && (
        <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-danger)]/40 bg-[var(--color-surface)] p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-danger)]">
              {t('deleteAccount.heading')}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t('deleteAccount.description')}
            </p>
          </div>
          <DeleteAccountDialog hasPassword={hasPassword} />
        </section>
      )}

      <button
        type="button"
        onClick={handleSignOut}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
      >
        <LogOut aria-hidden className="size-4" />
        {t('appShell:signOut')}
      </button>
    </div>
  )
}

// Dil secicisiyle ayni gorsel desen. Iki secenek: acik / koyu ("sistem
// tercihini takip et" YOK — tercih tek ve acikca okunabilir kalsin diye).
// aria-pressed, ekran okuyucuda hangi temanin secili oldugunu bildirir.
function ThemeToggle({
  theme,
  onChange,
}: {
  theme: AppTheme
  onChange: (theme: AppTheme) => void
}) {
  const { t } = useTranslation('settings')

  return (
    <div className="inline-flex w-fit overflow-hidden rounded-md border border-[var(--color-border)]">
      {(['light', 'dark'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => onChange(option)}
          className={cn(
            'px-4 py-1.5 text-sm font-semibold transition-colors',
            theme === option
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
              : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          )}
        >
          {t(`theme.${option}`)}
        </button>
      ))}
    </div>
  )
}

function LanguageToggle({
  language,
  onChange,
}: {
  language: AppLanguage
  onChange: (language: AppLanguage) => void
}) {
  const { t } = useTranslation('settings')

  return (
    <div className="inline-flex w-fit overflow-hidden rounded-md border border-[var(--color-border)]">
      {(['en', 'tr'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'px-4 py-1.5 text-sm font-semibold transition-colors',
            language === option
              ? 'bg-[var(--color-accent)] text-[var(--color-on-accent)]'
              : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          )}
        >
          {t(`language.${option}`)}
        </button>
      ))}
    </div>
  )
}
