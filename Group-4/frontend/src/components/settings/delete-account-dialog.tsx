import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslation } from '@/lib/i18n/language-provider'
import { INPUT_CLASS } from '@/lib/ui-styles'
import { ApiError, deleteAccount } from '@/lib/users-client'
import { signOut } from '@/lib/auth-client'

// Hesap silme onayi. Onay bicimi hesabin turune gore degisir:
//   - Parolali hesap -> mevcut sifre tekrar girilir (yanlislikla tetiklemeyi ve
//     acik birakilmis oturumun kotuye kullanilmasini birlikte engeller).
//   - Yalnizca-Google hesap -> dogrulanacak sifre YOKTUR; "geri alinamaz"
//     onay kutusu isaretlenir.
// Ayni ayrimi sunucu da yapar (Ilke V) — buradaki secim salt UX'tir.
//
// AlertDialogAction KULLANILMAZ: Radix onu tiklandiginda dialogu kosulsuz
// kapatir, oysa hatali sifrede dialog acik kalip hatayi gostermeli.
export function DeleteAccountDialog({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation('settings')
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const canSubmit = hasPassword ? password.length > 0 : confirmed

  function reset(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setPassword('')
      setConfirmed(false)
      setError(null)
    }
  }

  async function handleDelete() {
    setPending(true)
    setError(null)
    try {
      await deleteAccount(hasPassword ? { password } : { confirm: true })
      // Oturum kaydi cascade ile zaten dustu; signOut yalnizca cerezi temizler
      // ve basarisiz olabilir — akisi durdurmasina izin verilmez.
      await signOut().catch(() => undefined)
      // Tam sayfa yenilemesi: bellekteki oturum onbellegi de sifirlansin.
      window.location.assign('/')
    } catch (err) {
      setPending(false)
      setError(messageFor(err, hasPassword, t))
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={reset}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
        >
          <Trash2 aria-hidden className="size-4" />
          {t('deleteAccount.trigger')}
        </button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteAccount.dialogTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteAccount.dialogDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasPassword ? (
          <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text)]">
            {t('deleteAccount.passwordLabel')}
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        ) : (
          <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-danger)]"
            />
            {t('deleteAccount.confirmLabel')}
          </label>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t('deleteAccount.cancel')}
          </AlertDialogCancel>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canSubmit || pending}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--color-danger)] px-4 py-2 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {!pending && <Trash2 aria-hidden className="size-4" />}
            {pending ? t('deleteAccount.deleting') : t('deleteAccount.confirm')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function messageFor(
  err: unknown,
  hasPassword: boolean,
  t: (key: string) => string,
): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return t('deleteAccount.errors.invalidPassword')
    if (err.status === 403) return t('deleteAccount.errors.forbidden')
    if (err.status === 400) {
      return hasPassword
        ? t('deleteAccount.errors.invalidPassword')
        : t('deleteAccount.errors.notConfirmed')
    }
  }
  return t('deleteAccount.errors.generic')
}
