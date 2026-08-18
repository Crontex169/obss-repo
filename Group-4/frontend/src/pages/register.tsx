import { Link } from 'react-router-dom'
import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'
import { useTranslation } from '@/lib/i18n/language-provider'

// 007-ui-design "Screen - Register": giris ekrani gibi bassiz — logo dogrudan
// alanlarla devam eder. Ayirici/Google/onay kutusu RegisterForm icinde.
export default function RegisterPage() {
  const { t } = useTranslation('auth')

  return (
    <AuthCard
      footer={
        <>
          {t('register.haveAccount')}{' '}
          <Link
            to="/login"
            className="font-semibold text-[var(--color-accent-strong)]"
          >
            {t('register.login')}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  )
}
