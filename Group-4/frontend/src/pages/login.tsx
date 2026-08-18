import { Link, useSearchParams } from 'react-router-dom'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { ResendVerification } from '@/components/auth/resend-verification'
import { GoogleOneTap } from '@/components/auth/google-one-tap'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 3 kriter 3: Google akisi iptal/hata -> errorCallbackURL bu sayfaya
// ?error=google_failed ile doner, kullaniciya bilgi mesaji gosterilir.
//
// Parametrenin DEGERINE bakilmaz, VARLIGINA bakilir: state suresi dolmus ya da
// tekrar kullanilmissa hata backend'in onAPIError.errorURL'inden gelir ve kodu
// better-auth koyar (`state_mismatch` gibi). Degere esitlik arayan eski kontrol
// bu durumu kacirip sayfayi sessizce normal gosteriyordu.
//
// 007-ui-design: giris ekraninda baslik YOK (logo dogrudan alanlarla devam
// eder); ayirici + Google butonu formun e-posta adiminin parcasi oldugu icin
// artik LoginForm icinde — burada TEKRARLANMAZ.
// `account_not_linked`: bu e-postayla parolali bir kayit VAR ama dogrulanmamis.
// Better Auth, saglayici guvenilir olsa bile yerel hesap dogrulanmadan
// baglamaz (accountLinking.requireLocalEmailVerified) — dogrulanmamis bir
// kaydin sahibi kanitli olmadigi icin bu KASITLI bir guvenlik kuralidir
// (bkz. backend/test/integration/us3-account-linking.spec.ts). Kullaniciya
// genel "tekrar deneyin" demek cikmaz sokak olurdu: yapmasi gereken sey
// belli, once e-postasini dogrulamasi lazim.
export default function LoginPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const googleFailed = searchParams.has('error')
  const baglanamadi = searchParams.get('error') === 'account_not_linked'

  return (
    <AuthCard
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link
            to="/register"
            className="font-semibold text-[var(--color-accent-strong)]"
          >
            {t('login.register')}
          </Link>
        </>
      }
    >
      <GoogleOneTap />
      {googleFailed && (
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2">
          <p className="text-sm text-[var(--color-danger)]">
            {baglanamadi ? t('login.accountNotLinked') : t('login.googleFailed')}
          </p>
          {baglanamadi && <ResendVerification />}
        </div>
      )}
      <LoginForm />
    </AuthCard>
  )
}
