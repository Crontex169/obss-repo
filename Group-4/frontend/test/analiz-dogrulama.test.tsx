import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import AdminLoginPage from '@/pages/admin/login';

vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: vi.fn() }, signUp: { email: vi.fn() } },
}));

// ANALIZ DOGRULAMA (frontend)
// Bu dosya, inceleme oturumunda tespit edilen ACIK BULGULARI temsil eder ve
// bilincli olarak KIRMIZIDIR. Bulgu giderildiginde yesile doner.
// User story: specs/degerlendirme-user-stories.md — DS-06-E2
// Kriter: Uygulama Kullanici Deneyimi (%6)

describe('DS-06-E2 — form alanlari erisilebilir etiket tasimali', () => {
  // Bulgu: alanlarda yalnizca `placeholder` var. Placeholder erisilebilir ad
  // DEGILDIR: odaklaninca kaybolur ve ekran okuyucular icin guvenilir bir
  // etiket saglamaz. Her alanin <label>, aria-label veya aria-labelledby ile
  // programatik bir adi olmalidir.

  // 007-ui-design: giris iki adimli — sifre alani ancak e-posta adimi
  // gecildikten sonra DOM'a girer, bu yuzden once adim ilerletilir.
  async function girisSifreAdimi() {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText(/e-posta/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Devam et' }));
  }

  it('LoginForm: e-posta ve sifre alanlari etiketle bulunabilmeli', async () => {
    await girisSifreAdimi();
    // Tam eslesme: /şifre/i goz ikonunun "Şifreyi göster" aria-label'ini de yakalar.
    expect(screen.getByLabelText('Şifre')).toBeInTheDocument();
  });

  it('RegisterForm: e-posta ve sifre alanlari etiketle bulunabilmeli', () => {
    render(<RegisterForm />);
    expect(screen.getByLabelText(/e-posta/i)).toBeInTheDocument();
    // Tam eslesme: /şifre/i hem "Şifre" hem "Şifre Tekrar" alanini yakalar.
    expect(screen.getByLabelText('Şifre')).toBeInTheDocument();
    expect(screen.getByLabelText('Şifre Tekrar')).toBeInTheDocument();
  });

  it('AdminLoginPage: e-posta ve sifre alanlari etiketle bulunabilmeli', () => {
    render(<AdminLoginPage />);
    expect(screen.getByLabelText(/e-posta/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sifre|şifre/i)).toBeInTheDocument();
  });

  it('kontrol grubu: alanlar zaten DOM de var (sorun yalnizca etiketleme)', async () => {
    await girisSifreAdimi();
    expect(document.querySelector('input[type="password"]')).not.toBeNull();
    // E-posta alani sifre adiminda artik gorunmuyor; ilk adimda oldugu
    // yukaridaki type() cagrisiyla zaten kanitlandi.
  });
});
