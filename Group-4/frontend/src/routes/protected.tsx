import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'

// Istemci tarafi yonlendirme yalnizca UX icindir; gercek yetki sunucuda
// (SessionGuard/RolesGuard) uygulanir (FR-011, Ilke V). Bu dilimde korunacak
// gercek bir sayfa henuz yok (bkz. spec Kapsam Notu); bu bilesen sonraki
// dilimlerin korumali sayfalarinca sarmalayici olarak kullanilacak.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession()

  if (isPending) return null
  if (!data?.session) return <Navigate to="/login" replace />

  return <>{children}</>
}
