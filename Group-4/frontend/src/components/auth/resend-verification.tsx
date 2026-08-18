import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { INPUT_CLASS } from '@/lib/ui-styles'
import { useTranslation } from '@/lib/i18n/language-provider'

// 009: dogrulama maili telafisi. Iki cikmaz sokakta da kullanilir —
// giris ekraninda "hesap dogrulanmadi" hatasinin altinda (e-posta bilinir) ve
// verify-email sayfasinda suresi dolmus baglanti hatasinda (e-posta bilinmez,
// kullanicidan istenir).
//
// Guvenlik: yanit HER DURUMDA ayni genel mesajdir. Better Auth'un
// /send-verification-email ucu kayitsiz veya zaten dogrulanmis e-postada da
// 200 doner ve sahte token uretip zamanlamayi esitler (500 ms taban), yani
// sunucu tarafi hesap varligini ele vermez; istemci de vermemelidir
// (docs/API_CONVENTIONS.md §2). Hata durumunda bile ayni mesaj gosterilir.
//
// Hiz siniri: Better Auth'un yerlesik kurali bu yolu production'da
// 3 istek / 60 sn (IP basina) ile sinirlar — ayrica bir sey yazilmadi.
export function ResendVerification({ email }: { email?: string }) {
  const { t } = useTranslation('auth')
  const [typedEmail, setTypedEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  const target = email ?? typedEmail

  async function handleClick() {
    if (!target.trim()) return
    setSending(true)
    try {
      await authClient.sendVerificationEmail({ email: target })
    } catch {
      // Yutulur: basari/basarisizlik ayrimi kullaniciya YANSITILMAZ (yukaridaki
      // varlik gizliligi notu). Gercek hata sunucu loglarinda kalir.
    } finally {
      setSending(false)
      setSent(true)
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        {t('resendVerification.genericMessage')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {!email && (
        <label className="sr-only" htmlFor="resend-email">
          {t('resendVerification.emailPlaceholder')}
        </label>
      )}
      {!email && (
        <input
          id="resend-email"
          type="email"
          placeholder={t('resendVerification.emailPlaceholder')}
          value={typedEmail}
          onChange={(e) => setTypedEmail(e.target.value)}
          className={INPUT_CLASS}
        />
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={sending}
        className="self-start text-sm font-medium text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-strong)] disabled:opacity-50"
      >
        {sending ? t('resendVerification.submitting') : t('resendVerification.submit')}
      </button>
    </div>
  )
}
