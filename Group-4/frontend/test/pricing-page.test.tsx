import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import PricingPage from '@/pages/billing/pricing'
import { getKvkkConsentStatus, type AccountStatus } from '@/lib/users-client'
import {
  createCheckoutSession,
  createPortalSession,
} from '@/lib/billing-client'

vi.mock('@/lib/users-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/users-client')>()
  return { ...actual, getKvkkConsentStatus: vi.fn() }
})
vi.mock('@/lib/billing-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/billing-client')>()
  return {
    ...actual,
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
  }
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <PricingPage />
    </MemoryRouter>,
  )

// 010-odeme-abonelik US2. Kart bilgisi bu uygulamada HIC toplanmaz — sayfa
// yalnizca saglayicinin barindirdigi odeme sayfasina yonlendirir.
describe('PricingPage', () => {
  const assign = vi.fn()

  beforeEach(() => {
    vi.mocked(getKvkkConsentStatus).mockReset()
    vi.mocked(createCheckoutSession).mockReset()
    vi.mocked(createPortalSession).mockReset()
    assign.mockReset()
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(accountStatus())
    Object.defineProperty(window, 'location', {
      value: { assign },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uc kademeyi kotalariyla birlikte listeler', async () => {
    renderPage()

    expect(await screen.findByText('Ücretsiz')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Pro+')).toBeInTheDocument()
    expect(screen.getByText('aylık 3 görüşme')).toBeInTheDocument()
    expect(screen.getByText('aylık 50 görüşme')).toBeInTheDocument()
    expect(screen.getByText('aylık 100 görüşme')).toBeInTheDocument()
  })

  it('FIYAT GOSTERMEZ — tutar yalnizca saglayicida tanimli', async () => {
    renderPage()

    await screen.findByText('Ücretsiz')
    // Para birimi isareti gecmemeli; fiyati elle yazmak iki kaynagi ayirirdi.
    expect(document.body.textContent).not.toMatch(/[₺$€]/)
  })

  it('kademe secilince checkout acilir ve saglayiciya yonlendirilir', async () => {
    vi.mocked(createCheckoutSession).mockResolvedValue(
      'https://checkout.stripe.test/oturum',
    )
    renderPage()

    const buttons = await screen.findAllByRole('button', {
      name: 'Bu plana geç',
    })
    await userEvent.click(buttons[0])

    await waitFor(() =>
      expect(createCheckoutSession).toHaveBeenCalledWith('pro'),
    )
    expect(assign).toHaveBeenCalledWith('https://checkout.stripe.test/oturum')
  })

  it('ucretsiz kademe icin satin alma dugmesi YOKTUR', async () => {
    renderPage()

    await screen.findByText('Ücretsiz')
    // Free + Pro + Pro+ arasindan yalnizca iki ucretli kademe dugme gosterir.
    expect(
      screen.getAllByRole('button', { name: 'Bu plana geç' }),
    ).toHaveLength(2)
  })

  it('ucretsiz kullaniciya abonelik yonetimi GOSTERILMEZ', async () => {
    renderPage()

    await screen.findByText('Ücretsiz')
    expect(
      screen.queryByRole('button', { name: 'Aboneliği yönet' }),
    ).not.toBeInTheDocument()
  })

  it('ucretli kullaniciya mevcut plani isaretlenir ve yonetim sunulur', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ plan: 'pro', interviewsLimit: 50 }),
    )
    vi.mocked(createPortalSession).mockResolvedValue(
      'https://portal.stripe.test/oturum',
    )
    renderPage()

    expect(await screen.findByText('Kullandığın plan')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Aboneliği yönet' }),
    )
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://portal.stripe.test/oturum'),
    )
  })

  it('checkout acilamazsa yonlendirme YAPILMAZ', async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error('bozuk'))
    renderPage()

    const buttons = await screen.findAllByRole('button', {
      name: 'Bu plana geç',
    })
    await userEvent.click(buttons[0])

    await waitFor(() => expect(createCheckoutSession).toHaveBeenCalled())
    expect(assign).not.toHaveBeenCalled()
  })
})
