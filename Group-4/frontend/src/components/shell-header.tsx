import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/logo'
import { useTranslation } from '@/lib/i18n/language-provider'
import { cn } from '@/lib/utils'

export type ShellNavLink = { to: string; label: string }

// AppShell ve AdminShell'in ORTAK ust cubugu.
//
// Neden tek bilesen: iki kabuk da ayni yerlesim sorununu (logo + nav + aksiyon
// tek satira sigmiyor) bagimsiz cozmeye calisirsa dar ekranda iki farkli sekilde
// bozulur. Yerlesim kurali burada bir kez ifade edilir.
//
// KIRILMA NOKTASI lg (1024px), md DEGIL: Turkce etiketler uzun ("Ön
// Değerlendirme", "Görüşmelerim"). 768px'te masaustu satiri acildiginda logo +
// dort link + CTA + cikis 720px'lik kolona sigmiyordu ve sayfa yatay kayiyordu.
// Bu, tahmin degil OLCUM: dev sunucusu 320..1440 arasi sekiz genislikte gezilip
// documentElement.scrollWidth - clientWidth farkina bakildi.
//
// KRITIK KARAR — masaustu ve mobil AYRI AGACLAR:
// Daha once tek bir satir `flex-wrap` + `order-last`/`sm:order-none` ile iki
// duzene birden hizmet etmeye calisiyordu. Bu, kirilma noktasinin iki yaninda
// ogelerin GORSEL SIRASINI degistirir; kullanicinin gordugu "mobil goruntuye
// gecip geri donunce bilesenlerin yeri kayiyor" tam olarak budur ve masaustunde
// butonlar nav linklerinin ONUNE dusuyordu. Burada masaustu satiri (`hidden
// lg:flex`) ile mobil panel (`lg:hidden`) AYRI dugumlerdir: her genislikte tek
// bir duzen canlidir, aralarinda "kayma" diye bir sey olamaz.
export function ShellHeader({
  homeTo,
  homeLabel,
  badge,
  links,
  actions,
  className,
  containerClassName = 'max-w-6xl',
}: {
  homeTo: string
  homeLabel: string
  /** Admin kabugundaki "ADMIN" rozeti gibi logo yani isaret. */
  badge?: ReactNode
  links: ShellNavLink[]
  /**
   * CTA/cikis gibi aksiyonlar. Hem masaustu satirinda hem mobil panelde
   * render edilir; iceride `w-full lg:w-auto` kullanilmasi beklenir —
   * iki dal birbirini disladigi icin her ogeye tek bir deger uygulanir.
   */
  actions: ReactNode
  className?: string
  /**
   * Icerik kolonunun genisligi — kabugun `main` elemaniyla AYNI olmali,
   * yoksa logo ile sayfa basligi ayni dikey cizgiye oturmaz (kullanici
   * panelinde max-w-5xl, admin panelinde max-w-6xl).
   */
  containerClassName?: string
}) {
  const location = useLocation()
  const { t } = useTranslation('appShell')
  const [open, setOpen] = useState(false)
  const panelId = useId()

  // Menu, sayfa degisince kapanir — acik kalirsa kullanici yeni sayfayi
  // panelin arkasindan gorur.
  useEffect(() => setOpen(false), [location.pathname])

  // Masaustu genisligine cikildiginda menu state'i SIFIRLANIR. Panelin kendisi
  // zaten `lg:hidden` oldugu icin gorunmez olurdu, ama state acik kalsaydi
  // ekran tekrar daraldiginda menu kendiliginden acik geliyordu.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => {
      if (mq.matches) setOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur',
        className,
      )}
    >
      <div className={cn(
          'mx-auto flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6',
          containerClassName,
        )}>
        <Link to={homeTo} aria-label={homeLabel} className="shrink-0">
          <Logo className="h-8 w-24 sm:h-10 sm:w-28" />
        </Link>
        {badge}

        <nav className="ml-2 hidden items-center gap-1 text-sm lg:flex">
          {links.map((link) => (
            <NavItem key={link.to} link={link} pathname={location.pathname} />
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">{actions}</div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? t('menu.close') : t('menu.open')}
          className="ml-auto inline-flex size-10 items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)] lg:hidden"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </div>

      {/* Kosullu render (CSS ile gizleme DEGIL): kapaliyken linkler DOM'da hic
          bulunmaz, boylece ayni ada sahip iki baglanti (masaustu + mobil)
          erisilebilirlik agacinda ve testlerde cakismaz. */}
      {open && (
        <div
          id={panelId}
          className="border-t border-[var(--color-border)] bg-[var(--color-surface)] lg:hidden"
        >
          <nav className={cn('mx-auto flex flex-col gap-1 px-4 py-3 sm:px-6', containerClassName)}>
            {links.map((link) => (
              <NavItem key={link.to} link={link} pathname={location.pathname} block />
            ))}
          </nav>
          <div className={cn(
              'mx-auto flex flex-col gap-2 border-t border-[var(--color-border)] px-4 py-3 sm:px-6',
              containerClassName,
            )}>
            {actions}
          </div>
        </div>
      )}
    </header>
  )
}

function NavItem({
  link,
  pathname,
  block = false,
}: {
  link: ShellNavLink
  pathname: string
  block?: boolean
}) {
  const active = pathname.startsWith(link.to)
  return (
    <Link
      to={link.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-md font-medium transition-colors',
        // Mobilde dokunma hedefi >=44px: block dalinda dikey bosluk buyur.
        block ? 'px-3 py-2.5 text-[15px]' : 'px-3 py-1.5 whitespace-nowrap',
        active
          ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
      )}
    >
      {link.label}
    </Link>
  )
}
