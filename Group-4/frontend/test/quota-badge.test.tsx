import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QuotaBadge } from '@/components/quota-badge'
import { getKvkkConsentStatus, type AccountStatus } from '@/lib/users-client'

vi.mock('@/lib/users-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/users-client')>()
  return { ...actual, getKvkkConsentStatus: vi.fn() }
})

function accountStatus(over: Partial<AccountStatus> = {}): AccountStatus {
  return {
    kvkkConsentAt: null,
    hasPassword: true,
    cv: null,
    plan: 'free',
    interviewsUsed: 0,
    interviewsLimit: 3,
    ...over,
  }
}

const renderBadge = () =>
  render(
    <MemoryRouter>
      <QuotaBadge />
    </MemoryRouter>,
  )

// 010-odeme-abonelik US4: kotayi ancak reddedildiginde ogrenmek kotu bir
// deneyim. Rozet sayilari HESAPLAMAZ, sunucudan geleni gosterir.
describe('QuotaBadge', () => {
  beforeEach(() => {
    vi.mocked(getKvkkConsentStatus).mockReset()
  })

  it('kullanilan/toplam hakki gosterir', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ interviewsUsed: 1, interviewsLimit: 3 }),
    )

    renderBadge()

    expect(await screen.findByText('Bu ay 1/3 görüşme')).toBeInTheDocument()
  })

  it('kota dolunca uyari ve plan yukseltme baglantisi gosterir', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ interviewsUsed: 3, interviewsLimit: 3 }),
    )

    renderBadge()

    expect(await screen.findByText('Bu ayki hakkın doldu')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Planını yükselt' }),
    ).toHaveAttribute('href', '/billing')
  })

  it('kota dolmadan yukseltme baglantisi GOSTERILMEZ', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ interviewsUsed: 1, interviewsLimit: 3 }),
    )

    renderBadge()

    await screen.findByText('Bu ay 1/3 görüşme')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('ucretli planin limiti gosterilir', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ plan: 'pro_plus', interviewsUsed: 7, interviewsLimit: 100 }),
    )

    renderBadge()

    expect(await screen.findByText('Bu ay 7/100 görüşme')).toBeInTheDocument()
  })

  it('kota okunamazsa rozet HIC cizilmez — yanlis sayi gostermekten iyidir', async () => {
    vi.mocked(getKvkkConsentStatus).mockRejectedValue(new Error('ag hatasi'))

    const { container } = renderBadge()

    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})
