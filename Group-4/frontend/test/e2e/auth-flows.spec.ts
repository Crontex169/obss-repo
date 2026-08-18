import { test, expect, type Page } from '@playwright/test'
import { signVerificationToken } from './helpers/verification-token'
import { readResetToken } from './helpers/reset-token'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers/backend-env'

// ⚠️ 007-ui-design (v2.pen) UYGULANDI — bu dosyadaki KULLANICI auth secicileri
// degisti. Alanlar artik GORUNUR <label> tasiyor ve placeholder tasarim
// metnidir ("ornek@eposta.com", "••••••••"), yani placeholder'a bagli
// seciciler ARTIK CALISMAZ. Ayrica giris IKI ADIM: once e-posta + "Devam et",
// sonra sifre + "Giriş yap". Admin girisi (S4) tasarim kapsaminda degildi,
// oradaki placeholder seciciler oldugu gibi kaldi.
//
// getByLabel'de exact:true SART: 'Şifre' aksi halde 'Şifre Tekrar' alanini ve
// goz ikonunun "Şifreyi göster" aria-label'ini de yakalar.
async function kayitOl(page: Page, email: string, password = 'Parola12') {
  await page.goto('/register')
  await page.getByLabel('Ad Soyad').fill('E2E Test')
  await page.getByLabel('E-posta').fill(email)
  await page.getByLabel('Şifre', { exact: true }).fill(password)
  await page.getByLabel('Şifre Tekrar').fill(password)
  // issue #71: sartlar onay kutusu kayit formundan kaldirildi; onay ilk giriste
  // ConsentGateDialog ile aliniyor.
  await page.getByRole('button', { name: /Kayıt ol/ }).click()
}

async function girisYap(page: Page, email: string, password: string) {
  await page.getByLabel('E-posta').fill(email)
  await page.getByRole('button', { name: 'Devam et', exact: true }).click()
  await page.getByLabel('Şifre', { exact: true }).fill(password)
  await page.getByRole('button', { name: /Giriş yap/ }).click()
}

// quickstart.md S1-S6 uctan uca dogrulama. Not (kapsam):
// - S1/S2: gercek e-posta gonderimi yok (MAIL_TRANSPORT=console, ADR-0008
//   beklemede); dogrulama linki, Better Auth'un kendi imzalama semasiyla
//   burada uretilip GERCEK /verify-email ucuna gidilir (bkz. helpers/).
// - S3: gercek bir Google Cloud OAuth istemcisi henuz kayitli degil (bkz.
//   README); Google butonunun dogru sekilde OAuth akisini baslattigi
//   (accounts.google.com'a yonlendirme) dogrulanir, gercek onay ekrani
//   tamamlanmaz. Hesap baglama/admin reddi mantigi backend entegrasyon
//   testlerinde (us3-*.spec.ts) zaten dogrulandi.
// - S5 (sahiplik/rol): bu dilimde korunan gercek bir kaynak yok (spec Kapsam
//   Notu); sunucu tarafi guard davranisi backend entegrasyon testlerinde
//   (us5-*.spec.ts) zaten dogrulandi, burada tekrarlanmiyor.
//
// ⚠️ MERGE NOTU (2026-08-04, 005-admin dali) — bu dosyada 4 BEKLENTI guncellendi
// ------------------------------------------------------------------------------
// Bu testler 001-auth-rol yazilirken, sonraki dilimlerin rotalari daha ortada
// yokken yazilmisti ve o gunden beri UYGULAMAYLA UYUSMUYORDU (gercek backend
// ayakta kosulmadigi icin fark edilmemisti). Davranis DEGISTIRILMEDI, yalnizca
// beklentiler uygulamanin bugunku gercegine esitlendi:
//
//   S1, S6 : giris sonrasi '/' bekliyordu -> '/dashboard'
//            (login-form.tsx 002-interview'den beri oraya yonlendiriyor)
//   S2     : hata mesajini 'p.text-red-600' ile ariyordu -> [data-testid]
//            (tasarim token gecisinde sinif 'text-[var(--color-danger)]' oldu;
//            renk sinifina bagli secici yine eskiyeceginden testid'ye gecildi)
//   S4     : '/admin' bekliyordu -> '/admin/dashboard'
//            ('/admin' HIC var olmamis bir rotaydi; admin ekranlari 005-admin
//            ile geldi ve giris artik dashboard'a yonlendiriyor)
//   S7     : main ile birlestirmede ayni iki duzeltme uygulandi — giris sonrasi
//            '/dashboard', ve reset-password sayfasinin hatasi icin AYRI bir
//            testid ('reset-error'); login formununkiyle karistirilmamali.
//
// 001-auth-rol veya baska bir dal bu dosyaya paralel dokunduysa: catisma
// cikarsa DOGRU taraf, uygulamanin o anki yonlendirme/secici gercegidir —
// yukaridaki degerleri korumak yerine kodda ne oldugunu dogrulayin.
// ------------------------------------------------------------------------------

