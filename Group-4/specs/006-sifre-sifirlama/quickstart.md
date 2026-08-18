# Quickstart: Şifre Sıfırlama (manuel doğrulama)

Ön koşul: backend `npm run start:dev`, frontend `npm run dev`, Postgres ayakta,
`MAIL_TRANSPORT=console` (mail'i terminale basar, gerçek gönderim gerekmez).

1. `http://localhost:5174/login` → "Şifremi unuttum" bağlantısına tıkla.
2. Kayıtlı (parola ile) bir e-posta gir, gönder → genel "e-posta gönderildiyse
   kontrol edin" mesajını gör.
3. Backend terminalinde (console mail transport) sıfırlama linkini bul, tarayıcıda aç.
4. Yeni bir şifre gir (politika: en az 8 karakter, harf+rakam) → onayla.
5. Eski şifreyle giriş dene → REDDEDİLMELİ. Yeni şifreyle giriş dene → BAŞARILI olmalı.
6. (Varsa) sıfırlama öncesi başka bir sekmede açık kalan oturum → sıfırlama sonrası
   o oturumla yapılan istek de reddedilmeli (session revoke, FR-008).
7. Kayıtsız bir e-posta ile 2. adımı tekrarla → AYNI genel mesajı gör, hiçbir mail
   düşmemeli (enumeration koruması, FR-002/FR-003).
8. Yalnızca Google ile kayıtlı bir e-posta ile 2. adımı tekrarla → aynı genel mesaj,
   ama bu sefer "Google ile giriş yapın" bilgilendirme e-postası düşmeli.
9. Aynı e-posta ile art arda 4 kez istek gönder → 4. istek `429` dönmeli (FR-007,
   saatte 3 istek eşiği).
