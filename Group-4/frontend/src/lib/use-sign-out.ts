import { useNavigate } from 'react-router-dom'
import { signOut } from '@/lib/auth-client'

// AppShell header'i ve Ayarlar sayfasi ayni cikis mantigini paylasir.
export function useSignOut() {
  const navigate = useNavigate()

  return async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }
}
