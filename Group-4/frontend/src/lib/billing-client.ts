// 010-odeme-abonelik: odeme uclariyla konusan istemci.
//
// FIYAT BURADA YOK. Tutar, para birimi ve fatura donemi Stripe'ta tanimlidir;
// uygulama fiyati ne saklar ne dogrular. Arayuz yalnizca KOTAYI anlatir.
import { ApiError, type ApiErrorBody } from './users-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type PlanTier = 'free' | 'pro' | 'pro_plus'

/** Satin alinabilir kademeler — `free` satin alinmaz. */
export type PaidTier = Exclude<PlanTier, 'free'>

export const PAID_TIERS: PaidTier[] = ['pro', 'pro_plus']

// Kota matrisinin arayuz kopyasi. Sunucu (billing/plan.ts) tek dogruluk
// kaynagidir; buradaki degerler yalnizca HENUZ /me yaniti gelmemisken plan
// kartlarini cizmek icindir. Kullanicinin GERCEK hakki daima /me'den gelen
// interviewsUsed/interviewsLimit ile gosterilir.
export const TIER_QUOTA: Record<PlanTier, number> = {
  free: 3,
  pro: 50,
  pro_plus: 100,
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json()
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody)
  return body as T
}

// §POST /api/billing/checkout — saglayicinin barindirdigi odeme sayfasinin
// adresini doner. Kart bilgisi O SAYFADA girilir, bu uygulamaya hic ulasmaz.
export async function createCheckoutSession(tier: PaidTier): Promise<string> {
  const res = await fetch(`${API_URL}/api/billing/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }),
  })
  const { url } = await parse<{ url: string }>(res)
  return url
}

// §POST /api/billing/portal — odeme yontemi degistirme, plan degistirme ve
// iptal saglayicinin kendi ekraninda yapilir.
export async function createPortalSession(): Promise<string> {
  const res = await fetch(`${API_URL}/api/billing/portal`, {
    method: 'POST',
    credentials: 'include',
  })
  const { url } = await parse<{ url: string }>(res)
  return url
}
