import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Link2, X } from 'lucide-react'
import { ApiError, createShareLink, revokeShareLink } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// Rapor paylasim linki: link BILEN HERKESE aciktir ve 7 gun sonra kendiliginden
// olur (sunucu kurali). Kullanici iptal edebilir.
//
// Link burada URL olarak kurulur (sunucu yalnizca token doner): frontend'in
// hangi adreste yayinlandigini yalnizca frontend bilir.
export function ShareReportButton({ interviewId }: { interviewId: string }) {
  const { t, i18n } = useTranslation('interview')
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleShare() {
    setBusy(true)
    try {
      const created = await createShareLink(interviewId)
      const url = `${window.location.origin}/r/${created.token}`
      setLink({ url, expiresAt: created.expiresAt })
      await copy(url)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('share.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function copy(url: string) {
    // clipboard API guvenli baglam (https/localhost) disinda YOKTUR; kopyalama
    // basarisiz olsa da link ekranda duruyor, kullanici elle secebilir.
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('share.copied'))
    } catch {
      toast.message(t('share.copyManually'))
    }
  }

  async function handleRevoke() {
    setBusy(true)
    try {
      await revokeShareLink(interviewId)
      setLink(null)
      toast.success(t('share.revoked'))
    } catch {
      toast.error(t('share.revokeFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (!link) {
    return (
      <button
        type="button"
        onClick={() => void handleShare()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
      >
        <Link2 aria-hidden className="size-4" />
        {busy ? t('share.creating') : t('share.create')}
      </button>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link.url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-2 py-1.5 font-data text-xs text-[var(--color-text)]"
        />
        <button
          type="button"
          onClick={() => void copy(link.url)}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          <Copy aria-hidden className="size-3.5" />
          {t('share.copy')}
        </button>
        <button
          type="button"
          onClick={() => void handleRevoke()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] hover:border-[var(--color-danger)] disabled:opacity-50"
        >
          <X aria-hidden className="size-3.5" />
          {t('share.revoke')}
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">
        {t('share.expiresAt', {
          date: new Date(link.expiresAt).toLocaleString(
            i18n.language === 'en' ? 'en-US' : 'tr-TR',
          ),
        })}
      </p>
    </div>
  )
}
