import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminStatsPage from '@/pages/admin/stats'
import { getStats, type AdminStatsResponse } from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'

// 005-admin US3 / T034 (FR-009..FR-013): meslek bazli sayi, ortalama sure,
// tamamlanma orani ve gunluk token serisi. Grafiklerin yaninda METINSEL
// deger/ozet bulunur (T043 erisilebilirlik notu) — jsdom'da SVG olculeri
// olusmadigindan iddialar bu metinsel katmana kurulur.
vi.mock('@/lib/admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-client')>(
    '@/lib/admin-client',
  )
  return { ...actual, getStats: vi.fn() }
})

const fullStats: AdminStatsResponse = {
  countsByProfession: [
    { position: 'Backend Gelistirici', label: 'Backend Gelistirici', count: 12 },
    { position: null, label: 'Belirsiz', count: 3 },
  ],
  averageDurationSeconds: 754,
  completionRatio: { completed: 30, inProgress: 12 },
  dailyTokenUsage: [
    { date: '2026-08-01', totalTokens: 100, estimatedCostUsd: '0.001500' },
    { date: '2026-08-02', totalTokens: 0, estimatedCostUsd: '0.000000' },
    { date: '2026-08-03', totalTokens: 250, estimatedCostUsd: '0.003750' },
  ],
  totalCostUsd: '0.005250',
}

const emptyStats: AdminStatsResponse = {
  countsByProfession: [],
  averageDurationSeconds: null,
  completionRatio: { completed: 0, inProgress: 0 },
  dailyTokenUsage: [
    { date: '2026-08-01', totalTokens: 0, estimatedCostUsd: '0.000000' },
  ],
  totalCostUsd: '0.000000',
}

function renderStats() {
  return render(
    <MemoryRouter initialEntries={['/admin/stats']}>
      <AdminStatsPage />
    </MemoryRouter>,
  )
}

describe('AdminStatsPage', () => {
  beforeEach(() => {
    vi.mocked(getStats).mockReset()
  })

  it('FR-009: meslek bazli sayilar "Belirsiz" kovasi dahil listelenir', async () => {
    vi.mocked(getStats).mockResolvedValue(fullStats)
    renderStats()

    const region = await screen.findByRole('region', { name: /meslek/i })
    // Recharts eksen etiketleri de ayni metinleri uretebildiginden iddia
    // metinsel esdeger listesine (T043) kapsanir.
    const rows = within(region)
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(rows).toContain('Backend Gelistirici12')
    expect(rows).toContain('Belirsiz3')
  })

  it('FR-010: ortalama sure okunabilir bicimde gosterilir', async () => {
    vi.mocked(getStats).mockResolvedValue(fullStats)
    renderStats()

    // 754 sn -> 12 dk 34 sn
    expect(await screen.findByText(/12 dk 34 sn/)).toBeInTheDocument()
  })

  it('FR-011: tamamlanma orani sayi ve yuzde olarak gosterilir', async () => {
    vi.mocked(getStats).mockResolvedValue(fullStats)
    renderStats()

    const region = await screen.findByRole('region', { name: /tamamlanma/i })
    expect(within(region).getByText(/30/)).toBeInTheDocument()
    expect(within(region).getByText(/12/)).toBeInTheDocument()
    // 30 / 42 = %71
    expect(within(region).getByText(/71/)).toBeInTheDocument()
  })

  it('FR-012: token zaman serisi toplami metinsel olarak da gosterilir', async () => {
    vi.mocked(getStats).mockResolvedValue(fullStats)
    renderStats()

    const region = await screen.findByRole('region', { name: /token/i })
    // 100 + 0 + 250 = 350
    expect(within(region).getByText(/350/)).toBeInTheDocument()
  })

  it('#cost: pencere tahmini maliyeti token bolumunde metinsel gosterilir', async () => {
    vi.mocked(getStats).mockResolvedValue(fullStats)
    renderStats()

    const region = await screen.findByRole('region', { name: /token/i })
    // totalCostUsd "0.005250" -> "$0.005250"
    expect(within(region).getByText(/\$0\.005250/)).toBeInTheDocument()
  })

  it('FR-013: veri yokken hata degil, "veri yok" gorunumu sunulur', async () => {
    vi.mocked(getStats).mockResolvedValue(emptyStats)
    renderStats()

    // Uc grafigin ucu de kendi "veri yok" durumunu gosterir, ozet kartlari "—".
    expect(await screen.findAllByText(/veri yok/i)).toHaveLength(3)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('hata durumunda mesaj + tekrar dene gosterilir', async () => {
    vi.mocked(getStats)
      .mockRejectedValueOnce(
        new ApiError(500, {
          statusCode: 500,
          error: 'Error',
          message: 'Istatistikler yuklenemedi',
        }),
      )
      .mockResolvedValueOnce(fullStats)
    renderStats()

    expect(
      await screen.findByText('Istatistikler yuklenemedi'),
    ).toBeInTheDocument()
  })
})
