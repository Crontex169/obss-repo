// DOSYA REHBERİ: E-posta doğrulama, parola sıfırlama ve "sadece Google hesabın
// var" bilgilendirme e-postalarını gönderen servis. Ortam değişkenine göre ya
// gerçekten Resend ile e-posta atar ya da geliştirme modunda linki konsola yazar.
// Mail gonderim yolu: ADR-0008 (docs/DECISIONS.md) - Resend secildi (ucretsiz katman,
// resmi Node SDK). MAIL_TRANSPORT=console gelistirmede varsayilan (bloklamayan, mail
// hesabi gerektirmez); production'da MAIL_TRANSPORT=resend + RESEND_API_KEY.
import { Resend } from 'resend';



// Anayasa Ilke VI (sessiz basarisizlik yasak) / bulgu A6: Resend SDK API
// hatalarinda throw ETMEZ, { error } alaniyla doner — kontrol edilmezse mail
// sessizce gitmez ve kimse haberdar olmaz. Burada logla ve hatayi yukari firlat.
async function gonderVeDogrula(
  send: () => Promise<{ error?: { message?: string } | null }>,
  baglam: string,
): Promise<void> {
  try {
    const { error } = await send();
    if (error) {
      console.error(`[mail] ${baglam} gonderilemedi:`, error);
      throw new Error(
        `Mail gonderilemedi (${baglam}): ${error.message ?? String(error)}`,
      );
    }
  } catch (err) {
    console.error(`[mail] ${baglam} gonderirken beklenmeyen hata:`, err);
    throw err;
  }
}

// docs/SECURITY.md S8 notu: bu dosyadaki konsol ciktilari e-posta adresini DUZ
// tasimaya devam eder ve bu bilinclidir. Yalnizca MAIL_TRANSPORT="console"
// yolunda calisirlar; o yolun tek amaci gelistiricinin baglantiyi terminalden
// almasidir ve birden fazla test hesabi arasinda hangisinin oldugunu ayirt
// etmek icin adres gereklidir. Uretimde (MAIL_TRANSPORT="resend") bu satirlarin
// oncesinde `return` vardir, yani hic calismazlar. Kalici guvenlik olayi
// kayitlari (better-auth.config.ts [reset] satirlari) kullanici id'si veya
// anahtarlanmis takma ad kullanir.
//
// Dogrulama/sifirlama URL'leri ~220 karakter (JWT token). Terminal bunu sarar ve
// sarma noktasindan sonrasi tiklanabilir baglantiya DAHIL EDILMEZ: token kesik
// gider, kullanici sayfayi acar ama INVALID_TOKEN alir. OSC 8 kacis dizisi URL'i
// gorunur metinden ayirdigi icin sarma tiklamayi bozmaz. Desteklemeyen
// terminaller kacis dizisini yok sayar, bu yuzden ham URL de ayri satirda basilir
// (kopyala-yapistir icin).
function konsolaLinkYaz(baslik: string, url: string): void {
  const tiklanabilir = `\u001B]8;;${url}\u0007[baglantiyi ac]\u001B]8;;\u0007`;
  console.log(`[mail] ${baslik}: ${tiklanabilir}\n${url}`);
}

