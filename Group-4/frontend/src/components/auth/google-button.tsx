import { authClient } from '@/lib/auth-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 3: Google ile giris/kayit (kullanici; admin girisinde bu buton yok,
// bkz. pages/admin/login.tsx). Iptal/hata -> errorCallbackURL ile bu sayfaya
// ?error= parametresiyle geri doner (kriter 3, login.tsx tarafindan gosterilir).
//
// callbackURL/errorCallbackURL MUTLAKA MUTLAK (absolute) URL olmali: OAuth akisi
// backend'in /api/auth/callback/google ucundan sunucu-tarafi 302 ile doner, o
// yanit goreceli bir yolu (orn. "/dashboard") KENDI origin'ine (backend, :3000)
// gore cozer, frontend'e (:5173) degil -> "Cannot GET /dashboard" hatasi.
export function GoogleButton() {
  const { t } = useTranslation('auth')

  function handleClick() {
    // Merge notu (2026-08-04): ayni mutlak-URL duzeltmesi iki dalda bagimsiz
    // yapilmisti. Hedef '/dashboard' secildi — birlesik surumde giris sonrasi
    // inis sayfasi orasi (login-form.tsx ile ayni), '/' ise karsilama sayfasi.
    void authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
      errorCallbackURL: `${window.location.origin}/login?error=google_failed`,
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-muted)]"
    >
      <GoogleIcon />
      {t('googleButton.label')}
    </button>
  )
}

// Google marka rehberi renkleri (v2.pen "Google Icon"). lucide-react'te marka
// logosu yok, bu yuzden satir ici SVG.
function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 18 18"
      width="16"
      height="16"
      aria-hidden
      focusable="false"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  )
}
