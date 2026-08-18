import type { ReactNode } from 'react'

// Sayfa basligi + opsiyonel aksiyon. Ayni desen bes ekranda elle tekrar
// ediliyordu ve cogunda `flex items-center justify-between` sarmalama YAPMIYORDU:
// dar ekranda baslik ile buton ayni satirda kalmaya calisip birbirini eziyordu.
// Kural tek yerde: yer varsa yan yana, yoksa alt alta.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** Sag taraftaki CTA/rozet. Birden fazla oge verilebilir. */
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      {/* min-w-0: uzun pozisyon adlari gibi kirilamayan metinler kolonu
          buyutup butonu disari itmesin — metin kendi icinde kirilir. */}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-xl font-bold break-words text-[var(--color-text)] sm:text-2xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  )
}