test.describe('S1 — Kayit + e-posta dogrulama', () => {
  test('gecerli bilgiyle kayit -> dogrulama -> giris basarili', async ({
    page,
  }) => {
    const email = `e2e-s1-${Date.now()}@example.com`

    await kayitOl(page, email)
    await expect(page.getByText(/Kayıt alındı/)).toBeVisible()

    const token = await signVerificationToken(email)
    await page.goto(`/verify-email?token=${token}`)
    await expect(page.getByText(/E-posta doğrulandı/)).toBeVisible()

    await page.goto('/login')
    await girisYap(page, email, 'Parola12')
    await expect(page).toHaveURL('/dashboard')
  })

  test('zayif Şifre -> dogrulama hatasi, kayit tamamlanmaz', async ({
    page,
  }) => {
    await kayitOl(page, `e2e-weak-${Date.now()}@example.com`, 'abc')
    await expect(page.getByText(/en az 8 karakter|Gecersiz/i)).toBeVisible()
  })
})

test.describe('S2 — Giris hata yolu', () => {
  test('yanlis Şifre -> genel hata mesaji (alan sizdirmaz)', async ({
    page,
  }) => {
    await page.goto('/login')
    await girisYap(page, 'mevcut-olmayan@example.com', 'YanlisSifre1')
    await expect(page.getByTestId('login-error')).toBeVisible()
  })
})

test.describe('S3 — Google butonu', () => {
  test('kullanici giris sayfasinda Google butonu var ve OAuth akisini baslatir', async ({
    page,
  }) => {
    await page.goto('/login')
    const googleButton = page.getByRole('button', {
      name: /Google ile Devam Et/,
    })
    await expect(googleButton).toBeVisible()

    await Promise.all([
      page
        .waitForURL(/accounts\.google\.com/, { timeout: 10000 })
        .catch(() => null),
      googleButton.click(),
    ])
    // Yerlesik (placeholder) client id ile Google gercek bir hata sayfasi
    // gosterebilir; onemli olan backend'in bizi accounts.google.com'a
    // yonlendirdigini (OAuth kickoff'un calistigini) dogrulamak.
    expect(page.url()).toContain('accounts.google.com')
  })

  test('admin giris sayfasinda Google butonu yok (FR-006)', async ({
    page,
  }) => {
    await page.goto('/admin/login')
    await expect(
      page.getByRole('button', { name: /Google ile Devam Et/ }),
    ).toHaveCount(0)
  })
})

test.describe('S4 — Admin girisi', () => {
  test('seed admin e-posta/Şifre ile Giriş yapar', async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByPlaceholder('E-posta').fill(ADMIN_EMAIL)
    await page.getByPlaceholder('Şifre').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /Giriş yap/ }).click()
    // 005-admin: admin panel ekranlari artik mevcut; giris /admin/dashboard'a
    // yonlendirir. (Onceki beklenti `/admin` hic var olmamis bir rotaydi.)
    await expect(page).toHaveURL('/admin/dashboard')
  })
})

