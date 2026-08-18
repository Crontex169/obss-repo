import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import InterviewReportPage from '@/pages/interview/report'
import { getInterview, retryReport, ApiError } from '@/lib/interview-client'

// T027/T028 (004-history US3, FR-007/FR-008): "Gorusme Detayi" ekrani —
// getInterview() tek cagrisindan answeredPairs + report birlikte render
// edilir; rapor basarisizsa soru/cevap yine gosterilir, sessiz basarisizlik yok.
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return {
    ...actual,
    getInterview: vi.fn(),
    retryReport: vi.fn(),
  }
})

function renderReport(id = 'iv-1') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${id}/report`]}>
      <Routes>
        <Route path="/interview/:id/report" element={<InterviewReportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const answeredPairs = [
  {
    order: 1,
    type: 'open_ended' as const,
    text: 'Kendinizden bahseder misiniz?',
    options: [],
    answer: { content: 'Deneyimli bir gelistiriciyim.', answeredAt: '2026-08-01T00:00:00.000Z' },
  },
  {
    order: 2,
    type: 'multiple_choice' as const,
    text: 'Iskele kurulumunda ilk kontrol nedir?',
    options: ['Baglanti elemanlari', 'Malzeme sayimi'],
    answer: { content: 'Malzeme sayimi', answeredAt: '2026-08-01T00:01:00.000Z' },
  },
]

// #68 — soru bazli geri bildirim.
const questionFeedback = [
  {
    order: 1,
    verdict: 'kismen' as const,
    correctAnswer: 'Rol ile ilgili somut bir deneyim ornegi verilmeli.',
    explanation: 'Cevap genel kaldi, olculebilir bir sonuc paylasilmadi.',
  },
  {
    order: 2,
    verdict: 'yetersiz' as const,
    correctAnswer: 'Baglanti elemanlari',
    explanation: 'Guvenlik kontrolu malzeme sayimindan once gelir.',
  },
]

describe('InterviewReportPage (Gorusme Detayi)', () => {
  beforeEach(() => {
    vi.mocked(getInterview).mockReset()
    vi.mocked(retryReport).mockReset()
  })

  it('FR-007: raporu hazirsa soru/cevaplar VE skorlar birlikte render edilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'ready',
      currentQuestionOrder: 2,
      questionCount: 1,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs,
      report: {
        id: 'rep-1',
        overallImpression: 'Guclu bir performans.',
        strengths: ['Net iletisim'],
        improvementAreas: ['Sistem tasarimi'],
        technicalScore: 78,
        behavioralScore: 85,
        generalScore: 80,
        additionalNotes: [],
        questionFeedback,
        generatedAt: '2026-08-01T00:00:00.000Z',
      },
    } as never)

    renderReport()

    expect(await screen.findByText(/Kendinizden bahseder misiniz/)).toBeInTheDocument()
    expect(screen.getByText('Deneyimli bir gelistiriciyim.')).toBeInTheDocument()
    expect(screen.getByText('Guclu bir performans.')).toBeInTheDocument()
    expect(screen.getByText('78/100')).toBeInTheDocument()
  })

  it('#68: yanlis cevaplanan sorunun dogru cevabi ve aciklamasi raporda gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'ready',
      currentQuestionOrder: 3,
      questionCount: 2,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs,
      report: {
        id: 'rep-1',
        overallImpression: 'Guclu bir performans.',
        strengths: ['Net iletisim'],
        improvementAreas: ['Sistem tasarimi'],
        technicalScore: 78,
        behavioralScore: 85,
        generalScore: 80,
        overallScore: 81,
        additionalNotes: [],
        questionFeedback,
        generatedAt: '2026-08-01T00:00:00.000Z',
      },
    } as never)

    renderReport()

    // Coktan secmelide dogru SECENEK metni, acik ucluda beklenen cevap ozeti.
    expect(await screen.findByText('Baglanti elemanlari')).toBeInTheDocument()
    expect(
      screen.getByText('Guvenlik kontrolu malzeme sayimindan once gelir.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Rol ile ilgili somut bir deneyim ornegi verilmeli.'),
    ).toBeInTheDocument()
    // Ozet serit: renk tek sinyal degil, sayi + etiket de var.
    expect(screen.getByText(/1 Kısmen/)).toBeInTheDocument()
    expect(screen.getByText(/1 Yetersiz/)).toBeInTheDocument()
  })

  it('#68: rapor hazir degilse geri bildirim HIC gosterilmez, soru/cevap sade kalir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'pending',
      currentQuestionOrder: 3,
      questionCount: 2,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs,
      report: null,
    } as never)

    renderReport()

    expect(await screen.findByText(/Kendinizden bahseder misiniz/)).toBeInTheDocument()
    expect(screen.queryByText('Baglanti elemanlari')).not.toBeInTheDocument()
    expect(screen.queryByText(/Doğru cevap ve açıklama/)).not.toBeInTheDocument()
  })

  it('FR-008: rapor basarisizsa soru/cevap yine gosterilir, rapor bolumunde hata + tekrar dene', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'failed',
      currentQuestionOrder: 2,
      questionCount: 1,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs,
      report: null,
    } as never)

    renderReport()

    expect(await screen.findByText(/Kendinizden bahseder misiniz/)).toBeInTheDocument()
    expect(screen.getByText('Rapor üretilemedi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tekrar dene/ })).toBeInTheDocument()
  })

  it('reportStatus="pending" ise soru/cevap + bekleme mesaji gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'pending',
      currentQuestionOrder: 2,
      questionCount: 1,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs,
      report: null,
    } as never)

    renderReport()

    expect(await screen.findByText(/Kendinizden bahseder misiniz/)).toBeInTheDocument()
    expect(screen.getByText(/hazırlanıyor/)).toBeInTheDocument()
  })

  it('gorusme yuklenemezse (404) ErrorRetry gosterilir, sahiplik bilgisi sizdirmaz', async () => {
    vi.mocked(getInterview).mockRejectedValue(
      new ApiError(404, { statusCode: 404, error: 'NotFound', message: 'Gorusme bulunamadi' }),
    )

    renderReport()

    expect(await screen.findByText('Gorusme bulunamadi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tekrar dene/ })).toBeInTheDocument()
  })
})
