import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import InterviewListPage from '@/pages/interview/list'
import {
  listInterviews,
  deleteInterview,
  ApiError,
  type InterviewListItem,
} from '@/lib/interview-client'

// T012/T013/T015 (004-history US1, FR-002/003/004/015) + T042 (US4 silme
// entegrasyonu): "Interview History" listesi — kart rozetleri, siralama, bos
// durum, ag hatasinda tekrar dene, silme sonrasi aninda kaybolma.
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return {
    ...actual,
    listInterviews: vi.fn(),
    deleteInterview: vi.fn(),
  }
})

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/interviews']}>
      <Routes>
        <Route path="/interviews" element={<InterviewListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const baseItem: InterviewListItem = {
  id: 'iv-1',
  position: 'Backend Gelistirici',
  status: 'completed',
  reportStatus: 'ready',
  mode: 'written',
  level: 'senior',
  language: 'tr',
  questionCount: 5,
  createdAt: '2026-08-01T00:00:00.000Z',
  completedAt: '2026-08-01T01:00:00.000Z',
}

describe('InterviewListPage', () => {
  beforeEach(() => {
    vi.mocked(listInterviews).mockReset()
    vi.mocked(deleteInterview).mockReset()
  })

  it('FR-002: kart pozisyon, durum, mod ve level rozetini gosterir', async () => {
    vi.mocked(listInterviews).mockResolvedValue([baseItem])
    renderList()

    expect(await screen.findByText('Backend Gelistirici')).toBeInTheDocument()
    // Rozet etiketleri interview-filter.ts'ten gelir (arama ile tek kaynak);
    // ayni metin filtre cipinde de gectigi icin getAllByText kullanilir.
    expect(screen.getAllByText('Tamamlandı').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Yazılı').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Uzman').length).toBeGreaterThan(0)
  })

  it('FR-003: kartlar createdAt DESC sirali gosterilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue([
      { ...baseItem, id: 'iv-old', position: 'Eski Pozisyon', createdAt: '2026-07-01T00:00:00.000Z' },
      { ...baseItem, id: 'iv-new', position: 'Yeni Pozisyon', createdAt: '2026-08-01T00:00:00.000Z' },
    ])
    renderList()

    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Yeni Pozisyon', 'Eski Pozisyon'])
  })

  it('FR-004: gorusme yokken bos durum mesaji + yeni gorusme CTAsi gosterilir', async () => {
    vi.mocked(listInterviews).mockResolvedValue([])
    renderList()

    expect(
      await screen.findByText(/Henüz bir görüşme başlatmadın/),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Yeni görüşme/ }).length).toBeGreaterThan(0)
  })

  it('FR-015: ag hatasinda ErrorRetry gosterilir, tekrar dene yeniden yukler', async () => {
    vi.mocked(listInterviews)
      .mockRejectedValueOnce(
        new ApiError(500, { statusCode: 500, error: 'Error', message: 'Liste yuklenemedi' }),
      )
      .mockResolvedValueOnce([baseItem])
    const user = userEvent.setup()
    renderList()

    expect(await screen.findByText('Liste yuklenemedi')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tekrar dene/ }))
    expect(await screen.findByText('Backend Gelistirici')).toBeInTheDocument()
  })

  it('FR-011: silme onaylanirsa kart aninda listeden kaldirilir (optimistic)', async () => {
    vi.mocked(listInterviews).mockResolvedValue([baseItem])
    vi.mocked(deleteInterview).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderList()

    await screen.findByText('Backend Gelistirici')
    // Silme uc nokta menusunun icinde (007-ui-design rotusu) — Radix menu
    // kapaliyken icerigi DOM'a basmaz, once tetikleyici acilmali.
    await user.click(screen.getByRole('button', { name: 'Daha fazla' }))
    await user.click(screen.getByText('Sil'))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: /sil/i }))

    expect(deleteInterview).toHaveBeenCalledWith('iv-1')
    expect(await screen.findByText(/Henüz bir görüşme başlatmadın/)).toBeInTheDocument()
  })
})

