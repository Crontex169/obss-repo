import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfExportButton } from '@/components/interview/pdf-export-button'
import { buildReportPdf } from '@/lib/report-pdf'
import type { AnsweredPair, Report } from '@/lib/interview-client'

// T045 (004-history US5, FR-016): buton yalnizca TETIKLEYICI — PDF yerlesimi
// report-pdf.ts'e ait ve orada gercek jsPDF ile test edilir (report-pdf.test.ts).
// Burada uretimin cagrildigi ve dosyanin dogru adla indirildigi dogrulanir.
const save = vi.fn()
vi.mock('@/lib/report-pdf', () => ({
  buildReportPdf: vi.fn(() => ({ save })),
}))

const report: Report = {
  id: 'rep-1',
  overallImpression: 'Guclu bir performans.',
  strengths: ['Net iletisim'],
  improvementAreas: ['Sistem tasarimi'],
  technicalScore: 78,
  behavioralScore: 85,
  generalScore: 80,
  overallScore: 81,
  additionalNotes: [],
  questionFeedback: [],
  generatedAt: '2026-08-01T00:00:00.000Z',
}

const pairs: AnsweredPair[] = [
  {
    order: 1,
    type: 'open_ended',
    text: 'Kendinizden bahseder misiniz?',
    options: [],
    tip: null,
    rationale: null,
    answer: { content: 'Deneyimli bir gelistiriciyim.', answeredAt: '2026-08-01T00:00:00.000Z' },
  },
]

describe('PdfExportButton', () => {
  it('tiklaninca raporu uretir ve dogru dosya adiyla indirir', async () => {
    const user = userEvent.setup()
    render(
      <PdfExportButton report={report} position="Backend Gelistirici" pairs={pairs} />,
    )

    await user.click(screen.getByRole('button', { name: /PDF olarak indir/ }))

    expect(buildReportPdf).toHaveBeenCalledWith(report, 'Backend Gelistirici', pairs)
    expect(save).toHaveBeenCalledWith('gorusme-raporu-rep-1.pdf')
  })
})
