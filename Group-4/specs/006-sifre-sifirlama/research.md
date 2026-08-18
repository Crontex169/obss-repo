# Faz 0 Araştırma: Şifre Sıfırlama

## Karar 1: Token üretimi/süre/tek-kullanım — kütüphane mi, özel kod mu?

**Karar**: Better Auth'un native `/forget-password` ve `/reset-password` uçları
kullanılacak; özel bir token modeli/servis YAZILMAYACAK.

**Gerekçe**: Kaynak kod incelemesi (`node_modules/better-auth/dist/api/routes/password.mjs`)
şunu doğruladı:
- İstek ucu (`requestPasswordReset`), e-posta kayıtlı olmasa da AYNI genel 200 yanıtını
  döner ve "timing attack" saldırılarına karşı sahte bir token üretimi + DB sorgusu
  simüle eder (`generateId(24)` + `findVerificationValue("dummy-verification-token")`).
  FR-002 bunu zaten karşılıyor.
- Token, mevcut `Verification` tablosuna `identifier: reset-password:<token>` olarak
  yazılır, `expiresAt` alanı `resetPasswordTokenExpiresIn` (varsayılan 3600 sn) ile
  hesaplanır. FR-004/FR-010 karşılanıyor.
- Sıfırlama ucu (`resetPassword`), `consumeVerificationValue` ile token'ı OKUYUP SİLER
  (tek kullanımlık) ve `newPassword.length` için min/max kontrolü yapar. FR-005/FR-009
  karşılanıyor.
- `revokeSessionsOnPasswordReset: true` bayrağı açıksa, şifre güncellemesinden hemen
  sonra `deleteUserSessions(userId)` çağrılır. FR-008 tam olarak bu bayrakla karşılanıyor.

**Reddedilen alternatif**: Özel bir `PasswordResetToken` Prisma modeli + servis yazmak.
Reddedilme nedeni: Better Auth zaten aynı garantileri (tek kullanım, süre, timing-attack
koruması) üretim kalitesinde sağlıyor; tekrar yazmak hem gereksiz kod hem de mevcut
`Verification` tablosuyla iki paralel doğrulama mekanizması riski doğurur.

## Karar 2: Şifre politikası (harf+rakam) sıfırlama ucunda nasıl uygulanır?

**Karar**: `hooks.before('/reset-password')` içinde, sign-up akışındaki `passwordPolicy`
zod şeması (ortak bir dosyaya taşınarak) yeniden kullanılır.

**Gerekçe**: Better Auth'un native kontrolü yalnızca `minPasswordLength`/`maxPasswordLength`
(karakter SAYISI) kontrol ediyor, harf+rakam kombinasyonu kontrol etmiyor
(`password.mjs:154-155`). FR-006 bu yüzden bir `hooks.before` ile eklenmeli — mevcut
`sign-up.hook.ts`'teki desenle birebir aynı (kod tekrarını önlemek için şema paylaşılan
bir dosyaya taşınır).

## Karar 3: Google-only hesap ve e-posta gönderimi hangi katmanda ayrıştırılır?

**Karar**: `sendResetPassword` callback'i içinde, Prisma ile kullanıcının `accounts`
ilişkisi sorgulanır (mevcut `enforceSignUpPolicy`'deki `hasCredential`/`hasGoogle`
desenine benzer); credential hesabı yoksa (yalnızca Google) gerçek sıfırlama linki
YERİNE "bu hesap Google ile kayıtlı" bilgilendirme e-postası gönderilir, credential
hesabı da yoksa ve kullanıcı bulunamıyorsa Better Auth zaten callback'i hiç çağırmaz
(kendi `findUserByEmail` kontrolü FR-002'yi karşılıyor).

**Reddedilen alternatif**: Google-only durumunu ayrı bir `hooks.before` içinde
engellemek (sign-up hook'undaki `ACCOUNT_USE_GOOGLE` reddi gibi). Reddedilme nedeni:
İstek ucunun (`request-password-reset`) HER ZAMAN aynı 200 yanıtını dönmesi gerekiyor
(FR-002); bir hook içinde erken `APIError` fırlatmak bu tutarlılığı bozar ve enumeration
sızıntısına yol açar. Doğru yer, zaten yalnızca gerçek kullanıcı için tetiklenen
`sendResetPassword` callback'idir.

## Karar 4: Eski bekleyen token'ların geçersiz kılınması (FR-011)

**Karar**: `sendResetPassword` callback'i içinde, yeni token oluşturulduktan hemen
sonra (callback zaten bu noktada çalışıyor), aynı kullanıcı için `identifier LIKE
'reset-password:%'` olan VE yeni oluşturulan token'dan farklı olan `Verification`
kayıtları Prisma ile silinir.

**Gerekçe**: Better Auth `createVerificationValue` çağrısı var olan kayıtları
otomatik temizlemiyor; bu nedenle art arda birden fazla istek gönderilirse birden
fazla geçerli token bir arada var olabilir. FR-011 bunu istemiyor (yalnızca en güncel
token geçerli olmalı). Callback'e token parametresi zaten geçiliyor
(`sendResetPassword({ user, url, token }, request)`), bu yüzden "kendisi hariç" filtre
kolayca uygulanabilir.

## Karar 5: İstek sıklığı sınırlaması (FR-007)

**Karar**: Mevcut `rate-limit.config.ts` deseniyle tutarlı, ayrı bir in-memory
sayaç (`Map<email, {count, windowStart}>`), e-posta başına saatte 3 istek eşiği ile
`hooks.before('/request-password-reset')` içinde uygulanır; aşım durumunda
`APIError('TOO_MANY_REQUESTS')` fırlatılır.

**Reddedilen alternatif**: Mevcut giriş-denemesi rate-limiter'ı (FR-017, 10 deneme
eşiği) doğrudan yeniden kullanmak. Reddedilme nedeni: Farklı işlem (istek başlatma vs.
başarısız giriş denemesi), farklı eşik/pencere (saatte 3 vs. 10 deneme); aynı sayaç
kullanmak iki farklı güvenlik politikasını birbirine karıştırır ve testleri
belirsizleştirir. `docs/API_CONVENTIONS.md`'ye bu ikinci eşik dokümante edilecek.

## Karar 6: Yeni bir ADR gerekiyor mu?

**Karar**: Hayır. Yeni bir teknoloji/bağımlılık/mimari desen eklenmiyor (Better Auth
zaten `001-auth-rol`'da kilitli bağımlılık, ADR gerektiren bir "seçim" yok).
