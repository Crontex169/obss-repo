import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '@/lib/auth-client'

// 005-admin T007: oturum + role==='admin' kontrolu. routes/protected.tsx'teki
// ProtectedRoute DEGISTIRILMEZ (001-auth-rol sahipligi), bu ayri bir sarmalayici.
//
// Bu yalnizca istemci tarafi UX katmanidir; gercek yetki sunucuda RolesGuard ile
// uygulanir (Ilke V — istemci gizlemesi tek basina yeterli sayilmaz).
export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession()

  if (isPending) return null
  if (!data?.session) return <Navigate to="/admin/login" replace />

  // role, Better Auth additionalFields ile oturum kullanicisinda tasinir
  // (backend/src/auth/better-auth.config.ts, input:false — istemci yazamaz).
  const role = (data.user as { role?: string } | undefined)?.role
  if (role !== 'admin') return <Navigate to="/dashboard" replace />

  return <>{children}</>
}
