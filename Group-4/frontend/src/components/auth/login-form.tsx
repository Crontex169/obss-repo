import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authClient, refreshSession } from '@/lib/auth-client'
import { emailSchema, firstZodError } from '@/lib/validation'
import { BUTTON_CLASS } from '@/lib/ui-styles'
import { Ayirici } from '@/components/auth/auth-card'
import { AuthField } from '@/components/auth/auth-field'
import { GoogleButton } from '@/components/auth/google-button'
import { ResendVerification } from '@/components/auth/resend-verification'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 2: e-posta/sifre ile giris formu. "Beni hatirla" -> rememberMe (US6, 30 gun).
//
// 007-ui-design: giris IKI ADIM ("Screen - Login (Email Step)" ve
// "(Password Step)"). Adim gecisi TAMAMEN ISTEMCI TARAFIDIR — e-postanin
// kayitli olup olmadigini soran bir ara istek YOK. Boyle bir istek, sifre
// ekranina gecip gecmemekle hesabin varligini ifsa ederdi; docs/API_CONVENTIONS
// §2 ve FR-002 bunu yasakliyor. Bu yuzden ilk adimda yalnizca bicim dogrulanir.
export function LoginForm() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [adim, setAdim] = useState<'eposta' | 'sifre'>('eposta')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  // 009: yalnizca "hesap dogrulanmadi" hatasinda telafi yolu acilir; diger
  // hatalarda (yanlis sifre vb.) gosterilmez.
  const [unverified, setUnverified] = useState(false)

  function handleEpostaSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientError = firstZodError(emailSchema.safeParse(email))
    if (clientError) {
      setStatus('error')
      setError(clientError)
      return
    }
    setStatus('idle')
    setError('')
    setAdim('sifre')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setUnverified(false)

    setStatus('loading')
    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      rememberMe,
    })
    if (signInError) {
      setStatus('error')
      // FR-019: dogrulanmamis hesap 403 EMAIL_NOT_VERIFIED alir. Bu dalda
      // kullaniciya ne olduguna dair ANLASILIR bir mesaj ve telafi yolu
      // verilir; diger kimlik hatalari genel kalmaya devam eder
      // (docs/API_CONVENTIONS.md §2 — "e-posta yok"/"sifre yanlis" ayrimi yok).
      const notVerified =
        (signInError as { code?: string }).code === 'EMAIL_NOT_VERIFIED'
      setUnverified(notVerified)
      setError(
        notVerified
          ? t('loginForm.unverifiedError')
          : (signInError.message ?? t('loginForm.genericError')),
      )
      return
    }
    // Yonlendirmeden ONCE oturum store'u tazelenir; aksi halde ProtectedRoute
    // bayat atom'u okuyup /login'e geri atiyor (bkz. lib/auth-client.ts).
    await refreshSession()
    setStatus('idle')
    // 005-admin: admin rolu bu formdan girdiginde kullanici paneline dusup
    // cikmaz sokakta kalmasin — admin ekranlarina yonlendirilir. Rol sunucudan
    // gelir (better-auth additionalFields, input:false); gercek yetki yine
    // sunucudaki RolesGuard'dadir, bu yalnizca yonlendirme.
    // I4' (001 T098): SPA gecisi — tam sayfa yenilemesi gereksiz.
    const role = (data?.user as { role?: string } | undefined)?.role
    navigate(role === 'admin' ? '/admin/dashboard' : '/dashboard')
  }

  /* data-testid: e2e secicisi renk sinifina baglanmasin — tasarim token
     gecisinde 'text-red-600' degisince S2 testi sessizce eskimisti. */
  const hataSatiri = error && (
    <p data-testid="login-error" className="text-sm text-[var(--color-danger)]">
      {error}
    </p>
  )

  if (adim === 'eposta') {
    return (
      <div className="flex flex-col gap-5">
        <form onSubmit={handleEpostaSubmit} className="flex flex-col gap-5">
          <AuthField
            id="login-email"
            label={t('loginForm.emailPlaceholder')}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {hataSatiri}
          <button type="submit" className={BUTTON_CLASS}>
            {t('loginForm.continue')}
          </button>
        </form>
        <Ayirici />
        <GoogleButton />
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          {t('loginForm.consentNote')}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        {/* Govde fontu: v2.pen burada JetBrains Mono kullaniyordu ama kartin
            geri kalani Inter oldugu icin yamali duruyordu. */}
        <span className="text-sm font-medium text-[var(--color-text)]">
          {email}
        </span>
        <button
          type="button"
          onClick={() => {
            setAdim('eposta')
            setError('')
            setUnverified(false)
          }}
          className="text-[13px] font-medium text-[var(--color-accent-strong)]"
        >
          {t('loginForm.change')}
        </button>
      </div>
      <AuthField
        id="login-password"
        label={t('loginForm.passwordPlaceholder')}
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-3.5 w-3.5 rounded-[3px] border-[var(--color-border)] accent-[var(--color-accent-strong)]"
          />
          {t('loginForm.rememberMe')}
        </label>
        {/* 006-sifre-sifirlama US1: sifirlama akisinin giris noktasi */}
        <a
          href="/forgot-password"
          className="text-xs font-medium text-[var(--color-accent-strong)]"
        >
          {t('loginForm.forgotPassword')}
        </a>
      </div>
      {hataSatiri}
      {unverified && <ResendVerification email={email} />}
      <button
        type="submit"
        disabled={status === 'loading'}
        className={BUTTON_CLASS}
      >
        {status === 'loading' ? t('loginForm.submitting') : t('loginForm.submit')}
      </button>
    </form>
  )
}
