import { useState } from 'react'
import { Flag } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ApiError, reportProblem } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// specs/007-ui-design Rötuş Notları — Görüşmelerim üç nokta menüsündeki
// "Bildir" aksiyonu: küçük mesaj alanı + gönder. AlertDialog'un action butonu
// varsayilan olarak kapaniyor, bu yuzden gonderim onClick icinde
// preventDefault ile kontrol edilir (basarisizsa dialog acik kalir).
export function ReportProblemMenuItem({ interviewId }: { interviewId: string }) {
  const { t } = useTranslation('interview')
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed) {
      setError(t('reportProblem.emptyError'))
      return
    }
    setSending(true)
    setError('')
    try {
      await reportProblem(interviewId, trimmed)
      toast.success(t('reportProblem.sentToast'))
      setMessage('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('reportProblem.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <DropdownMenuItem
        onSelect={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <Flag aria-hidden className="size-3.5" />
        {t('reportProblem.trigger')}
      </DropdownMenuItem>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('reportProblem.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('reportProblem.description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('reportProblem.placeholder')}
          rows={3}
          disabled={sending}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>{t('reportProblem.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            disabled={sending}
            onClick={(e) => {
              e.preventDefault()
              void handleSubmit()
            }}
          >
            {sending ? t('reportProblem.submitting') : t('reportProblem.submit')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
