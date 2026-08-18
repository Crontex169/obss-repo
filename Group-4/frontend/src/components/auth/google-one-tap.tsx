import { useEffect, useRef } from 'react'
import { promptGoogleOneTap, useSession } from '@/lib/auth-client'

// Google One Tap: sayfa acilir acilmaz sag-ust kosede kendiliginden beliren
// Google giris istemi. google-button.tsx'teki manuel-tiklama akisiyla AYNI
// backend hesap-baglama/FR-006 kurallarina tabidir (bkz.
// backend/src/auth/hooks/oauth-link.hook.ts - rejectAdminGoogleOneTapSignIn).
//
// callbackURL mutlak olmali (google-button.tsx'teki ayni gerekce): One Tap
// basari sonrasi backend'e degil DOGRUDAN bu URL'e window.location.href ile
// yonlendirir.
export function GoogleOneTap() {
  const { data, isPending } = useSession()
  // main.tsx StrictMode geliştirmede efekti iki kez calistirir; bu bayrak
  // olmadan google.accounts.id.initialize() iki kez tetiklenir (konsolda
  // "called multiple times" uyarisi + yarisan One Tap istegi).
  const requested = useRef(false)

  useEffect(() => {
    // Zaten oturum acmis kullaniciya tekrar istem gosterilmez.
    if (isPending || data?.session || requested.current) return
    requested.current = true

    void promptGoogleOneTap(`${window.location.origin}/dashboard`)
  }, [isPending, data?.session])

  return null
}
