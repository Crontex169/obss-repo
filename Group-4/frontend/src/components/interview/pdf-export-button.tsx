import { toast } from 'sonner'
import { Download } from 'lucide-react'
import type { AnsweredPair, Report } from '@/lib/interview-client'
import { buildReportPdf } from '@/lib/report-pdf'
import { useTranslation } from '@/lib/i18n/language-provider'

// T048 (US5, FR-016) — yerlesim/cizim report-pdf.ts icinde; burasi yalnizca
// tetikleyici (istemci tarafi uretim, yeni backend uc noktasi YOK).
export function PdfExportButton({
  report,
  position,
  pairs,
}: {
  report: Report
  position: string | null
  /** #68 — soru bazli geri bildirim PDF'te soru metniyle birlikte basilir. */
  pairs: AnsweredPair[]
}) {
  const { t } = useTranslation('interview')

  function handleExport() {
    buildReportPdf(report, position, pairs).save(
      `gorusme-raporu-${report.id}.pdf`,
    )
    toast.success(t('pdfExport.downloaded'))
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 self-start rounded bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)]"
    >
      <Download aria-hidden className="size-4" />
      {t('pdfExport.download')}
    </button>
  )
}
