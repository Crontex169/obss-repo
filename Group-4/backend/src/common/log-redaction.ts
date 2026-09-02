// DOSYA REHBERİ: Loglara e-posta adresinin DÜZ hâliyle değil, geri
// döndürülemez bir takma adla (acct_xxxxx) yazılmasını sağlayan fonksiyon.
// Basit hash değil özellikle imzalı (HMAC) bir yöntem kullanır — çünkü
// e-posta adresleri tahmin edilebilir olduğundan düz hash kolayca "kırılabilir".
import { createHmac } from 'node:crypto';

//Loglara e-posta adresinin düz hâliyle değil, geri döndürülemez bir takma adla ( acct_xxxxx ) yazılmasını sağlayan fonksiyon.
//  Basit hash değil özellikle imzalı (HMAC) bir yöntem kullanır — çünkü e-posta adresleri tahmin edilebilir olduğundan düz hash kolayca "kırılabilir".

// docs/SECURITY.md S8 — loglarda kisisel veri.
//
// Guvenlik olaylari kayit altina ALINMALIDIR (FR-012: sessiz basarisizlik
// yasak), ama kaydin kimligi duz e-posta olmak zorunda degil. Proje KVKK
// aydinlatma metni, onay akisi ve unutulma hakki (hesap silme) tasiyor;
// hesap silindiginde kisisel veri veritabanindan dusuyor ama loglarda
// kaliyordu.
//
// NEDEN duz SHA-256 DEGIL, HMAC: e-posta adreslerinin arama uzayi kucuktur;
// anahtarsiz bir ozet, elindeki adres listesini deneyen biri tarafindan
// geri cozulur. BETTER_AUTH_SECRET ile anahtarlanan HMAC, sirri bilmeyen icin
// bu yolu kapatir. Sonuc yine de takma-adlastirmadir (pseudonymization),
// anonimlestirme DEGIL: ayni e-posta her zaman ayni etiketi uretir, ki
// korelasyon zaten logun amacidir.
export function redactEmail(email: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? '';
  const digest = createHmac('sha256', secret)
    .update(email.toLowerCase())
    .digest('hex');
  // Korelasyon icin 12 karakter yeterli; tam ozeti tasimak logu sisirir.
  return `acct_${digest.slice(0, 12)}`;
}
