import type { ReactNode } from 'react'
import { LogOut } from 'lucide-react'
import { ShellHeader } from '@/components/shell-header'
import { SiteFooter } from '@/components/site-footer'
import { useSignOut } from '@/lib/use-sign-out'
import { useTranslation } from '@/lib/i18n/language-provider'

function useNavLinks() {
  const { t } = useTranslation('appShell')
  return [
    { to: '/dashboard', label: t('nav.dashboard') },
    { to: '/interviews', label: t('nav.interviews') },
    { to: '/pre-assessment/new', label: t('nav.preAssessments') },
    { to: '/settings', label: t('nav.settings') },
  ]
}

// Tum authenticated sayfalarin ortak kabugu — logo, nav, "Yeni Görüşme" CTA'si
// ve cikis her ekranda ayni yerde. Sayfalar arasi baglanti eksikligini giderir
// (her sayfa eskiden kendi basina, birbirinden izole "min-h-screen" konteynerdi).
//
// Ust cubugun dar ekran davranisi ShellHeader'da (masaustu satiri + mobil
// panel); burasi yalnizca ICERIGI verir.
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('appShell')
  const navLinks = useNavLinks()
  const handleSignOut = useSignOut()

  // w-full lg:w-auto: ayni dugum hem mobil panelde (tam genislik, dokunulabilir)
  // hem masaustu satirinda (icerik genisligi) kullanilir — iki dal birbirini
  // disladigi icin catisma olmaz (bkz. shell-header.tsx).
  const actions = (
    <>
      <button
        type="button"
        onClick={handleSignOut}
        className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-center text-sm font-medium whitespace-nowrap text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)] lg:w-auto lg:py-1.5 lg:hover:bg-transparent"
      >
        <LogOut aria-hidden className="size-4" />
        {t('signOut')}
      </button>
    </>
  )

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <ShellHeader
        homeTo="/dashboard"
        homeLabel={t('nav.dashboard')}
        links={navLinks}
        actions={actions}
        className="border-b border-[var(--color-border)]"
        containerClassName="max-w-5xl"
      />

      {/* min-w-0: icerideki tablo/grafik gibi tasabilen ogeler main'i genisletip
          sayfayi yatay kaydirilabilir yapmasin — tasma kendi kabinde kalir. */}
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <SiteFooter />
    </div>
  )
}
