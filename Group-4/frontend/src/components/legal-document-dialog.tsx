import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hukuki belgeleri gosteren ikinci seviye dialog. Onay kapisinin (consent-gate-dialog)
// uzerine acilir; kapatilabilir, cunku burada bir karar alinmaz — yalnizca okunur.
//
// Belgeye ozel hicbir sey icermez: metin tamamen i18n namespace'inden gelir ve her
// belge ayni sekle uyar ({ title, sections }). Yeni bir belge eklemek = yeni bir
// locale dosyasi, kod degisikligi degil.
export type LegalDocumentNamespace = 'kvkkConsent' | 'terms'

interface LegalSection {
  heading: string
  body?: string
  items?: string[]
}

export function LegalDocumentDialog({
  namespace,
  open,
  onOpenChange,
}: {
  namespace: LegalDocumentNamespace
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation(namespace)
  const sections = t('sections', { returnObjects: true }) as Record<string, LegalSection>

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* z-60: onay kapisi z-50'de duruyor, belge onun USTUNDE acilmali. */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-60 bg-black/50" />
        <DialogPrimitive.Content className="fixed inset-x-4 top-1/2 z-60 flex max-h-[85vh] -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(0,0,0,0.3)] sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-[640px] sm:-translate-x-1/2">
          <div className="border-b border-[var(--color-border)] px-6 py-5">
            <DialogPrimitive.Title className="font-display text-lg font-bold text-[var(--color-text)]">
              {t('title')}
            </DialogPrimitive.Title>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 text-sm leading-relaxed text-[var(--color-text-muted)]">
            {Object.entries(sections).map(([key, section]) => (
              <section key={key}>
                <h3 className="font-semibold text-[var(--color-text)]">{section.heading}</h3>
                {section.body && <p className="mt-1">{section.body}</p>}
                {section.items && (
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="border-t border-[var(--color-border)] px-6 py-4">
            <DialogPrimitive.Close className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg-muted)]">
              <X aria-hidden className="size-4" />
              {t('common:close')}
            </DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
