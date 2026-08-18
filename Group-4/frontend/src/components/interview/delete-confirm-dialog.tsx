import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n/language-provider'

// T041/T053 - FR-010: geri donusu olmayan silme islemi oncesi onay adimi.
// itemLabel verilirse erisilebilir isim (aria-label) o ogeye ozgullesir —
// listede birden fazla ayni-metinli "Sil" butonu ekran okuyucuda ayirt
// edilebilir olur; gorunur metin kisa kalir ("Sil"), yalnizca aria-label
// uzar (T053, Ilke VII erisilebilirlik).
//
// asMenuItem: Rötuş Notları (specs/007-ui-design) — Görüşmelerim üç nokta
// menüsünde tetikleyici artık kırmızı pill değil, menü öğesi. Onay diyaloğu
// AYNI kalır (ReportProblemMenuItem ile ayni desen: Radix Root DOM üretmez,
// dropdown içinde açık tetikleme onSelect ile kontrol edilir).
export function DeleteConfirmDialog({
  onConfirm,
  disabled,
  itemLabel,
  asMenuItem,
}: {
  onConfirm: () => void
  disabled?: boolean
  itemLabel?: string
  asMenuItem?: boolean
}) {
  const { t } = useTranslation('interview')
  const [open, setOpen] = useState(false)
  const describedLabel = itemLabel ? t('deleteDialog.ariaLabel', { item: itemLabel }) : undefined

  return (
    <AlertDialog open={asMenuItem ? open : undefined} onOpenChange={asMenuItem ? setOpen : undefined}>
      {asMenuItem ? (
        <DropdownMenuItem
          variant="destructive"
          disabled={disabled}
          onSelect={(e) => {
            e.preventDefault()
            setOpen(true)
          }}
        >
          <Trash2 aria-hidden className="size-3.5" />
          {t('deleteDialog.trigger')}
        </DropdownMenuItem>
      ) : (
        <AlertDialogTriggerButton disabled={disabled} ariaLabel={describedLabel} label={t('deleteDialog.trigger')} />
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {itemLabel
              ? t('deleteDialog.descriptionNamed', { item: itemLabel })
              : t('deleteDialog.descriptionGeneric')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('deleteDialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            aria-label={describedLabel}
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5"
          >
            <Trash2 aria-hidden className="size-4" />
            {t('deleteDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Eski pill-tetikleyici — yalnizca asMenuItem=false (varsayilan, dashboard'daki
// eski gorunumler icin) kullanilir.
function AlertDialogTriggerButton({
  disabled,
  ariaLabel,
  label,
}: {
  disabled?: boolean
  ariaLabel?: string
  label: string
}) {
  return (
    <AlertDialogTrigger asChild>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs text-[var(--color-danger)] hover:brightness-110 disabled:opacity-50"
      >
        <Trash2 aria-hidden className="size-3.5" />
        {label}
      </button>
    </AlertDialogTrigger>
  )
}
