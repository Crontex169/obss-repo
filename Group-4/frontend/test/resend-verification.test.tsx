import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResendVerification } from '@/components/auth/resend-verification'
import { authClient } from '@/lib/auth-client'

vi.mock('@/lib/auth-client', () => ({
  authClient: { sendVerificationEmail: vi.fn() },
}))

// 009: dogrulama maili suresi dolan kullanicinin telafi yolu.
// Yanit HER DURUMDA ayni genel mesaji verir — Better Auth ucu kayitsiz/zaten
// dogrulanmis e-postada da 200 doner ve zamanlamayi esitler, bu yuzden istemci
// tarafi da hesap varligini ele vermemelidir (API_CONVENTIONS.md §2).
describe('ResendVerification', () => {
  beforeEach(() => {
    vi.mocked(authClient.sendVerificationEmail).mockReset()
  })

  it('e-posta biliniyorsa alan sormaz, dogrudan gonderir', async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({} as never)
    const user = userEvent.setup()
    render(<ResendVerification email="test@example.com" />)

    expect(screen.queryByPlaceholderText('E-posta')).toBeNull()
    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'test@example.com',
    })
  })

  it('e-posta bilinmiyorsa kullanicidan ister ve onu gonderir', async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({} as never)
    const user = userEvent.setup()
    render(<ResendVerification />)

    await user.type(screen.getByPlaceholderText('E-posta'), 'baska@example.com')
    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))

    expect(authClient.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'baska@example.com',
    })
  })

  it('gonderim sonrasi genel onay mesaji gosterir', async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({} as never)
    const user = userEvent.setup()
    render(<ResendVerification email="test@example.com" />)

    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))
    expect(await screen.findByText(/kayıtlıysa/i)).toBeInTheDocument()
  })

  it('hata durumunda da AYNI genel mesaji gosterir (hesap varligi sizmaz)', async () => {
    vi.mocked(authClient.sendVerificationEmail).mockRejectedValue(
      new Error('boom'),
    )
    const user = userEvent.setup()
    render(<ResendVerification email="yok@example.com" />)

    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))
    expect(await screen.findByText(/kayıtlıysa/i)).toBeInTheDocument()
  })

  it('gonderildikten sonra buton tekrar gonderime kapanir (kaza tekrari onler)', async () => {
    vi.mocked(authClient.sendVerificationEmail).mockResolvedValue({} as never)
    const user = userEvent.setup()
    render(<ResendVerification email="test@example.com" />)

    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))
    await screen.findByText(/kayıtlıysa/i)
    expect(screen.queryByRole('button', { name: /tekrar gönder/i })).toBeNull()
  })

  it('e-posta girilmeden gonderilmez', async () => {
    const user = userEvent.setup()
    render(<ResendVerification />)

    await user.click(screen.getByRole('button', { name: /tekrar gönder/i }))
    expect(authClient.sendVerificationEmail).not.toHaveBeenCalled()
  })
})
