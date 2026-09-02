import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n/language-provider'
import { getKvkkConsentStatus, type PlanTier } from '@/lib/users-client'
import {
  createCheckoutSession,
  createPortalSession,
  PAID_TIERS,
  TIER_QUOTA,
  type PaidTier,
} from '@/lib/billing-client'
import { cn } from '@/lib/utils'

// 010-odeme-abonelik US2: plan secimi.
//
// FIYAT GOSTERILMEZ. Tutar/para birimi/donem yalnizca Stripe'ta tanimlidir;
// buraya elle yazsaydik iki yer ayrisir ve kullaniciya yanlis fiyat gosterirdik.
// Gercek tutari kullanici, saglayicinin odeme sayfasinda gorur.
//
// Plan kartlari yalnizca KOTAYI anlatir — kademeler arasindaki tek fark odur
// (spec.md Assumptions: ozellik kilidi kapsam disi).
export default function PricingPage() {
  const { t } = useTranslation('billing')
  const [plan, setPlan] = useState<PlanTier | null>(null)
  const [pending, setPending] = useState<PaidTier | 'portal' | null>(null)

  useEffect(() => {
    let cancelled = false
    void getKvkkConsentStatus()
      .then((status) => {
        if (!cancelled) setPlan(status.plan)
      })
      .catch(() => {
        // Plan okunamazsa sayfa yine kullanilabilir kalir: kartlar cizilir,
        // yalnizca "mevcut planin" isareti gosterilmez.
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleUpgrade(tier: PaidTier) {
    setPending(tier)
    try {
      const url = await createCheckoutSession(tier)
      // Saglayicinin barindirdigi sayfaya cikiyoruz; kart bilgisi bu
      // uygulamaya HIC ulasmaz.
      window.location.assign(url)
    } catch {
      toast.error(t('errors.checkout'))
      setPending(null)
    }
  }

  async function handleManage() {
    setPending('portal')
    try {
      window.location.assign(await createPortalSession())
    } catch {
      toast.error(t('errors.portal'))
      setPending(null)
    }
  }

  const isPaid = plan === 'pro' || plan === 'pro_plus'

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--color-text)] sm:text-2xl">
          {t('title')}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">{t('subtitle')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['free', ...PAID_TIERS] as PlanTier[]).map((tier) => {
          const current = plan === tier
          return (
            <section
              key={tier}
              className={cn(
                'flex flex-col rounded-lg border p-4',
                current
                  ? 'border-[var(--color-accent)]'
                  : 'border-[var(--color-border)]',
              )}
            >
              <h2 className="text-base font-semibold text-[var(--color-text)]">
                {t(`plans.${tier}.name`)}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                {t(`plans.${tier}.description`)}
              </p>

              <p className="mt-4 text-sm font-medium text-[var(--color-text)]">
                {t('interviewsPerMonth', { count: TIER_QUOTA[tier] })}
              </p>

              <div className="mt-4 flex-1" />

              {current ? (
                <p className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
                  <Check className="h-4 w-4" aria-hidden />
                  {t('current')}
                </p>
              ) : tier === 'free' ? null : (
                <Button
                  onClick={() => void handleUpgrade(tier as PaidTier)}
                  disabled={pending !== null}
                >
                  {pending === tier ? t('redirecting') : t('upgrade')}
                </Button>
              )}
            </section>
          )
        })}
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        {t('sameFeatures')}
      </p>

      {isPaid ? (
        <section className="space-y-2 rounded-lg border border-[var(--color-border)] p-4">
          <Button
            variant="outline"
            onClick={() => void handleManage()}
            disabled={pending !== null}
          >
            {t('manage')}
          </Button>
          <p className="text-sm text-[var(--color-text-muted)]">
            {t('manageHint')}
          </p>
        </section>
      ) : null}
    </div>
  )
}
