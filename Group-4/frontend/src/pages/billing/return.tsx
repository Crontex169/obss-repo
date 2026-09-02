import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/language-provider'
import { getKvkkConsentStatus } from '@/lib/users-client'

// 010-odeme-abonelik US2: odeme sonrasi donus sayfasi (`success_url` hedefi).
//
// BU SAYFA PLANI YUKSELTMEZ — yalnizca OKUR (spec.md FR-012). Yukseltme
// yalnizca imzasi dogrulanmis webhook ile yapilir; bu adrese guvenilseydi
// kullanici adresi dogrudan acarak kendine ucretsiz plan yukseltmesi
// yaptirabilirdi.
//
// Webhook, kullanici buraya donmeden once ulasmis olmayabilir; o yuzden plan
// degisene kadar kisa sureli yoklanir.
const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 30_000

type State = 'processing' | 'success' | 'timeout'

export default function BillingReturnPage() {
  const { t } = useTranslation('billing')
  const [state, setState] = useState<State>('processing')

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      if (cancelled) return
      try {
        const status = await getKvkkConsentStatus()
        if (cancelled) return
        if (status.plan !== 'free') {
          setState('success')
          return
        }
      } catch {
        // Gecici hata yoklamayi bitirmez; sure dolana kadar denenir.
      }

      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) setState('timeout')
        return
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const heading = t(`return.${state}`)
  const hint = t(`return.${state}Hint`)

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 text-center">
      <h1
        className="text-lg font-semibold text-[var(--color-text)]"
        role="status"
        aria-live="polite"
      >
        {heading}
      </h1>
      <p className="text-sm text-[var(--color-text-muted)]">{hint}</p>

      {state === 'processing' ? null : (
        <Button asChild>
          <Link to="/dashboard">{t('return.toDashboard')}</Link>
        </Button>
      )}
    </div>
  )
}
