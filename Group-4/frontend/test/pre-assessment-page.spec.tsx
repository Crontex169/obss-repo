import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NewPreAssessmentPage from '@/pages/pre-assessment/new'
import {
  ApiError,
  createPreAssessment,
  getActivePreAssessment,
} from '@/lib/pre-assessment-client'

// Tek on degerlendirme akisi (008): kayit sayfada KALIR, form mevcut cevaplarla
// dolu acilir, gecmis listesi YOK.
vi.mock('@/lib/pre-assessment-client', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/pre-assessment-client')>(
      '@/lib/pre-assessment-client',
    )
  return {
    ...actual,
    getActivePreAssessment: vi.fn(),
    createPreAssessment: vi.fn(),
  }
})

const SAVED = {
  id: 'pa1',
  experienceYears: 'y1_3',
  workStatus: 'seeking',
  educationLevel: null,
  workPreference: 'hands_on',
  teamPreference: 'small_team',
  learningStyle: null,
  problemApproach: 'ask_experienced',
  selfRatings: null,
  skills: ['kaynak'],
  openAnswers: null,
  experienceLevel: 'junior',
  language: 'tr',
  status: 'completed',
  isActive: true,
  createdAt: '2026-08-07T00:00:00.000Z',
  report: {
    id: 'r1',
    genelOzet: 'Kaydedilmis rapor ozeti.',
    gucluYonler: ['Dikkatli calisma'],
    gelisimAlanlari: ['Zaman planlama'],
    calismaTarziOzeti: 'Kucuk ekiplerde verimli.',
    guvenSeviyesi: 'orta',
    createdAt: '2026-08-07T00:00:00.000Z',
  },
} as unknown as Awaited<ReturnType<typeof getActivePreAssessment>>

describe('NewPreAssessmentPage', () => {
  beforeEach(() => {
    vi.mocked(getActivePreAssessment).mockReset()
    vi.mocked(createPreAssessment).mockReset()
  })

  it('kaydedilmis rapor sayfada KALIR (geri gelindiginde de gorunur)', async () => {
    vi.mocked(getActivePreAssessment).mockResolvedValue(SAVED)
    render(<NewPreAssessmentPage />)

    expect(await screen.findByText(/kaydedilmis rapor ozeti/i)).toBeInTheDocument()
  })

  it('kayit yoksa rapor gosterilmez', async () => {
    vi.mocked(getActivePreAssessment).mockResolvedValue(null)
    render(<NewPreAssessmentPage />)

    // Form yuklendikten sonra kontrol et (iskelet gecsin).
    expect(await screen.findByRole('button', { name: /^kaydet$/i })).toBeInTheDocument()
    expect(screen.queryByText(/kaydedilmis rapor ozeti/i)).not.toBeInTheDocument()
  })

  // Admin salt okunurdur (FR-011a): RolesGuard genel bir "Forbidden" doner,
  // kullanici sebebini goremezdi. Mesaj burada aciklanir.
  it('403 -> yonetici hesabi aciklamasi gosterilir, ham "Forbidden" DEGIL', async () => {
    const user = userEvent.setup()
    vi.mocked(getActivePreAssessment).mockResolvedValue(SAVED)
    vi.mocked(createPreAssessment).mockRejectedValue(
      new ApiError(403, {
        statusCode: 403,
        error: 'Forbidden',
        message: 'Forbidden',
      }),
    )

    render(<NewPreAssessmentPage />)

    const save = await screen.findByRole('button', { name: /^kaydet$/i })
    await user.click(save)

    await waitFor(() => {
      expect(screen.getByText(/yönetici hesabı ön değerlendirme oluşturamaz/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/^Forbidden$/)).not.toBeInTheDocument()
  })
})
