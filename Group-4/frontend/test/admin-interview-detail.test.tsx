import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminInterviewDetailPage from '@/pages/admin/interview-detail'
import { getInterview, type AdminInterviewDetail } from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'

// 005-admin US2 / T024 (FR-004, FR-005, FR-006, FR-007): soru/cevap listesi,
// rapor bolumu, token/maliyet paneli, "silindi" durumu ve eksik/basarisiz
// rapor durumunun zarif gosterimi.
vi.mock('@/lib/admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-client')>(
    '@/lib/admin-client',
  )
  return { ...actual, getInterview: vi.fn() }
})

const baseDetail: AdminInterviewDetail = {
  id: 'iv-1',
  ownerEmail: 'aday@example.com',
  position: 'Backend Gelistirici',
  positionLabel: 'Backend Gelistirici',
  status: 'completed',
  mode: 'written',
  level: 'junior',
  language: 'tr',
  createdAt: '2026-08-01T09:00:00.000Z',
  completedAt: '2026-08-01T09:20:00.000Z',
  deletedAt: null,
  questions: [
    {
      order: 1,
      type: 'open_ended',
      text: 'Deneyiminizi anlatin.',
      options: [],
      answer: 'Uc yildir backend gelistiriyorum.',
    },
    {
      order: 2,
      type: 'multiple_choice',
      text: 'Hangisi dogrudur?',
      options: ['Secenek A', 'Secenek B'],
      answer: null,
    },
  ],
  reportStatus: 'ready',
  report: {
    overallImpression: 'Aday genel olarak yeterli.',
    strengths: ['Net iletisim'],
    improvementAreas: ['Derinlemesine ornek'],
    additionalNotes: ['Ek not'],
    technicalScore: 70,
    behavioralScore: 80,
    generalScore: 75,
    // #76 — kullanicinin raporundakiyle ayni soru bazli geri bildirim.
    questionFeedback: [
      {
        order: 1,
        verdict: 'kismen',
        correctAnswer: 'Somut bir proje ornegi ve olculebilir sonuc beklenir.',
        explanation: 'Cevap sure bilgisi disinda ayrinti icermiyor.',
      },
      {
        order: 2,
        verdict: 'yetersiz',
        correctAnswer: 'Secenek A',
        explanation: 'Soru cevapsiz birakildi.',
      },
    ],
  },
  tokenUsage: { totalTokens: 430, estimatedCostUsd: '0.004000' },
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/admin/interview/iv-1']}>
      <Routes>
        <Route
          path="/admin/interview/:id"
          element={<AdminInterviewDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminInterviewDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getInterview).mockReset()
  })

  it('FR-005: sorular, cevaplar ve sahibi e-postasi gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    expect(await screen.findByText('aday@example.com')).toBeInTheDocument()
    expect(screen.getByText('Deneyiminizi anlatin.')).toBeInTheDocument()
    expect(
      screen.getByText('Uc yildir backend gelistiriyorum.'),
    ).toBeInTheDocument()
  })

  it('cevaplanmamis soruda "cevaplanmadi" durumu gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    expect(await screen.findByText(/cevaplanmadı/i)).toBeInTheDocument()
  })

  it('FR-005: rapor skorlari (Teknik/Davranissal/Genel) ve metin gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    const report = await screen.findByRole('region', { name: /rapor/i })
    expect(within(report).getByText('70')).toBeInTheDocument()
    expect(within(report).getByText('80')).toBeInTheDocument()
    expect(within(report).getByText('75')).toBeInTheDocument()
    expect(
      within(report).getByText('Aday genel olarak yeterli.'),
    ).toBeInTheDocument()
  })

  it('FR-007: token/maliyet paneli toplam token ve maliyeti gosterir', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    const panel = await screen.findByRole('region', { name: /maliyet/i })
    expect(within(panel).getByText('430')).toBeInTheDocument()
    expect(within(panel).getByText(/0\.004/)).toBeInTheDocument()
  })

  it('FR-007: tokenUsage null iken "maliyet bilgisi yok" gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      ...baseDetail,
      tokenUsage: null,
    })
    renderDetail()

    expect(await screen.findByText(/maliyet bilgisi yok/i)).toBeInTheDocument()
  })

  it.each([
    ['pending', /hazırlanıyor/i],
    ['failed', /üretilemedi/i],
    ['not_applicable', /rapor yok/i],
  ] as const)(
    'FR-006: reportStatus=%s iken zarif durum mesaji, soru/cevap yine gorunur',
    async (reportStatus, pattern) => {
      vi.mocked(getInterview).mockResolvedValue({
        ...baseDetail,
        reportStatus,
        report: null,
      })
      renderDetail()

      expect(await screen.findByText(pattern)).toBeInTheDocument()
      expect(screen.getByText('Deneyiminizi anlatin.')).toBeInTheDocument()
      // #76: rapor hazir degilken geri bildirim de gosterilmez.
      expect(screen.queryByText('Kısmen')).not.toBeInTheDocument()
      expect(screen.queryByText(/^Doğru cevap:/)).not.toBeInTheDocument()
    },
  )

  // #76 (issue #68'in admin karsiligi) — FR-005 "eksiksiz": admin, kullanicinin
  // gordugu soru bazli geri bildirimin AYNISINI gormeli.
  it('FR-005: her sorunun degerlendirmesi, dogru cevabi ve aciklamasi gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    expect(await screen.findByText('Kısmen')).toBeInTheDocument()
    expect(screen.getByText('Yetersiz')).toBeInTheDocument()
    expect(
      screen.getByText(/Somut bir proje ornegi ve olculebilir sonuc beklenir\./),
    ).toBeInTheDocument()
    expect(screen.getByText('Soru cevapsiz birakildi.')).toBeInTheDocument()
    // Coktan secmelide "Doğru cevap", acik ucluda "Beklenen cevap" etiketi.
    expect(screen.getByText(/^Doğru cevap:/)).toBeInTheDocument()
    expect(screen.getByText(/^Beklenen cevap:/)).toBeInTheDocument()
  })

  it('#76: geri bildirim bos gelirse (eski raporlar) hicbir sey render edilmez', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      ...baseDetail,
      report: { ...baseDetail.report!, questionFeedback: [] },
    })
    renderDetail()

    expect(await screen.findByText('Deneyiminizi anlatin.')).toBeInTheDocument()
    expect(screen.queryByText('Kısmen')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Doğru cevap:/)).not.toBeInTheDocument()
  })

  it('FR-004: silinmis kayitta "Silindi" rozeti gorunur, icerik eksiksiz kalir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      ...baseDetail,
      deletedAt: '2026-08-02T10:00:00.000Z',
    })
    renderDetail()

    expect(await screen.findByText('Silindi')).toBeInTheDocument()
    expect(screen.getByText('Deneyiminizi anlatin.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /rapor/i })).toBeInTheDocument()
  })

  it('FR-008: salt-okunur — silme/duzenleme aksiyonu render edilmez', async () => {
    vi.mocked(getInterview).mockResolvedValue(baseDetail)
    renderDetail()

    await screen.findByText('aday@example.com')
    expect(screen.queryByRole('button', { name: /sil/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /düzenle/i })).toBeNull()
  })

  it('404 durumunda kullaniciya anlasilir hata gosterilir', async () => {
    vi.mocked(getInterview).mockRejectedValue(
      new ApiError(404, {
        statusCode: 404,
        error: 'Not Found',
        message: 'Kayit bulunamadi',
      }),
    )
    renderDetail()

    expect(await screen.findByText('Kayit bulunamadi')).toBeInTheDocument()
  })
})
