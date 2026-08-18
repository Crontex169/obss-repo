import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/lib/support'
import { useTranslation } from '@/lib/i18n/language-provider'
import { cn } from '@/lib/utils'

// Issue #51 — destek adresini gosteren tek bilesen.
//
// Adres DAIMA gorunur metin olarak yazilir, yalnizca mailto: linki olarak degil:
// webmail kullanan (isletim sisteminde mail istemcisi tanimli olmayan) kullanicida
// mailto: hicbir sey yapmaz, ama adresi okuyup kendi arayuzunde kullanabilir.
//
// `copyable` yalnizca adresin basli basina durdugu yerlerde (footer, Ayarlar karti)
// acilir; hata satiri ve auth kartinda buton gurultu yaratir.
export function SupportLink({
  copyable = false,
  className,
}: {
  copyable?: boolean
  className?: string
}) {
  const { t } = useTranslation('support')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
      toast.success(t('copied'))
    } catch {
      // Pano izni reddedilmis veya guvensiz origin — sessiz basarisizlik YOK,
      // kullaniciya adresi elle secebilecegi soylenir (Anayasa Ilke VII).
      toast.error(t('copyFailed'))
    }
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <a
        href={SUPPORT_MAILTO}
        className="font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
      >
        {SUPPORT_EMAIL}
      </a>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={t('copy')}
          title={t('copy')}
          className="rounded-md border border-[var(--color-border)] p-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          {/* Ikon dekoratif: erisilebilir ad aria-label'da, ekran okuyucu iki kez okumasin. */}
          <CopyIcon aria-hidden className="size-3.5" />
        </button>
      )}
    </span>
  )
}

// Hata ekranlarinda gosterilen ikincil cikis. Kullanicinin gercekten yardima
// ihtiyac duydugu an burasi: "tekrar dene" ise yaramadiginda tek yolu kalmasin.
// Birincil eylemi golgelememesi icin kucuk ve soluk, kopyala butonu YOK.
export function SupportEscape({ className }: { className?: string }) {
  const { t } = useTranslation('support')

  return (
    <p className={cn('text-xs text-[var(--color-text-muted)]', className)}>
      {t('onError')} <SupportLink />
    </p>
  )
}
