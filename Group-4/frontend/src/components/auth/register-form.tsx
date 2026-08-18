import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { emailSchema, passwordSchema, firstZodError } from '@/lib/validation'
import { BUTTON_CLASS } from '@/lib/ui-styles'
import { Ayirici } from '@/components/auth/auth-card'
import { AuthField } from '@/components/auth/auth-field'
import { GoogleButton } from '@/components/auth/google-button'
import { PasswordStrength } from '@/components/auth/password-strength'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 1: e-posta/sifre ile kayit formu. Istemci tarafi dogrulama yalnizca UX icindir;
// gercek yetki/dogrulama sunucu tarafindadir (Ilke V).
//
// 007-ui-design "Screen - Register": ad soyad + e-posta + sifre (odaklandiginda
// guc gostergesi) + sifre tekrar.
//
// Sartlar onayi burada TOPLANMAZ (issue #71): buradaki onay kutusu sunucuya hic
// gitmiyordu ve Google ile giren kullanici forma ugramadigi icin onayi tamamen
// atliyordu. Onay artik ilk giriste ConsentGateDialog ile aliniyor; asagidaki
// not yalnizca kullaniciyi bundan haberdar eder.
export function RegisterForm() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [name, setName] = useState('')
  const [sifreOdakli, setSifreOdakli] = useState(false)
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const clientError =
      firstZodError(emailSchema.safeParse(email)) ??
      firstZodError(passwordSchema.safeParse(password)) ??
      // Sifre tekrari yalnizca istemci tarafi bir kontroldur; sunucuya boyle
      // bir alan gitmez.
      (password !== passwordAgain ? t('registerForm.passwordMismatchError') : undefined)
    if (clientError) {
      setStatus('error')
      setError(clientError)
      return
    }

    setStatus('loading')
    const { error: signUpError } = await authClient.signUp.email({
      email,
      password,
      name,
    })
    if (signUpError) {
      setStatus('error')
      setError(signUpError.message ?? t('registerForm.genericError'))
      return
    }
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg bg-[var(--color-success-soft)] p-4">
        <p className="text-sm font-medium text-[var(--color-text)]">
          {t('registerForm.successMessage')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <AuthField
          id="register-name"
          label={t('registerForm.namePlaceholder')}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <AuthField
          id="register-email"
          label={t('registerForm.emailPlaceholder')}
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          id="register-password"
          label={t('registerForm.passwordPlaceholder')}
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setSifreOdakli(true)}
          onBlur={() => setSifreOdakli(false)}
        >
          {sifreOdakli && <PasswordStrength value={password} />}
        </AuthField>
        <AuthField
          id="register-password-again"
          label={t('registerForm.passwordAgainPlaceholder')}
          type="password"
          required
          autoComplete="new-password"
          value={passwordAgain}
          onChange={(e) => setPasswordAgain(e.target.value)}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button
          type="submit"
          disabled={status === 'loading'}
          className={BUTTON_CLASS}
        >
          {status === 'loading' ? t('registerForm.submitting') : t('registerForm.submit')}
        </button>
      </form>
      <Ayirici />
      <GoogleButton />
      <p className="text-xs text-[var(--color-text-muted)]">
        {t('registerForm.consentNote')}
      </p>
    </div>
  )
}
