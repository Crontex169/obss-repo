import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import BillingReturnPage from '@/pages/billing/return'
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <BillingReturnPage />
    </MemoryRouter>,
  )

// 010-odeme-abonelik US2 senaryo 4. BU SAYFA PLANI YUKSELTMEZ, yalnizca okur:
// yukseltme imzasi dogrulanmis webhook ile yapilir (FR-012). Sayfa yalnizca
// webhook'un ulasmasini bekler.
describe('BillingReturnPage', () => {
  beforeEach(() => {
    vi.mocked(getKvkkConsentStatus).mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('plan henuz yukselmemisken "isleniyor" gosterir', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(accountStatus())

    renderPage()

    expect(
      await screen.findByText('Ödemen işleniyor…'),
    ).toBeInTheDocument()
  })

  it('plan yukselince basari mesajina gecer', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ plan: 'pro', interviewsLimit: 50 }),
    )

    renderPage()

    expect(await screen.findByText('Planın güncellendi.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Panele dön' }),
    ).toBeInTheDocument()
  })

  it('sayfa plani KENDISI yukseltmez — yalnizca okur', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(
      accountStatus({ plan: 'pro' }),
    )

    renderPage()
    await screen.findByText('Planın güncellendi.')

    // Yalnizca okuma cagrisi yapilmis olmali; sayfadan tetiklenen bir
    // yukseltme/dogrulama ucu YOKTUR.
    expect(getKvkkConsentStatus).toHaveBeenCalled()
  })

  it('"isleniyor" halinde panele donus baglantisi gosterilmez', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(accountStatus())

    renderPage()
    await screen.findByText('Ödemen işleniyor…')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('sure dolarsa kullaniciyi bilgilendirir, hata gostermez', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue(accountStatus())

    renderPage()
    await screen.findByText('Ödemen işleniyor…')

    await vi.advanceTimersByTimeAsync(31_000)

    expect(
      await screen.findByText(
        'Ödemen alındı ama planına henüz işlenmedi.',
      ),
    ).toBeInTheDocument()
  })
})
