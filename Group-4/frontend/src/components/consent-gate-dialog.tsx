import { useEffect, useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { acceptKvkkConsent, getKvkkConsentStatus } from '@/lib/users-client'
import { useTranslation } from '@/lib/i18n/language-provider'
import {
  LegalDocumentDialog,
  type LegalDocumentNamespace,
} from '@/components/legal-document-dialog'

// Onay kapisi. Oturum acmis ama henuz onay vermemis (kvkkConsentAt null) her
// kullaniciya, kapatilamayan tek bir popup olarak gosterilir.
//
// Neden kayit formunda DEGIL: kayit formundaki onay kutusu yalnizca istemci
// state'iydi; sunucuya hicbir zaman gitmiyordu ve Google ile giren kullanici
// forma hic ugramadigi icin onayi tamamen atliyordu (issue #71). Kapi kayit
// akisinin degil OTURUMUN parcasi oldugu icin giris yolu fark etmez.
//
// Kapatma yok: Root'a onOpenChange verilmedigi icin Escape/disariya tiklama
// Radix'in ic state'ini degistirse bile disaridan kontrol edilen `open`
// degismez — kullanici yalnizca iki kutuyu da isaretleyip devam edebilir.
//
// Iki kutu da ayni anda ve zorunlu olarak isaretlendigi icin tek bir
// `kvkkConsentAt` zaman damgasi her ikisinin kabulunu de kaydeder; ayri kolon
// eklenmedi.
export function ConsentGateDialog() {
  const { t } = useTranslation('consentGate')
  const [open, setOpen] = useState(false)
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [termsChecked, setTermsChecked] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  // Acik olan belge dialogu; null ise yalnizca kapi gorunur.
  const [openDocument, setOpenDocument] = useState<LegalDocumentNamespace | null>(null)

  useEffect(() => {
    getKvkkConsentStatus()
      .then((status) => setOpen(status.kvkkConsentAt === null))
      .catch(() => {
        // Durum okunamazsa popup'i zorlamiyoruz - kullaniciyi akistan alikoymaz.
      })
  }, [])

  const bothChecked = kvkkChecked && termsChecked

  async function handleAccept() {
    if (!bothChecked || accepting) return
    setAccepting(true)
    setError('')
    try {
      await acceptKvkkConsent()
      setOpen(false)
    } catch {
      setError(t('error'))
    } finally {
      setAccepting(false)
    }
  }

  // `key` locale dosyasindaki satir anahtari, `namespace` ise o satirin actigi
  // belge. Ikisi ayri: belge namespace'i 'kvkkConsent', satir anahtari 'kvkk'.
  const rows: {
    key: string
    namespace: LegalDocumentNamespace
    checked: boolean
    onChange: (checked: boolean) => void
  }[] = [
    { key: 'kvkk', namespace: 'kvkkConsent', checked: kvkkChecked, onChange: setKvkkChecked },
    { key: 'terms', namespace: 'terms', checked: termsChecked, onChange: setTermsChecked },
  ]

  return (
    <AlertDialogPrimitive.Root open={open}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialogPrimitive.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="fixed inset-x-4 top-1/2 z-50 flex max-h-[85vh] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-[520px] sm:-translate-x-1/2"
        >
          <div className="border-b border-[var(--color-border)] px-6 py-5">
            <AlertDialogPrimitive.Title className="font-display text-lg font-bold text-[var(--color-text)]">
              {t('welcome')}
            </AlertDialogPrimitive.Title>
            <p className="mt-1 font-display text-base font-semibold text-[var(--color-accent)]">
              {t('cta')}
            </p>
          </div>

          <AlertDialogPrimitive.Description asChild>
            <p className="px-6 pt-5 text-sm leading-relaxed text-[var(--color-text-muted)]">
              {t('intro')}
            </p>
          </AlertDialogPrimitive.Description>

          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {rows.map((row) => (
              <div key={row.key} className="flex items-start gap-2.5">
                {/* Belge adi tiklanabilir oldugu icin metin <label> ile SARILMIYOR:
                    sarilsaydi baglantiya tiklamak ayni zamanda kutuyu da isaretlerdi.
                    Erisilebilir ad aria-labelledby yerine aria-label ile veriliyor:
                    ad hesabi baglanti ile cevresindeki metnin arasina bosluk koyar
                    ve ekran okuyucu "Metni 'ni okudum" diye bolerdi. */}
                <input
                  id={`consent-${row.key}`}
                  type="checkbox"
                  checked={row.checked}
                  aria-label={`${t(`rows.${row.key}.prefix`)}${t(`rows.${row.key}.link`)}${t(`rows.${row.key}.suffix`)}`}
                  onChange={(e) => row.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                />
                <p className="text-sm text-[var(--color-text)]">
                  {t(`rows.${row.key}.prefix`)}
                  <button
                    type="button"
                    onClick={() => setOpenDocument(row.namespace)}
                    className="font-semibold text-[var(--color-accent)] underline underline-offset-2 hover:text-[var(--color-accent-strong)]"
                  >
                    {t(`rows.${row.key}.link`)}
                  </button>
                  {t(`rows.${row.key}.suffix`)}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] px-6 py-5">
            {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
            <button
              type="button"
              onClick={handleAccept}
              disabled={!bothChecked || accepting}
              className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--color-border)] disabled:text-[var(--color-text-muted)]"
            >
              {accepting ? t('accepting') : t('accept')}
            </button>
          </div>

          {openDocument && (
            <LegalDocumentDialog
              namespace={openDocument}
              open
              onOpenChange={(next) => !next && setOpenDocument(null)}
            />
          )}
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
