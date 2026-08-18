import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLoginPage from '@/pages/admin/login'
import { authClient } from '@/lib/auth-client'

vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn() } },
}))

// Degerlendirme kriteri 1 (Yetkilendirme %6) + 14 (UX %6)
// User story: specs/degerlendirme-user-stories.md — DS-02, DS-06
describe('DS-06 — Admin giris ekrani', () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.email).mockReset()
  })

  it('DS-06-K1: Google ile giris secenegi SUNULMAZ (FR-006 UX tarafi)', () => {
    render(<AdminLoginPage />)

    expect(screen.queryByText(/google/i)).toBeNull()
    const dugmeler = screen.getAllByRole('button')
    for (const dugme of dugmeler) {
      expect(dugme.textContent ?? '').not.toMatch(/google/i)
    }
  })

  it('DS-06-K1b: yalnizca e-posta ve Şifre alanlari vardir', () => {
    const { container } = render(<AdminLoginPage />)

    const inputlar = container.querySelectorAll('input')
    const tipler = Array.from(inputlar).map((i) => i.getAttribute('type'))
    expect(tipler).toEqual(['email', 'password'])
  })

  it('DS-06-H1: dogru bilgilerle gonderim signIn.email cagirir', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({ error: null } as never)
    const user = userEvent.setup()
    render(<AdminLoginPage />)

    await user.type(screen.getByPlaceholderText('E-posta'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('Şifre'), 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'Parola12',
    })
  })

  it('DS-06-K2: istek surerken ikinci gonderim ENGELLENIR (cift gonderim yok)', async () => {
    // Cozulmemis promise -> form "loading" durumunda kalir
    vi.mocked(authClient.signIn.email).mockReturnValue(
      new Promise(() => {}) as never,
    )
    const user = userEvent.setup()
    render(<AdminLoginPage />)

    await user.type(screen.getByPlaceholderText('E-posta'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('Şifre'), 'Parola12')

    const dugme = screen.getByRole('button')
    await user.click(dugme)
    await user.click(dugme)
    await user.click(dugme)

    expect(authClient.signIn.email).toHaveBeenCalledTimes(1)
    expect(dugme).toBeDisabled()
  })

  it('DS-06-E1: sunucu hatasi kullaniciya gosterilir, sayfa sessiz kalmaz', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: 'Kimlik bilgileri hatali' },
    } as never)
    const user = userEvent.setup()
    render(<AdminLoginPage />)

    await user.type(screen.getByPlaceholderText('E-posta'), 'admin@example.com')
    await user.type(screen.getByPlaceholderText('Şifre'), 'yanlis')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(await screen.findByText('Kimlik bilgileri hatali')).toBeInTheDocument()
  })
})
