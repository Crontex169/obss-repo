import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/logo'
import { useSession } from '@/lib/auth-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// Herkese acik inis sayfasi — 007-ui-design/v2.pen "Screen - Landing" frame'i
// referans: acik (light) tema, Nav + Hero (metin + genis mock onizleme karti)
// + Steps (01/02/03). Oturum varsa CTA'lar /dashboard'a doner.
//
// "Tek ekrana sigsin, scroll olmasin" kurali YALNIZCA lg ve ustunde gecerlidir.
// Kosulsuz `h-screen overflow-hidden` idi: dar ya da kisa ekranda (telefon,
// yatay tablet, kucultulmus pencere) icerik ekrandan tasiyor ve overflow-hidden
// onu KIRPIYORDU — kullanici adimlari ve CTA'yi hic goremiyor, kaydiramiyordu
// da. Kucuk ekranda dogru davranis normal akis + dogal kaydirmadir.
export default function HomePage() {
  const { t } = useTranslation('home')
  const { data } = useSession()
  const authed = Boolean(data?.session)

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] lg:h-screen lg:overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link
            to={authed ? '/dashboard' : '/login'}
            className="rounded-[11px] bg-[var(--color-accent-strong)] px-[18px] py-[11px] text-[13.5px] font-semibold text-white transition-colors hover:opacity-90"
          >
            {authed ? t('nav.goToDashboard') : t('nav.login')}
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-8 px-4 pt-4 pb-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-10 lg:pt-0 lg:pb-0">
        <div className="w-full max-w-[440px]">
          <h1 className="font-display text-[28px] leading-[1.15] font-semibold tracking-[-0.5px] text-[var(--color-text)] sm:text-[34px] sm:tracking-[-1px] lg:text-[38px]">
            {t('hero.title')}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.6] text-[var(--color-text-muted)]">
            {t('hero.description')}
          </p>
          <div className="mt-6">
            <Link
              to={authed ? '/interview/new' : '/register'}
              className="inline-flex items-center gap-[9px] rounded-xl bg-[var(--color-accent-strong)] px-6 py-[13px] text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              {t('hero.cta')}
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* Steps — ayni ekrana sigsin diye Hero'nun altina, sol kolonda. */}
          <div className="mt-10 flex flex-col gap-5 border-t border-[var(--color-border)] pt-6">
            {(t('steps', { returnObjects: true }) as { title: string; body: string }[]).map(
              (step, i) => (
                <div key={step.title} className="flex items-start gap-3">
                  <p className="font-data pt-0.5 text-xs font-bold text-[var(--color-accent-strong)]">
                    {String(i + 1).padStart(2, '0')}
                  </p>
                  <div>
                    <h2 className="font-display text-sm font-semibold text-[var(--color-text)]">
                      {step.title}
                    </h2>
                    <p className="text-xs leading-[1.5] text-[var(--color-text-muted)]">
                      {step.body}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Mock onizleme karti — v2.pen "Mock Card": progress + soru/cevap
            balonlari + aktif soru + gonder/cik aksiyonlari. Statik ve
            tiklanamaz.
            - Telefonda (< sm) HIC gosterilmez: `aria-hidden` bir SUS ogesidir,
              bilgi tasimaz; dar ekranda ise CTA ve adimlari asagi iterek
              ekranin yarisini yerdi.
            - 16/9 orani yalnizca lg'de: dar kolonda o oran karti 200 px
              yuksekliğe sikistirip icerigi tasiriyordu, kucuk ekranda yukseklik
              icerikten belirlenir. */}
        <div
          aria-hidden
          className="hidden w-full flex-col justify-between gap-4 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_18px_44px_-14px_rgba(11,18,32,0.12)] sm:flex sm:p-6 lg:aspect-[16/9] lg:gap-0"
        >
          <div>
            <div className="flex items-center gap-3">
              <p className="font-data text-[13.5px] font-semibold whitespace-nowrap text-[var(--color-accent-strong)]">
                Soru 3/8
              </p>
              <div className="h-[7px] w-full rounded-full bg-[var(--color-bg-muted)]">
                <div className="h-full w-[38%] rounded-full bg-[var(--color-accent-strong)]" />
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-[13px] py-[11px]">
                <p className="text-[12.5px] leading-[1.5] text-[var(--color-text)]">
                  Aşağıdakilerden hangisi görüntü sınıflandırmada yaygın olarak
                  kullanılan bir derin öğrenme mimarisidir?
                </p>
              </div>
              <div className="flex justify-end">
                <div className="rounded-[10px] bg-[var(--color-accent-soft)] px-[13px] py-[9px]">
                  <p className="text-[12.5px] text-[var(--color-text)]">
                    Evrişimli Sinir Ağı (CNN)
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="font-data text-[11.5px] text-[var(--color-text-muted)]">
            Kalan süre: 78 sn
          </p>

          <div className="flex flex-col gap-[11px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
            <p className="text-[13.5px] leading-[1.45] font-semibold text-[var(--color-text)]">
              Python kullanarak iki matrisin çarpımını hesaplayan bir fonksiyon
              yazmanız istenseydi, adım adım nasıl bir yol izlerdiniz?
            </p>
            <div className="flex h-14 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-[11px]">
              <p className="text-[12.5px] text-[var(--color-text-muted)]">
                Cevabınızı yazın
              </p>
            </div>
          </div>

          <div className="flex items-center gap-[10px]">
            <div className="rounded-lg bg-[var(--color-accent)] px-[18px] py-[11px]">
              <p className="text-[12.5px] font-semibold text-white">
                Cevabı gönder
              </p>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-[11px]">
              <p className="text-[12.5px] font-medium text-[var(--color-text)]">
                Kaydet ve çık
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
