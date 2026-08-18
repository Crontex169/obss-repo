import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ForgotPasswordPage from '@/pages/forgot-password'
import { authClient } from '@/lib/auth-client'

vi.mock('@/lib/auth-client', () => ({
  authClient: { requestPasswordReset: vi.fn() },
}))

// 006-sifre-sifirlama US1 / FR-002: frontend hicbir ayrim YAPMAZ - basarili
// gonderimde her zaman ayni genel mesaji gosterir.
describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.mocked(authClient.requestPasswordReset).mockReset()
  })

  it('gecerli e-posta -> requestPasswordReset cagrilir, genel mesaj gosterilir', async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText('E-posta'), 'test@example.com')
    await user.click(
      screen.getByRole('button', { name: /Sıfırlama bağlantısı gönder/ }),
    )

    expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
      email: 'test@example.com',
      redirectTo: `${window.location.origin}/reset-password`,
    })
    expect(
      await screen.findByText(
        /sistemde kayıtlıysa bir sıfırlama bağlantısı gönderildi/i,
      ),
    ).toBeInTheDocument()
  })

  it('gecersiz e-posta bicimi -> istemci dogrulamasi, istek GONDERILMEZ', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    // type=email + required HTML5 dogrulamasini asmak icin dogrudan zod hatasini
    // tetikleyen bir deger kullanilir (login-form testindeki desenle ayni).
    await user.type(screen.getByLabelText('E-posta'), 'gecersiz')
    await user.click(
      screen.getByRole('button', { name: /Sıfırlama bağlantısı gönder/ }),
    )

    expect(authClient.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('siklik siniri asilirsa sunucu mesaji gosterilir (429)', async () => {
    vi.mocked(authClient.requestPasswordReset).mockResolvedValue({
      error: { message: 'Çok fazla şifre sıfırlama isteği gönderildi.' },
    } as never)
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText('E-posta'), 'test@example.com')
    await user.click(
      screen.getByRole('button', { name: /Sıfırlama bağlantısı gönder/ }),
    )

    expect(
      await screen.findByText(/Çok fazla şifre sıfırlama isteği/),
    ).toBeInTheDocument()
  })
})
