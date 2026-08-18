import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { ShellHeader } from '@/components/shell-header'
import { SiteFooter } from '@/components/site-footer'
import { signOut } from '@/lib/auth-client'
import { useTranslation } from '@/lib/i18n/language-provider'

function useNavLinks() {
  const { t } = useTranslation('adminShell')
  return [
    { to: '/admin/dashboard', label: t('nav.interviews') },
    { to: '/admin/reports', label: t('nav.reports') },
    { to: '/admin/stats', label: t('nav.stats') },
  ]
}

// 005-admin T008: admin ekranlarinin ortak kabugu. components/app-shell.tsx
// (002-interview) ile ayni ust cubugu (ShellHeader) paylasir; FR-015'in
// istedigi ayrim YERLESIMDE degil RENKTEDIR (asagidaki ADMIN_THEME + alt
// cizgi), bu yuzden iki kabugun dar ekran davranisi da ayni kalir.
//
// FR-015: ayni yerlesim, FARKLI vurgu rengi. --color-accent bu agacta
// --color-admin-accent'e yeniden baglanir; boylece Logo dahil accent kullanan
// tum alt bilesenler tek satirla admin temasina gecer (bilesenler degismez).
const ADMIN_THEME = {
  '--color-accent': 'var(--color-admin-accent)',
  '--color-accent-strong': 'var(--color-admin-accent-strong)',
  '--color-accent-soft': 'var(--color-admin-accent-soft)',
} as CSSProperties

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { t } = useTranslation('adminShell')
  const navLinks = useNavLinks()

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  const actions = (
    <>
      {/* Salt-okunur panel (FR-008): hicbir yazma aksiyonu render EDILMEZ.
          Not her iki dalda da gorunur: admin navigasyonu kisa oldugu icin
          masaustu satirinda da yer kaliyor. */}
      <span className="text-xs text-[var(--color-text-muted)]">
        {t('readOnlyNotice')}
      </span>
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
    <div style={ADMIN_THEME} className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <ShellHeader
        homeTo="/admin/dashboard"
        homeLabel={t('goToAdminPanel')}
        links={navLinks}
        actions={actions}
        className="border-b-2 border-[var(--color-accent)]"
        badge={
          <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-xs font-semibold tracking-wide text-[var(--color-accent-strong)] uppercase">
            {t('badge')}
          </span>
        }
      />

      <main className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <SiteFooter />
    </div>
  )
}
