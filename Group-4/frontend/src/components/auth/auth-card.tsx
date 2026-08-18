import type { ReactNode } from 'react'
import obssLogo from '@/assets/obss-logo.png'
import { SupportLink } from '@/components/support-link'
import { useTranslation } from '@/lib/i18n/language-provider'

// 007-ui-design v2.pen "Auth Card": 400px genislik, 32px ic bosluk, 20px dikey
// aralik, 16px kose, 1px #E5E7EB cerceve, beyaz zemin. Baslik/alt baslik
// opsiyoneldir — giris ve kayit ekranlarinda tasarimda basssiz, dogrudan
// alanlarla basliyor; sifremi-unuttum/sifirlama ekranlarinda var.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const { t } = useTranslation('support')

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] px-4 py-8 sm:py-10">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
        <a href="/" aria-label="Ana sayfa">
          <img
            src={obssLogo}
            alt="OBSS"
            className="h-[42px] w-[119px] object-contain"
          />
        </a>
        {title && (
          // Satir ici stil: index.css'teki `h1,h2,h3,h4 { font-family: ... }`
          // kurali katmansiz oldugu icin Tailwind utility'sini yener; tasarim
          // bu basliklarda govde fontunu (Inter) kullaniyor.
          <h1
            className="text-lg font-semibold text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="w-full text-center text-[13px] text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
        <div className="flex w-full flex-col gap-5">{children}</div>
      </div>
      {footer && (
        <div className="flex flex-wrap justify-center gap-1 text-[13px] text-[var(--color-text-muted)]">
          {footer}
        </div>
      )}
      {/* Issue #51 — giris yapamayan kullanici destek yazamiyorsa kilitlenir. */}
      <p className="text-center text-xs text-[var(--color-text-muted)]">
        {t('authHint')} <SupportLink />
      </p>
    </div>
  )
}

// v2.pen "Divider Row" — cizgi + "veya" + cizgi.
export function Ayirici() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="text-xs text-[var(--color-text-muted)]">veya</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  )
}
