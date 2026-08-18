# Faz 1 Veri Modeli: Şifre Sıfırlama

## Yeni Prisma modeli: YOK

Bu özellik, Better Auth'un `001-auth-rol` migration'ıyla zaten oluşturulmuş olan
`verification` tablosunu (Prisma modeli: `Verification`) yeniden kullanır. Yeni bir
migration gerekmez.

## Kullanılan mevcut varlık: `Verification` (bkz. `specs/001-auth-rol/data-model.md`)

Şifre sıfırlama akışında bu tablo şu şekilde kullanılır (Better Auth'un kendi iç
mantığı, uygulama kodu tarafından doğrudan yazılmaz — yalnızca temizlik/FR-011 için
Prisma ile okunur/silinir):

| Alan | Sıfırlama akışındaki anlamı |
|---|---|
| `identifier` | `reset-password:<token>` formatında, token'ı taşır |
| `value` | İlişkili kullanıcının `User.id`'si |
| `expiresAt` | İstek anından `resetPasswordTokenExpiresIn` (1 saat) sonrası |
| (kayıt silinmesi) | `consumeVerificationValue` ile token kullanılınca otomatik silinir (tek kullanım) |

## Kullanılan mevcut varlık: `User` / `Account`

Değişiklik yok. Yalnızca okunur: `Account.providerId === 'credential'` var mı (gerçek
sıfırlama e-postası) yoksa yalnızca `'google'` mu (bilgilendirme e-postası) diye
`sendResetPassword` callback'i içinde kontrol edilir — `sign-up.hook.ts`'teki
`hasCredential`/`hasGoogle` desenine birebir aynı sorgu deseni.

## Yaşam Döngüsü Özeti

```
İstek (POST /forget-password, email)
  → Better Auth: kullanıcı var mı? (yoksa: sahte gecikme + FR-002 genel yanıt, DUR)
  → Better Auth: yeni Verification kaydı oluşturur (token, expiresAt=+1h)
  → Uygulama (sendResetPassword callback):
      - eski "reset-password:%" kayıtlarını (bu token hariç) sil (FR-011)
      - credential hesap var mı?
          evet → gerçek sıfırlama linkini içeren e-posta gönder
          hayır (yalnızca google) → "Google ile giriş yapın" e-postası gönder
  → Better Auth: FR-002 genel 200 yanıtını döner (her durumda aynı)

Sıfırlama (POST /reset-password, token, newPassword)
  → Uygulama (hooks.before): newPassword harf+rakam politikasına uyuyor mu? (FR-006)
  → Better Auth: token geçerli mi (var/süresi dolmamış)? (FR-004/FR-009)
  → Better Auth: token'ı tüket (sil), şifreyi güncelle
  → Better Auth: revokeSessionsOnPasswordReset=true → tüm oturumları sil (FR-008)
  → Better Auth: 200 döner
```
