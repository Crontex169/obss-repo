import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { AuthCard } from '@/components/auth/auth-card'
import { INPUT_CLASS, BUTTON_CLASS } from '@/lib/ui-styles'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 4: admin girisi yalnizca e-posta/sifre (Google butonu yok, sunucu
// admin icin Google'i zaten reddeder — FR-006). Yetki kontrolu sunucuda
// (RolesGuard); bu form yalnizca UX.
export default function AdminLoginPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    })
    if (signInError) {
      setStatus('error')
      setError(signInError.message ?? t('adminLogin.genericError'))
      return
    }
    setStatus('idle')
    // 005-admin: admin paneli artik mevcut. Rol dogrulamasi AdminProtectedRoute
    // + sunucudaki RolesGuard'da yapilir; rolu admin olmayan bir kullanici bu
    // formdan giris yapsa bile panele giremez.
    window.location.href = '/admin/dashboard'
  }

  return (
    <AuthCard title={t('adminLogin.title')} subtitle={t('adminLogin.subtitle')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <label htmlFor="admin-email" className="sr-only">
          {t('adminLogin.emailPlaceholder')}
        </label>
        <input
          id="admin-email"
          type="email"
          placeholder={t('adminLogin.emailPlaceholder')}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
        <label htmlFor="admin-password" className="sr-only">
          {t('adminLogin.passwordPlaceholder')}
        </label>
        <input
          id="admin-password"
          type="password"
          placeholder={t('adminLogin.passwordPlaceholder')}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        <button type="submit" disabled={status === 'loading'} className={BUTTON_CLASS}>
          {status === 'loading' ? t('adminLogin.submitting') : t('adminLogin.submit')}
        </button>
      </form>
    </AuthCard>
  )
}
