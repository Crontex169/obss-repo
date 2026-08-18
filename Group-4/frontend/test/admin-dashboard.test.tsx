import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminDashboardPage from '@/pages/admin/dashboard'
import {
  listInterviews,
  type AdminInterviewListItem,
  type AdminInterviewListResponse,
} from '@/lib/admin-client'
import { ApiError } from '@/lib/interview-client'

// 005-admin US1 / T013 (FR-002, FR-003, FR-004, FR-014): admin gorusme listesi
// tablosu — sahibi e-postasi, pozisyon, tarih, durum rozeti, "Silindi" rozeti,
// meslek filtresi ve sayfalama.
vi.mock('@/lib/admin-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-client')>(
    '@/lib/admin-client',
  )
  return { ...actual, listInterviews: vi.fn() }
})

const baseItem: AdminInterviewListItem = {
  id: 'iv-1',
  ownerEmail: 'aday@example.com',
  position: 'Backend Gelistirici',
  positionLabel: 'Backend Gelistirici',
  status: 'completed',
  createdAt: '2026-08-01T09:00:00.000Z',
  completedAt: '2026-08-01T09:20:00.000Z',
  deletedAt: null,
}

function response(
  items: AdminInterviewListItem[],
  overrides: Partial<AdminInterviewListResponse> = {},
): AdminInterviewListResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    ...overrides,
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin/dashboard']}>
      <AdminDashboardPage />
    </MemoryRouter>,
  )
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(listInterviews).mockReset()
  })

  it('FR-002: her satirda sahibinin e-postasi, pozisyon, tarih ve durum rozeti gosterilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue(response([baseItem]))
    renderDashboard()

    const row = (await screen.findByText('aday@example.com')).closest('tr')!
    // Pozisyon adi filtre <option>'unda da geciyor; iddia satira kapsanir.
    expect(within(row).getByText('Backend Gelistirici')).toBeInTheDocument()
    expect(within(row).getByText('Tamamlandı')).toBeInTheDocument()
  })

  it('FR-004: yalnizca deletedAt dolu satirda "Silindi" rozeti gorunur', async () => {
    vi.mocked(listInterviews).mockResolvedValue(
      response([
        baseItem,
        {
          ...baseItem,
          id: 'iv-2',
          ownerEmail: 'silinmis@example.com',
          deletedAt: '2026-08-02T10:00:00.000Z',
        },
      ]),
    )
    renderDashboard()

    const deletedRow = (await screen.findByText('silinmis@example.com')).closest('tr')!
    expect(within(deletedRow).getByText('Silindi')).toBeInTheDocument()

    const aliveRow = screen.getByText('aday@example.com').closest('tr')!
    expect(within(aliveRow).queryByText('Silindi')).toBeNull()
  })

  it('positionLabel "Belirsiz" oldugunda o etiket gosterilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue(
      response([{ ...baseItem, position: null, positionLabel: 'Belirsiz' }]),
    )
    renderDashboard()

    expect(await screen.findByText('Belirsiz')).toBeInTheDocument()
  })

  it('FR-003: meslek filtresi secildiginde istek o pozisyonla yeniden yapilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue(
      response([
        baseItem,
        {
          ...baseItem,
          id: 'iv-2',
          ownerEmail: 'ikinci@example.com',
          position: 'Frontend Gelistirici',
          positionLabel: 'Frontend Gelistirici',
        },
      ]),
    )
    const user = userEvent.setup()
    renderDashboard()

    await screen.findByText('aday@example.com')
    // shadcn/ui Select = Radix listbox: native selectOptions calismaz, secim
    // tetikleyiciyi acip ogeye tiklayarak yapilir.
    await user.click(screen.getByLabelText(/meslek/i))
    await user.click(
      await screen.findByRole('option', { name: 'Frontend Gelistirici' }),
    )

    expect(vi.mocked(listInterviews).mock.calls.at(-1)![0]).toMatchObject({
      position: 'Frontend Gelistirici',
    })
  })

  it('FR-003: "Belirsiz" secimi unspecified parametresiyle sorgulanir', async () => {
    vi.mocked(listInterviews).mockResolvedValue(
      response([{ ...baseItem, position: null, positionLabel: 'Belirsiz' }]),
    )
    const user = userEvent.setup()
    renderDashboard()

    await screen.findByText('aday@example.com')
    await user.click(screen.getByLabelText(/meslek/i))
    await user.click(await screen.findByRole('option', { name: 'Belirsiz' }))

    expect(vi.mocked(listInterviews).mock.calls.at(-1)![0]).toMatchObject({
      position: 'unspecified',
    })
  })

  it('FR-014: sonraki sayfa butonu page=2 ile yeniden sorgular', async () => {
    vi.mocked(listInterviews).mockResolvedValue(
      response([baseItem], { total: 25, page: 1, pageSize: 20 }),
    )
    const user = userEvent.setup()
    renderDashboard()

    await screen.findByText('aday@example.com')
    await user.click(screen.getByRole('button', { name: /sonraki/i }))

    expect(vi.mocked(listInterviews).mock.calls.at(-1)![0]).toMatchObject({
      page: 2,
    })
  })

  it('kayit yokken bos durum mesaji gosterilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue(response([]))
    renderDashboard()

    expect(await screen.findByText(/görüşme kaydı yok/i)).toBeInTheDocument()
  })

  it('hata durumunda mesaj + tekrar dene gosterilir', async () => {
    vi.mocked(listInterviews)
      .mockRejectedValueOnce(
        new ApiError(500, {
          statusCode: 500,
          error: 'Error',
          message: 'Liste yuklenemedi',
        }),
      )
      .mockResolvedValueOnce(response([baseItem]))
    const user = userEvent.setup()
    renderDashboard()

    expect(await screen.findByText('Liste yuklenemedi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /tekrar dene/i }))
    expect(await screen.findByText('aday@example.com')).toBeInTheDocument()
  })

  it('FR-008: salt-okunur panel — hicbir satirda silme/duzenleme aksiyonu render edilmez', async () => {
    vi.mocked(listInterviews).mockResolvedValue(response([baseItem]))
    renderDashboard()

    await screen.findByText('aday@example.com')
    expect(screen.queryByRole('button', { name: /sil/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /düzenle/i })).toBeNull()
  })
})
