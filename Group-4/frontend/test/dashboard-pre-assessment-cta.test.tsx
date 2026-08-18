import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '@/pages/dashboard'
import { listInterviews } from '@/lib/interview-client'
import { getActivePreAssessment } from '@/lib/pre-assessment-client'

// Panelden on degerlendirme akisina giden CTA (FR-030 kancasi): metin ve hedef
// rota, kullanicinin AKTIF on degerlendirmesi olup olmadigina gore degisir.
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return { ...actual, listInterviews: vi.fn(), getInterview: vi.fn() }
})
vi.mock('@/lib/pre-assessment-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/pre-assessment-client')
  >('@/lib/pre-assessment-client')
  return { ...actual, getActivePreAssessment: vi.fn() }
})
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { name: 'Ada Lovelace' } } }),
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage — on degerlendirme CTA', () => {
  beforeEach(() => {
    vi.mocked(listInterviews).mockResolvedValue([])
    vi.mocked(getActivePreAssessment).mockReset()
  })

  it('aktif kayit YOKSA doldurma CTA gosterilir ve /pre-assessment/new hedefler', async () => {
    vi.mocked(getActivePreAssessment).mockResolvedValue(null)
    renderDashboard()

    const cta = await screen.findByRole('link', { name: /Ön değerlendirmeyi doldur/ })
    expect(cta).toHaveAttribute('href', '/pre-assessment/new')
  })

  it('aktif kayit VARSA rapor CTA gosterilir ve /pre-assessment/new hedefler (tek kayit: gecmis listesi YOK)', async () => {
    vi.mocked(getActivePreAssessment).mockResolvedValue({ id: 'pa-1' } as never)
    renderDashboard()

    const cta = await screen.findByRole('link', {
      name: /Ön değerlendirme raporunu gör/,
    })
    expect(cta).toHaveAttribute('href', '/pre-assessment/new')
  })
})
