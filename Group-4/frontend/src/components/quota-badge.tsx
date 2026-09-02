import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/lib/i18n/language-provider'
import { getKvkkConsentStatus } from '@/lib/users-client'

// 010-odeme-abonelik US4: bu ayki kullanilan/toplam gorusme hakki.
//
// Sayilar HESAPLANMAZ, sunucudan oldugu gibi gosterilir: kotayi uygulayan
// guard ile ayni kaynaktan (billing/plan.ts) gelirler. Istemcide ikinci bir
// hesap yapilsaydi arayuz "hakkin var" derken sunucu 402 donebilirdi.
interface Quota {
  used: number
  limit: number
}

export function QuotaBadge() {
  const { t } = useTranslation('billing')
  const [quota, setQuota] = useState<Quota | null>(null)

  useEffect(() => {
    let cancelled = false
    void getKvkkConsentStatus()
      .then((status) => {
        if (cancelled) return
        setQuota({
          used: status.interviewsUsed,
          limit: status.interviewsLimit,
        })
      })
      .catch(() => {
        // Kota okunamazsa rozet HIC gosterilmez. Yanlis bir sayi gostermek,
        // hic gostermemekten kotudur.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!quota) return null

  const exhausted = quota.used >= quota.limit

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={
          exhausted
            ? 'text-[var(--color-danger)]'
            : 'text-[var(--color-text-muted)]'
        }
      >
        {exhausted
          ? t('quota.exhausted')
          : t('quota.label', { used: quota.used, limit: quota.limit })}
      </span>
      {exhausted ? (
        <Link
          to="/billing"
          className="font-medium text-[var(--color-accent)] underline"
        >
          {t('quota.upgradeCta')}
        </Link>
      ) : null}
    </div>
  )
}
