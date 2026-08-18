import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '@/components/auth/register-form'
import { authClient } from '@/lib/auth-client'

vi.mock('@/lib/auth-client', () => ({
  authClient: { signUp: { email: vi.fn() } },
}))

// 007-ui-design "Screen - Register": sifre tekrari eklendi — YALNIZCA istemci
// tarafi kontroldur, sunucuya boyle bir alan gitmez. Sartlar onayi bu formdan
// KALDIRILDI (issue #71); onay artik ilk giriste ConsentGateDialog'da alinir.
async function formuDoldur(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
  passwordAgain = password,
) {
  await user.type(screen.getByLabelText('E-posta'), email)
  await user.type(screen.getByLabelText('Şifre'), password)
  await user.type(screen.getByLabelText('Şifre Tekrar'), passwordAgain)
}

// Hikaye 1: kayit formu UX. Istemci dogrulama yoktur (yalnizca HTML5
// `required`); gercek dogrulama sunucu tarafindadir (Ilke V) — bu testler
// formun sunucu yanitina gore dogru davrandigini kontrol eder.
describe('RegisterForm', () => {
  beforeEach(() => {
    vi.mocked(authClient.signUp.email).mockReset()
  })

  it('gecerli girdiyle gonderir ve basari mesaji gosterir', async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<RegisterForm />)

    await formuDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Kayıt ol/ }))

    expect(authClient.signUp.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Parola12',
      name: '',
    })
    await waitFor(() =>
      expect(screen.getByText(/Kayıt alındı/)).toBeInTheDocument(),
    )
  })

  it('sunucu hatasinda hata mesaji gosterir', async () => {
    vi.mocked(authClient.signUp.email).mockResolvedValue({
      error: { message: 'E-posta zaten kullanimda' },
    } as never)
    const user = userEvent.setup()
    render(<RegisterForm />)

    await formuDoldur(user, 'dup@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Kayıt ol/ }))

    expect(
      await screen.findByText('E-posta zaten kullanimda'),
    ).toBeInTheDocument()
  })

  it('e-posta bos birakilirsa gonderim engellenir (HTML5 required)', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole('button', { name: /Kayıt ol/ }))

    expect(authClient.signUp.email).not.toHaveBeenCalled()
  })

  it('sifre tekrari eslesmezse istek GONDERILMEZ', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await formuDoldur(user, 'test@example.com', 'Parola12', 'Parola34')
    await user.click(screen.getByRole('button', { name: /Kayıt ol/ }))

    expect(await screen.findByText('Şifreler eşleşmiyor')).toBeInTheDocument()
    expect(authClient.signUp.email).not.toHaveBeenCalled()
  })

  // issue #71: onay kutusu formdan kaldirildi. Kutu geri gelirse Google ile
  // giren kullanici onu yine atlayacagi icin asimetri de geri gelir.
  it('sartlar onay kutusu ARTIK YOK, yerine bilgilendirme notu var', async () => {
    render(<RegisterForm />)

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/ilk girişinde/)).toBeInTheDocument()
  })
})