// 006-sifre-sifirlama US1-US3. Token DB'den okunur (bkz. helpers/reset-token.ts);
// oturum sonlandirma (FR-008) ve genel-yanit sozlesmesi backend entegrasyon
// testlerinde (us-reset-*.spec.ts) zaten kanitli, burada UI yolu dogrulanir.
test.describe('S7 — Şifre sıfırlama', () => {
  const GENEL_MESAJ = /sistemde kayıtlıysa bir sıfırlama bağlantısı gönderildi/

  async function kayitliKullanici(page: Page) {
    const email = `e2e-s7-${Date.now()}@example.com`
    await kayitOl(page, email)
    await expect(page.getByText(/Kayıt alındı/)).toBeVisible()

    await page.goto(`/verify-email?token=${await signVerificationToken(email)}`)
    await expect(page.getByText(/E-posta doğrulandı/)).toBeVisible()
    return email
  }

  test('sifirlama istegi -> yeni sifre -> yeni sifreyle giris basarili', async ({
    page,
  }) => {
    const email = await kayitliKullanici(page)

    await page.goto('/forgot-password')
    await page.getByLabel('E-posta').fill(email)
    await page
      .getByRole('button', { name: /Sıfırlama bağlantısı gönder/ })
      .click()
    await expect(page.getByText(GENEL_MESAJ)).toBeVisible()

    await page.goto(`/reset-password?token=${readResetToken(email)}`)
    await page.getByLabel('Yeni Şifre', { exact: true }).fill('YeniParola34')
    await page.getByLabel('Yeni Şifre Tekrar').fill('YeniParola34')
    await page.getByRole('button', { name: /Şifreyi güncelle/ }).click()
    // 007-ui-design: basaridan sonra artik dogrudan /login'e atilmiyor, once
    // onay ekrani cikiyor ("Screen - Reset Password Success").
    await expect(page.getByText('Şifren Güncellendi')).toBeVisible()
    await page.getByRole('link', { name: /Giriş yap/ }).click()
    await expect(page).toHaveURL(/\/login$/)

    // Eski sifre artik gecersiz.
    await girisYap(page, email, 'Parola12')
    await expect(page.getByTestId('login-error')).toBeVisible()

    await page.getByLabel('Şifre', { exact: true }).fill('YeniParola34')
    await page.getByRole('button', { name: /Giriş yap/ }).click()
    await expect(page).toHaveURL('/dashboard')
  })

  test('kayitsiz e-posta da AYNI genel mesaji alir (hesap ifsa etmez, FR-002)', async ({
    page,
  }) => {
    await page.goto('/forgot-password')
    await page.getByLabel('E-posta').fill(`yok-${Date.now()}@example.com`)
    await page
      .getByRole('button', { name: /Sıfırlama bağlantısı gönder/ })
      .click()
    await expect(page.getByText(GENEL_MESAJ)).toBeVisible()
  })

  test('gecersiz token -> genel hata, sifre degismez (FR-009)', async ({
    page,
  }) => {
    const email = await kayitliKullanici(page)

    await page.goto('/reset-password?token=gecersiz-token-123')
    await page.getByLabel('Yeni Şifre', { exact: true }).fill('YeniParola34')
    await page.getByLabel('Yeni Şifre Tekrar').fill('YeniParola34')
    await page.getByRole('button', { name: /Şifreyi güncelle/ }).click()
    // Bu hata reset-password sayfasinin kendi hatasi, login formununki degil.
    await expect(page.getByTestId('reset-error')).toBeVisible()

    // Eski sifre hala calisiyor.
    await page.goto('/login')
    await girisYap(page, email, 'Parola12')
    await expect(page).toHaveURL('/dashboard')
  })

  test('tokensiz sayfa -> uyari ve yeni istek baglantisi', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(
      page.getByText(/Bağlantı geçersiz veya süresi dolmuş/),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: /Yeni istek gönder/ }),
    ).toBeVisible()
  })
})

test.describe('S6 — "Beni hatırla"', () => {
  test('isaretliyken kalici cerez (Max-Age) set edilir', async ({
    page,
    context,
  }) => {
    const email = `e2e-s6-${Date.now()}@example.com`
    await kayitOl(page, email)
    await expect(page.getByText(/Kayıt alındı/)).toBeVisible()

    const token = await signVerificationToken(email)
    await page.goto(`/verify-email?token=${token}`)
    await expect(page.getByText(/E-posta doğrulandı/)).toBeVisible()

    await page.goto('/login')
    // "Beni hatirla" kutusu tasarimda ikinci adimda (sifre ekrani).
    await page.getByLabel('E-posta').fill(email)
    // exact SART: Playwright'in varsayilan ad eslesmesi ALT DIZE arar,
    // "Devam et" aksi halde "Google ile Devam Et" butonunu da yakalar.
    await page.getByRole('button', { name: 'Devam et', exact: true }).click()
    await page.getByLabel('Şifre', { exact: true }).fill('Parola12')
    await page.getByLabel(/Beni hatırla/).check()
    await page.getByRole('button', { name: /Giriş yap/ }).click()
    await expect(page).toHaveURL('/dashboard')

    const cookies = await context.cookies()
    const sessionCookie = cookies.find(
      (c) => c.name === 'better-auth.session_token',
    )
    expect(sessionCookie).toBeDefined()
    // Playwright: kalici cerezlerde expires > 0 (unix saniye); session-scoped'ta -1.
    expect(sessionCookie!.expires).toBeGreaterThan(0)
  })
})
