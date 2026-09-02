import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { PdfUpload } from '@/components/interview/pdf-upload'
import { ApiError, deleteCv, uploadCv, type CvProfile } from '@/lib/users-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// Kalici CV profili: kullanici CV'sini BIR kez yukler, her yeni gorusmede
// tekrar dosya secmez (yeni gorusme formu kayitli CV'yi varsayilan olarak
// kullanir, orada tek tikla kapatilabilir).
//
// Dosya secilir secilmez yuklenir — ayri bir "Kaydet" dugmesi YOK: kartta
// kaydedilmemis tek bir alan var, iki adimli akis onu bekletmekten baska is
// yapmazdi.
export function CvProfileCard({
  cv,
  onChange,
}: {
  cv: CvProfile | null
  onChange: (cv: CvProfile | null) => void
}) {
  const { t, i18n } = useTranslation('settings')
  const [busy, setBusy] = useState(false)

  async function handleSelect(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await uploadCv(file))
      toast.success(t('cv.uploaded'))
    } catch (err) {
      // Metin cikarilamayan (taranmis) PDF'te sunucu ACIKLAYICI mesaj doner —
      // jenerik metinle ezmek kullaniciyi neyi duzeltecegini bilmez birakirdi.
      toast.error(err instanceof ApiError ? err.message : t('cv.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteCv()
      onChange(null)
      toast.success(t('cv.removed'))
    } catch {
      toast.error(t('cv.removeFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {cv?.fileName && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-2">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-[var(--color-text)]">
              {cv.fileName}
            </span>
            {cv.updatedAt && (
              <span className="font-data text-xs text-[var(--color-text-muted)]">
                {t('cv.updatedAt', {
                  date: new Date(cv.updatedAt).toLocaleString(
                    i18n.language === 'en' ? 'en-US' : 'tr-TR',
                  ),
                })}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] transition-colors hover:border-[var(--color-danger)] disabled:opacity-50"
          >
            <Trash2 aria-hidden className="size-4" />
            {t('cv.remove')}
          </button>
        </div>
      )}

      <PdfUpload file={null} onChange={(file) => void handleSelect(file)} />
      {busy && <p className="text-sm text-[var(--color-text-muted)]">{t('cv.busy')}</p>}
    </div>
  )
}
