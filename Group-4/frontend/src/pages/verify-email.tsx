import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authClient } from '@/lib/auth-client'
import { AuthCard } from '@/components/auth/auth-card'
import { ResendVerification } from '@/components/auth/resend-verification'
import { BUTTON_CLASS } from '@/lib/ui-styles'
import { useTranslation } from '@/lib/i18n/language-provider'

export default function VerifyEmailPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      return
    }
    authClient.verifyEmail({ query: { token } }).then(({ error }) => {
      setStatus(error ? 'error' : 'success')
    })
  }, [searchParams])

  return (
    <AuthCard title={t('verifyEmail.title')}>
      <div className="text-center">
        {status === 'loading' && (
          <p className="text-[var(--color-text-muted)]">{t('verifyEmail.verifying')}</p>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-[var(--color-success)]">{t('verifyEmail.success')}</p>
            <Link to="/login" className={BUTTON_CLASS + ' inline-block'}>
              {t('verifyEmail.login')}
            </Link>
          </div>
        )}
        {/* 009: eskiden burasi cikmaz sokakti — kullanici suresi dolmus linke
            tiklayinca yapabilecegi hicbir sey yoktu. Token yalnizca imzali bir
            deger oldugu ve e-postayi tasimadigi icin adres kullanicidan
            istenir. */}
        {status === 'error' && (
          <div className="flex flex-col items-start gap-3 text-left">
            <p className="text-[var(--color-danger)]">{t('verifyEmail.error')}</p>
            <ResendVerification />
          </div>
        )}
      </div>
    </AuthCard>
  )
}