// 004-history uzantisi — filtre-arama.md (issue #42).
describe('InterviewListPage — filtreleme ve arama', () => {
  const items: InterviewListItem[] = [
    baseItem,
    {
      ...baseItem,
      id: 'iv-2',
      position: 'Data Analisti',
      status: 'in_progress',
      reportStatus: 'not_applicable',
      mode: 'voice',
      level: 'junior',
      createdAt: '2026-07-20T00:00:00.000Z',
      completedAt: null,
    },
    {
      ...baseItem,
      id: 'iv-3',
      position: 'Frontend Gelistirici',
      mode: 'voice',
      level: 'intern',
      createdAt: '2026-07-10T00:00:00.000Z',
    },
  ]

  const positions = () =>
    screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

  beforeEach(() => {
    vi.mocked(listInterviews).mockReset()
    vi.mocked(deleteInterview).mockReset()
    vi.mocked(listInterviews).mockResolvedValue(items)
  })

  it('FR-018/021: durum cipleri sayac rozetiyle gelir ve listeyi daraltir', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Backend Gelistirici')

    const durum = screen.getByRole('group', { name: 'Durum' })
    expect(within(durum).getByRole('button', { name: 'Tümü, 3 sonuç' })).toBeInTheDocument()
    expect(
      within(durum).getByRole('button', { name: 'Tamamlandı, 2 sonuç' }),
    ).toBeInTheDocument()

    await user.click(within(durum).getByRole('button', { name: 'Yarım Kaldı, 1 sonuç' }))
    expect(positions()).toEqual(['Data Analisti'])
    expect(screen.getByText('3 görüşmeden 1 tanesi gösteriliyor')).toBeInTheDocument()

    await user.click(within(durum).getByRole('button', { name: /^Tümü/ }))
    expect(positions()).toHaveLength(3)
  })

  it('FR-019: arama pozisyon ve rozet metinlerinde calisir', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Backend Gelistirici')

    const box = screen.getByRole('searchbox', { name: /ara/i })
    await user.type(box, 'front')
    expect(positions()).toEqual(['Frontend Gelistirici'])

    await user.clear(box)
    await user.type(box, 'sozlu')
    expect(positions()).toEqual(['Data Analisti', 'Frontend Gelistirici'])
  })

  it('FR-020: seviye cipleri coklu secilir (OR), mod ile AND birlesir', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Backend Gelistirici')

    await user.click(screen.getByRole('button', { name: /Filtreler/ }))
    const seviye = screen.getByRole('group', { name: 'Deneyim' })
    await user.click(within(seviye).getByRole('button', { name: /^Orta/ }))
    await user.click(within(seviye).getByRole('button', { name: /^Giriş/ }))
    // Set ici OR: Junior (Orta) VEYA Stajyer (Giris).
    expect(positions()).toEqual(['Data Analisti', 'Frontend Gelistirici'])

    // Setler arasi AND: Senior (Uzman) eklenip mod Yazili secilince yalnizca
    // senior+written kayit kalir (junior/intern kayitlari sozlu).
    await user.click(within(seviye).getByRole('button', { name: /^Uzman/ }))
    const mod = screen.getByRole('group', { name: 'Mod' })
    await user.click(within(mod).getByRole('button', { name: /^Yazılı/ }))
    expect(positions()).toEqual(['Backend Gelistirici'])
  })

  it('FR-021a: sayaci 0 olan cip pasif, secili cip pasiflesmez', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Backend Gelistirici')

    await user.click(screen.getByRole('button', { name: /Filtreler/ }))
    const mod = screen.getByRole('group', { name: 'Mod' })
    await user.click(within(mod).getByRole('button', { name: 'Yazılı, 1 sonuç' }))

    const seviye = screen.getByRole('group', { name: 'Deneyim' })
    // Yazili tek kayit Senior (Uzman); digerleri 0 sayacla pasif olur.
    expect(within(seviye).getByRole('button', { name: 'Orta, 0 sonuç' })).toBeDisabled()
    // Secili cip her zaman tiklanabilir kalir (geri alinabilmeli).
    expect(within(mod).getByRole('button', { name: 'Yazılı, 1 sonuç' })).toBeEnabled()
  })

  it('FR-022/023: bos sonuc ayri bos durum gosterir, temizleme listeyi geri getirir', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('Backend Gelistirici')

    await user.type(screen.getByRole('searchbox', { name: /ara/i }), 'bulunamayacak')
    expect(screen.getByText('Seçtiğin filtrelerle eşleşen görüşme yok.')).toBeInTheDocument()
    expect(screen.queryByText(/Henüz bir görüşme başlatmadın/)).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Filtreleri temizle' })[0])
    expect(positions()).toHaveLength(3)
  })

  it('FR-024: hic gorusme yokken filtre cubugu render edilmez', async () => {
    vi.mocked(listInterviews).mockResolvedValue([])
    renderList()

    await screen.findByText(/Henüz bir görüşme başlatmadın/)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Durum' })).not.toBeInTheDocument()
  })
})