export async function sendVerificationEmail(
  email: string,
  url: string,
): Promise<void> {
  const transport = process.env.MAIL_TRANSPORT ?? 'console';

  if (transport === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await gonderVeDogrula(
      () =>
        resend.emails.send({
          from: process.env.MAIL_FROM ?? 'no-reply@example.com',
          to: email,
          subject: 'E-posta adresini dogrula',
          // url, Better Auth tarafindan BETTER_AUTH_SECRET ile imzalanmis (JWT) tek kullanimlik
          // bir dogrulama tokeni icerir - benzersiz ve sifrelidir (bkz. FR-019).
          html: `
        <p>Merhaba,</p>
        <p>Hesabını aktifleştirmek için doğrulama bağlantın aşağıdadır. Bu bağlantı sana özeldir ve tek seferlik kullanılır.</p>
        <p><a href="${url}">E-postamı doğrula</a></p>
        <p>Buton çalışmazsa aşağıdaki bağlantıyı tarayıcına yapıştırabilirsin:</p>
        <p>${url}</p>
        <p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
      `,
          text: `Merhaba,\n\nHesabını aktifleştirmek için doğrulama bağlantın aşağıdadır. Bu bağlantı sana özeldir ve tek seferlik kullanılır.\n\n${url}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        }),
      'dogrulama e-postasi',
    );
    return;
  }

  // Gelistirme davranisi: dogrulama linkini konsola yaz.
  konsolaLinkYaz(`E-posta dogrulama baglantisi (${email})`, url);
}

// 006-sifre-sifirlama FR-001/FR-013: sifirlama baglantisi YALNIZCA e-posta ile
// gider, API yanitinda asla ifsa edilmez. Ayni Resend/console transport'u
// yeniden kullanilir (ADR-0008).
export async function sendPasswordResetEmail(
  email: string,
  url: string,
): Promise<void> {
  const transport = process.env.MAIL_TRANSPORT ?? 'console';

  if (transport === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await gonderVeDogrula(
      () =>
        resend.emails.send({
          from: process.env.MAIL_FROM ?? 'no-reply@example.com',
          to: email,
          subject: 'Sifre sifirlama baglantin',
          html: `
        <p>Merhaba,</p>
        <p>Hesabının şifresini sıfırlamak için bir istek aldık. Aşağıdaki bağlantı tek kullanımlıktır ve 1 saat sonra geçersiz olur.</p>
        <p><a href="${url}">Şifremi sıfırla</a></p>
        <p>Buton çalışmazsa aşağıdaki bağlantıyı tarayıcına yapıştırabilirsin:</p>
        <p>${url}</p>
        <p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.</p>
      `,
          text: `Merhaba,\n\nHesabının şifresini sıfırlamak için bir istek aldık. Aşağıdaki bağlantı tek kullanımlıktır ve 1 saat sonra geçersiz olur.\n\n${url}\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.`,
        }),
      'sifre sifirlama e-postasi',
    );
    return;
  }

  konsolaLinkYaz(`Sifre sifirlama baglantisi (${email})`, url);
}

// 006-sifre-sifirlama US1 Senaryo 3: yalnizca-Google hesaplar icin sifirlanacak
// bir parola yok. Istek ucu yine ayni genel 200'u doner (FR-002), kullaniciya
// dogru yonlendirme yalnizca kendi posta kutusunda verilir.
export async function sendGoogleOnlyResetNoticeEmail(
  email: string,
): Promise<void> {
  const transport = process.env.MAIL_TRANSPORT ?? 'console';

  if (transport === 'resend') {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await gonderVeDogrula(
      () =>
        resend.emails.send({
          from: process.env.MAIL_FROM ?? 'no-reply@example.com',
          to: email,
          subject: 'Sifre sifirlama istegi',
          html: `
        <p>Merhaba,</p>
        <p>Bu hesap Google ile oluşturulmuş ve bir şifresi yok; bu yüzden sıfırlanacak bir şifre bulunmuyor.</p>
        <p>Giriş yapmak için <strong>Google ile giriş yapın</strong>.</p>
        <p>Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
      `,
          text: `Merhaba,\n\nBu hesap Google ile oluşturulmuş ve bir şifresi yok; bu yüzden sıfırlanacak bir şifre bulunmuyor.\n\nGiriş yapmak için Google ile giriş yapın.\n\nBu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
        }),
      'yalnizca-Google bilgilendirme e-postasi',
    );
    return;
  }

  console.log(
    `[mail] Yalnizca-Google hesap bilgilendirmesi (${email}): Google ile giris yapin`,
  );
}
