import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Download, MoreHorizontal, RotateCcw } from 'lucide-react'
import {
  ApiError,
  deleteInterview,
  getInterview,
  type InterviewListItem,
} from '@/lib/interview-client'
import { buildReportPdf } from '@/lib/report-pdf'
import { DeleteConfirmDialog } from '@/components/interview/delete-confirm-dialog'
import { ReportProblemMenuItem } from '@/components/interview/report-problem-menu-item'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTranslation } from '@/lib/i18n/language-provider'

// T086 (002-interview) + 004-history genisletmesi (FR-002) — kart gorunumu:
// POZISYON basligi, tarih, durum/mod/level rozeti, silme aksiyonu
// (docs/APP_FLOW.md §6 — position dashboard kartinin basligidir).
//
// Not (i18n merge): rozet etiketleri BURADA t() ile cevrilir, interview-filter.ts'teki
// (arama icin kullanilan) sabit Turkce sozlukten DEGIL - FR-019 aramasi bu yuzden
// yalnizca varsayilan (TR) dilde kart metniyle birebir eslesir; EN arayuzde arama
// yine calisir ama rozet kelimeleriyle degil.
const STATUS_BADGE: Record<InterviewListItem['status'], string> = {
  in_progress: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  completed: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
}

const REPORT_BADGE: Record<InterviewListItem['reportStatus'], string> = {
  not_applicable: '',
  pending: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  ready: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
  failed: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
}

export function InterviewCard({
  interview,
  onDeleted,
}: {
  interview: InterviewListItem
  /** FR-011: basarili silme sonrasi kart aninda listeden kaldirilir (optimistic). */
  onDeleted?: (id: string) => void
}) {
  const { t, i18n } = useTranslation('interview')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [downloading, setDownloading] = useState(false)

  const STATUS_LABEL: Record<InterviewListItem['status'], string> = {
    in_progress: t('card.statusInProgress'),
    completed: t('card.statusCompleted'),
  }
  const REPORT_LABEL: Record<InterviewListItem['reportStatus'], string> = {
    not_applicable: '',
    pending: t('card.reportPending'),
    ready: t('card.reportReady'),
    failed: t('card.reportFailed'),
  }
  const LEVEL_LABEL: Record<InterviewListItem['level'], string> = {
    intern: t('card.levelIntern'),
    junior: t('card.levelJunior'),
    mid: t('card.levelMid'),
    senior: t('card.levelSenior'),
  }
  const unknownPosition = t('card.unknownPosition')

  const isCompleted = interview.status === 'completed'
  // Tamamlanmis + raporu hazir olan dogrudan rapora, digerleri oturuma gider.
  const target =
    isCompleted && interview.reportStatus === 'ready'
      ? `/interview/${interview.id}/report`
      : `/interview/${interview.id}`

  async function handleDelete() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteInterview(interview.id)
      onDeleted?.(interview.id)
      toast.success(t('card.deletedToast'))
    } catch (err) {
      setDeleting(false)
      setDeleteError(err instanceof ApiError ? err.message : t('card.deleteFailed'))
    }
  }

  // Rapor sayfasindaki PdfExportButton ile AYNI uretim yolu (buildReportPdf) —
  // burada sadece rapor sayfasina gitmeden dogrudan indirmek icin veri once
  // getInterview() ile cekiliyor (liste zaten tam rapor icerigini tutmaz).
  async function handleDownload() {
    setDownloading(true)
    try {
      const data = await getInterview(interview.id)
      if (!data.report) {
        toast.error(t('card.downloadFailed'))
        return
      }
      buildReportPdf(data.report, data.position, data.answeredPairs).save(
        `gorusme-raporu-${data.report.id}.pdf`,
      )
      toast.success(t('pdfExport.downloaded'))
    } catch {
      toast.error(t('card.downloadFailed'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]">
      <Link to={target} className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display min-w-0 font-semibold break-words text-[var(--color-text)]">
            {/* Pozisyon cikarilamamis olabilir (FR-023) — akis bozulmaz. */}
            {interview.position ?? unknownPosition}
          </h2>
          {interview.deletedAt && (
            <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
              {t('card.deleted')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_BADGE[interview.status]}`}>
            {STATUS_LABEL[interview.status]}
          </span>
          {REPORT_LABEL[interview.reportStatus] && (
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${REPORT_BADGE[interview.reportStatus]}`}
            >
              {REPORT_LABEL[interview.reportStatus]}
            </span>
          )}
          <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[var(--color-text-muted)]">
            {t('card.questionCount', { count: interview.questionCount })}
          </span>
          <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[var(--color-text-muted)]">
            {interview.mode === 'voice' ? t('card.modeVoice') : t('card.modeWritten')}
          </span>
          <span className="rounded-full bg-[var(--color-bg-muted)] px-2 py-0.5 text-[var(--color-text-muted)]">
            {LEVEL_LABEL[interview.level]}
          </span>
        </div>

        <p className="font-data text-xs text-[var(--color-text-muted)]">
          {new Date(interview.createdAt).toLocaleString(i18n.language === 'en' ? 'en-US' : 'tr-TR')}
        </p>
      </Link>

      <div className="flex items-center justify-between gap-2">
        {deleteError && <p className="text-xs text-[var(--color-danger)]">{deleteError}</p>}
        <div className="ml-auto flex items-center gap-3">
          {/* Rötuş Notları (specs/007-ui-design): kirmizi "Sil" pill yerine
              "Raporu gör" (mavi, birincil aksiyon vurgusu) + üç nokta menüsü;
              silme menü içine taşındı. */}
          {interview.reportStatus === 'ready' && (
            <Link
              to={`/interview/${interview.id}/report`}
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
            >
              {t('card.viewReport')}
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t('card.more')}
                className="rounded-full p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-muted)]"
              >
                <MoreHorizontal aria-hidden className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {interview.reportStatus === 'ready' && (
                <DropdownMenuItem
                  disabled={downloading}
                  onSelect={(e) => {
                    e.preventDefault()
                    void handleDownload()
                  }}
                >
                  <Download aria-hidden className="size-3.5" />
                  {downloading ? t('card.downloading') : t('card.downloadReport')}
                </DropdownMenuItem>
              )}
              {interview.reportStatus === 'failed' && (
                <DropdownMenuItem asChild>
                  <Link to={`/interview/${interview.id}/report`}>
                    <RotateCcw aria-hidden className="size-3.5" />
                    {t('card.retryReport')}
                  </Link>
                </DropdownMenuItem>
              )}
              <ReportProblemMenuItem interviewId={interview.id} />
              <DeleteConfirmDialog
                asMenuItem
                onConfirm={handleDelete}
                disabled={deleting}
                itemLabel={interview.position ?? unknownPosition}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
