import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { InterviewCard } from '@/components/interview/interview-card'
import { deleteInterview, getInterview, reportProblem } from '@/lib/interview-client'
import type { InterviewListItem } from '@/lib/interview-client'
import { buildReportPdf } from '@/lib/report-pdf'

// specs/007-ui-design Rötuş Notları: kırmızı "Sil" pill yerine "Raporu gör" +
// üç nokta menüsü (Sil / İndir / Yeniden dene / Bildir), Bildir yeni backend
// uç noktasına (POST /api/interviews/:id/report-problem) bağlanır. İndir,
// rapor sayfasına gitmeden dogrudan PDF uretip indirir (aynı buildReportPdf).
vi.mock('@/lib/interview-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/interview-client')>(
      '@/lib/interview-client',
    )
  return {
    ...actual,
    deleteInterview: vi.fn(),
    reportProblem: vi.fn(),
    getInterview: vi.fn(),
  }
})

vi.mock('@/lib/report-pdf', () => ({
  buildReportPdf: vi.fn(() => ({ save: vi.fn() })),
}))

const BASE: InterviewListItem = {
  id: 'iv1',
  position: 'Backend Developer',
  status: 'completed',
  reportStatus: 'ready',
  mode: 'written',
  level: 'junior',
  language: 'tr',
  questionCount: 8,
  createdAt: '2026-08-01T10:00:00.000Z',
  completedAt: '2026-08-01T10:20:00.000Z',
}

function renderCard(overrides: Partial<InterviewListItem> = {}) {
  return render(
    <MemoryRouter>
      <InterviewCard interview={{ ...BASE, ...overrides }} />
    </MemoryRouter>,
  )
}

describe('InterviewCard — üç nokta menüsü', () => {
  beforeEach(() => {
    vi.mocked(deleteInterview).mockReset()
    vi.mocked(reportProblem).mockReset()
    vi.mocked(getInterview).mockReset()
    vi.mocked(buildReportPdf).mockClear()
  })

  it('rapor hazirsa "Raporu gör" linki gorunur', () => {
    renderCard({ reportStatus: 'ready' })
    expect(screen.getByRole('link', { name: 'Raporu gör' })).toBeInTheDocument()
  })

  it('rapor hazir degilse "Raporu gör" linki gizli', () => {
    renderCard({ reportStatus: 'pending', status: 'in_progress' })
    expect(screen.queryByRole('link', { name: 'Raporu gör' })).not.toBeInTheDocument()
  })

  it('üç nokta menüsü Sil/Bildir seçeneklerini açar, Bildir mesaj gönderir', async () => {
    vi.mocked(reportProblem).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: 'Daha fazla' }))
    expect(screen.getByText('Sil')).toBeInTheDocument()

    await user.click(screen.getByText('Bildir'))
    const textarea = await screen.findByPlaceholderText('Sorunu yazın...')
    await user.type(textarea, 'Rapor puani hatali gorunuyor.')
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    await waitFor(() =>
      expect(reportProblem).toHaveBeenCalledWith('iv1', 'Rapor puani hatali gorunuyor.'),
    )
  })

  it('bos mesajla Bildir gonderilemez, hata mesaji gosterilir', async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: 'Daha fazla' }))
    await user.click(screen.getByText('Bildir'))
    await screen.findByPlaceholderText('Sorunu yazın...')
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByText('Lütfen bir mesaj yazın.')).toBeInTheDocument()
    expect(reportProblem).not.toHaveBeenCalled()
  })

  it('İndir tiklaninca sayfa degistirmeden PDF dogrudan uretilir', async () => {
    const mockReport = { id: 'r1' } as Awaited<ReturnType<typeof getInterview>>['report']
    vi.mocked(getInterview).mockResolvedValue({
      report: mockReport,
      position: 'Backend Developer',
      answeredPairs: [],
    } as unknown as Awaited<ReturnType<typeof getInterview>>)
    const user = userEvent.setup()
    renderCard()

    await user.click(screen.getByRole('button', { name: 'Daha fazla' }))
    await user.click(screen.getByText('Raporu indir'))

    await waitFor(() => expect(getInterview).toHaveBeenCalledWith('iv1'))
    expect(buildReportPdf).toHaveBeenCalledWith(mockReport, 'Backend Developer', [])
  })
})
