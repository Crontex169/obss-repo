import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { passwordSchema, firstZodError } from '@/lib/validation'
import { BUTTON_CLASS } from '@/lib/ui-styles'
import { AuthCard } from '@/components/auth/auth-card'
import { AuthField } from '@/components/auth/auth-field'
import { PasswordStrength } from '@/components/auth/password-strength'
import { useTranslation } from '@/lib/i18n/language-provider'

// 006-sifre-sifirlama US2/US3. Backend /request-password-reset ucundan gelen
// baglanti, Better Auth'un ara ucunda dogrulanip bu sayfaya `?token=...` ile
// yonlendirilir. Politika (min 8 + harf + rakam) sunucuda da uygulanir (FR-006);
// buradaki kontrol yalnizca UX icindir.
export default function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const tokenHatasi = searchParams.get('error')

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordAgain, setNewPasswordAgain] = useState('')
  const [sifreOdakli, setSifreOdakli] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const clientError =
      firstZodError(passwordSchema.safeParse(newPassword)) ??
      (newPassword !== newPasswordAgain
        ? t('registerForm.passwordMismatchError')
        : undefined)
    if (clientError) {
      setStatus('error')
      setError(clientError)
      return
    }

    setStatus('loading')
    const { error: resetError } = await authClient.resetPassword({
      newPassword,
      token,
    })
    if (resetError) {
      setStatus('error')
      // FR-009: sunucu, token'in neden gecersiz oldugunu ayirt etmeyen genel bir
      // mesaj doner; kullanici yeni bir istek baslatmaya yonlendirilir.
      setError(resetError.message ?? t('resetPassword.invalidLink'))
      return
    }
    setStatus('success')
  }

  // 007-ui-design "Screen - Reset Password Success": eskiden basarida dogrudan
  // /login'e atiliyordu; tasarim once bir onay ekrani gosteriyor. FR-008 geregi
  // tum oturumlar zaten sonlandirildi, kullanici yeni sifresiyle giris yapar.
  if (status === 'success') {
    return (
      <AuthCard
        title={t('resetPassword.successTitle')}
        subtitle={t('resetPassword.successSubtitle')}
      >
        <div className="flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-soft)]">
            <Check
              size={28}
              className="text-[var(--color-success)]"
              aria-hidden
            />
          </span>
        </div>
        <Link to="/login" className={BUTTON_CLASS + ' block text-center'}>
          {t('resetPassword.successCta')}
        </Link>
      </AuthCard>
    )
  }

  if (!token || tokenHatasi) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <p className="text-center text-sm text-[var(--color-danger)]">
          {t('resetPassword.invalidLink')}
        </p>
        <a
          href="/forgot-password"
          className="text-center text-[13px] font-semibold text-[var(--color-accent-strong)]"
        >
          {t('resetPassword.requestNew')}
        </a>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t('resetPassword.title')}
      subtitle={t('resetPassword.subtitle')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          id="reset-password"
          label={t('resetPassword.passwordPlaceholder')}
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          onFocus={() => setSifreOdakli(true)}
          onBlur={() => setSifreOdakli(false)}
        >
          {sifreOdakli && <PasswordStrength value={newPassword} />}
        </AuthField>
        <AuthField
          id="reset-password-again"
          label={t('resetPassword.passwordAgainPlaceholder')}
          type="password"
          required
          autoComplete="new-password"
          value={newPasswordAgain}
          onChange={(e) => setNewPasswordAgain(e.target.value)}
        />
        {/* data-testid: e2e secicisi renk sinifina baglanmasin (login
            formunda ayni sorun yasanmisti — bkz. auth-flows.spec.ts). */}
        {error && (
          <p
            data-testid="reset-error"
            className="text-sm text-[var(--color-danger)]"
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'loading'}
          className={BUTTON_CLASS}
        >
          {status === 'loading' ? t('resetPassword.submitting') : t('resetPassword.submit')}
        </button>
      </form>
    </AuthCard>
  )
}
