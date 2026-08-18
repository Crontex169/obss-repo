import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/components/auth/login-form'
import { authClient } from '@/lib/auth-client'

const refreshSession = vi.fn(() => Promise.resolve())
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn() }, sendVerificationEmail: vi.fn() },
  refreshSession: () => refreshSession(),
}))

// I4' (001 T098): basarili giriste SPA gecisi (navigate), tam sayfa yenilemesi degil.
const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))

// 007-ui-design: form iki adimli — once e-posta ("Devam et"), sonra sifre.
async function sifreAdimindaDoldur(
  user: ReturnType<typeof userEvent.setup>,
  email: string,
  password: string,
) {
  await user.type(screen.getByLabelText('E-posta'), email)
  await user.click(screen.getByRole('button', { name: 'Devam et' }))
  await user.type(screen.getByLabelText('Şifre'), password)
}

// Hikaye 2: giris formu UX ("Beni hatirla" -> rememberMe, US6).
describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.email).mockReset()
    navigate.mockReset()
    refreshSession.mockReset()
    refreshSession.mockResolvedValue(undefined)
  })

  // Hata: dogru bilgilerle ilk giris denemesi /login'e geri dusuyordu, ikinci
  // denemede calisiyordu. Kok neden: better-auth $sessionSignal'i 10ms
  // setTimeout ile gonderir (client/proxy.mjs) ve /login sayfasinda useSession
  // tuketicisi olmadigi icin session store mount DEGILDIR - sinyal duyulmaz.
  // signIn'den hemen sonra navigate edilince ProtectedRoute atom'un onceki
  // 401'den kalma degerini (data:null, isPending:false) okuyup geri atiyordu.
  it("navigate etmeden ONCE oturum store'unu tazeler", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { role: 'user' } },
      error: null,
    } as never)
    let release!: () => void
    refreshSession.mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve()
      }),
    )
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(refreshSession).toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled() // store tazelenmeden gecis yok

    release()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('kontrol grubu: giris hatasinda store tazelenmez', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: 'Kimlik bilgileri hatali' },
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'yanlis')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    await screen.findByTestId('login-error')
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('basarili giriste /dashboard adresine navigate eder (tam sayfa yenilemesi yok)', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { role: 'user' } },
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(navigate).toHaveBeenCalledWith('/dashboard')
  })

  // 005-admin: rol ayrimi yonlendirmede korunur (yetki yine sunucudaki RolesGuard'da).
  it('admin rolu /admin/dashboard adresine navigate eder', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { user: { role: 'admin' } },
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'admin@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(navigate).toHaveBeenCalledWith('/admin/dashboard')
  })

  it('kontrol grubu: giris hatasinda navigate cagrilmaz', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: 'Kimlik bilgileri hatali' },
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'yanlis')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(await screen.findByTestId('login-error')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('"Beni hatirla" isaretliyken rememberMe:true ile gonderir', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Parola12',
      rememberMe: true,
    })
  })

  it('isaretlenmezse rememberMe:false ile gonderir', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: null,
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(authClient.signIn.email).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'Parola12',
      rememberMe: false,
    })
  })

  it('sunucu hatasinda genel hata mesaji gosterir', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: 'Kimlik bilgileri hatali' },
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'yanlis')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(
      await screen.findByText('Kimlik bilgileri hatali'),
    ).toBeInTheDocument()
  })

  // 009: dogrulanmamis hesap cikmaz sokak olmasin — hatanin altinda telafi yolu.
  it('EMAIL_NOT_VERIFIED hatasinda dogrulama maili tekrar gonderme secenegi cikar', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { code: 'EMAIL_NOT_VERIFIED', message: 'Email not verified' },
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'Parola12')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(await screen.findByText(/doğrulanmadı/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /tekrar gönder/i }),
    ).toBeInTheDocument()
  })

  it('diger giris hatalarinda tekrar gonderme secenegi CIKMAZ', async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Kimlik bilgileri hatali',
      },
    } as never)
    const user = userEvent.setup()
    render(<LoginForm />)

    await sifreAdimindaDoldur(user, 'test@example.com', 'yanlis')
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    await screen.findByText('Kimlik bilgileri hatali')
    expect(screen.queryByRole('button', { name: /tekrar gönder/i })).toBeNull()
  })

  it('Şifre bos birakilirsa gonderim engellenir (HTML5 required)', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('E-posta'), 'test@example.com')
    await user.click(screen.getByRole('button', { name: 'Devam et' }))
    await user.click(screen.getByRole('button', { name: /Giriş yap/ }))

    expect(authClient.signIn.email).not.toHaveBeenCalled()
  })
})
