import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { emailSchema, firstZodError } from '@/lib/validation'
import { BUTTON_CLASS } from '@/lib/ui-styles'
import { AuthCard } from '@/components/auth/auth-card'
import { AuthField } from '@/components/auth/auth-field'
import { useTranslation } from '@/lib/i18n/language-provider'

// 006-sifre-sifirlama US1. FR-002: backend her durumda ayni genel yaniti doner;
// bu sayfa da hicbir ayrim YAPMAZ - hesabin var olup olmadigina dair tek kelime
// gostermez. Istemci dogrulamasi yalnizca bicim hatasi icindir (UX).
export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>(
    'idle',
  )
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const clientError = firstZodError(emailSchema.safeParse(email))
    if (clientError) {
      setStatus('error')
      setError(clientError)
      return
    }

    setStatus('loading')
    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) {
      setStatus('error')
      setError(resetError.message ?? t('forgotPassword.genericError'))
      return
    }
    setStatus('sent')
  }

  return (
    <AuthCard
      title={t('forgotPassword.title')}
      subtitle={status === 'sent' ? undefined : t('forgotPassword.description')}
    >
      {status === 'sent' ? (
        <p className="text-center text-sm text-[var(--color-text)]">
          {t('forgotPassword.sentMessage')}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AuthField
            id="forgot-email"
            label={t('forgotPassword.emailPlaceholder')}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className={BUTTON_CLASS}
          >
            {status === 'loading'
              ? t('forgotPassword.submitting')
              : t('forgotPassword.submit')}
          </button>
        </form>
      )}
      <a
        href="/login"
        className="flex items-center justify-center gap-1 text-[13px] font-semibold text-[var(--color-accent-strong)]"
      >
        <ArrowLeft size={14} aria-hidden />
        {t('forgotPassword.backToLogin')}
      </a>
    </AuthCard>
  )
}
