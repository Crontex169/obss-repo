# Uygulama Planı: Şifre Sıfırlama

**Dal (Branch)**: `006-sifre-sifirlama` | **Tarih**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/006-sifre-sifirlama/spec.md` özellik spesifikasyonu

**Not**: Bu dilim, **001-auth-rol** dilimindeki Better Auth (e-posta/parola) altyapısına
**bağımlıdır** ve onu yeniden üretmez; `specs/001-auth-rol/tasks.md` T077 bulgusunu
süpersede eder.

## Özet

Kayıtlı bir parola-hesaplı kullanıcı e-postasını girerek şifre sıfırlama isteği
başlatır, tek-kullanımlık ve süreli bir bağlantı alır, bu bağlantıyla yeni şifresini
belirler. Var olmayan e-postalar ve yalnızca-Google hesapları için sistem her zaman
aynı genel yanıtı döner (enumeration koruması).

**Teknik yaklaşım**: Better Auth kütüphanesi `/forget-password` ve `/reset-password`
uçlarını, token üretimini (`Verification` tablosu üzerinden), süre kontrolünü
(`resetPasswordTokenExpiresIn`) ve tek-kullanımlık tüketimi (`consumeVerificationValue`)
**zaten kütüphane içinde sağlıyor** — bu yeniden inşa edilmeyecek. Yapılacak iş sadece:

1. `emailAndPassword.sendResetPassword` callback'ini doldurmak (şu an boş fonksiyon,
   T077/bulgu A4) — `verification-mailer.ts` altyapısı (Resend, ADR-0008) yeniden
   kullanılır; Google-only hesap icin farklı icerikli ("Google ile giriş yapın") bir
   e-posta gönderilir, credential hesabı yoksa e-posta HİÇ gönderilmez (FR-003) ama
   Better Auth'un ürettiği genel 200 yanıtı her koşulda aynı kalır (FR-002, zaten
   kütüphanenin kendi timing-attack korumalı davranışı).
2. `emailAndPassword.revokeSessionsOnPasswordReset: true` bayrağını açmak (FR-008) —
   kütüphane bunu native destekliyor, sıfırlama sonrası tüm oturumları siler.
3. `emailAndPassword.resetPasswordTokenExpiresIn: 3600` (1 saat, FR-010) — kütüphanenin
   varsayılanıyla zaten aynı, açıkça sabitlenir (spec netliği için).
4. Yeni şifre için harf+rakam politikasını (FR-006) Better Auth'un native
   `minPasswordLength` kontrolü tek başına karşılamıyor (yalnızca uzunluk kontrol
   ediyor) — `hooks.before('/reset-password')` içinde mevcut `passwordPolicy`
   (sign-up.hook.ts'teki zod şeması, ortak bir dosyaya taşınarak) yeniden kullanılır.
5. İstek sıklığı sınırlaması (FR-007, e-posta başına saatte 3) — mevcut
   `rate-limit.config.ts` deseniyle tutarlı, AYRI bir in-memory sayaç (farklı eşik/
   pencere) `hooks.before('/request-password-reset')` içinde eklenir.
6. Aynı kullanıcı için önceki bekleyen token'ların geçersiz kılınması (FR-011) —
   Better Auth bunu otomatik yapmıyor; `sendResetPassword` callback'i tetiklenmeden
   önce, aynı kullanıcıya ait `identifier LIKE 'reset-password:%'` olan eski
   `Verification` kayıtları Prisma ile silinir (yeni token zaten callback'ten önce
   oluşturulmuş olacağından, callback içinde "kendisi hariç" temizlik yapılır).
7. Frontend: `forgot-password.tsx` (e-posta formu) ve `reset-password.tsx` (token'i
   URL'den okuyup yeni şifre formu) sayfaları — `authClient.forgetPassword` /
   `authClient.resetPassword` (better-auth/react client metodları) kullanılır, mevcut
   `login.tsx`/`register-form.tsx` tasarım dilinde.

Yeni bir Prisma modeli/migration GEREKMEZ (Better Auth'un var olan `Verification`
tablosu yeniden kullanılır) — bu, `001-auth-rol`'daki data-model'i genişletmez.

## Constitution Check

- **Spec-first**: Bu plan `specs/006-sifre-sifirlama/spec.md`'den türetildi. ✅
- **Test-first/ATDD**: `tasks.md`'de her US için testler koddan önce yazılacak. ✅
- **Vertical slice**: Backend (config+hook) + frontend (2 sayfa) uçtan uca. ✅
- **Security (İlke V)**: Enumeration koruması FR-002/003 ile korunur; server-side
  rate-limit; token client'a asla API yanıtında sızmaz (yalnızca e-posta içinde). ✅
- **LLM contract**: Bu dilim LLM kullanmaz, N/A.
- **ADR**: Yeni bir teknoloji/bağımlılık eklenmiyor (Better Auth zaten mevcut
  bağımlılık) — yeni ADR gerekmez, `docs/DECISIONS.md`'ye ek madde gerekmiyor.

Gate: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/006-sifre-sifirlama/
├── plan.md              # Bu dosya
├── research.md           # Faz 0 çıktısı
├── data-model.md          # Faz 1 çıktısı (yeni model yok, mevcut Verification'a referans)
├── quickstart.md          # Faz 1 çıktısı
└── tasks.md               # Faz 2 çıktısı (speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── src/auth/
│   ├── better-auth.config.ts        # emailAndPassword bayrakları + sendResetPassword + hooks genişletilir
│   ├── hooks/
│   │   ├── sign-up.hook.ts           # passwordPolicy paylaşılan bir dosyaya taşınır
│   │   ├── password-policy.ts        # YENİ: passwordPolicy (paylaşılan zod şeması)
│   │   └── reset-password.hook.ts    # YENİ: reset-password sifre politikasi + eski token temizligi
│   └── rate-limit.config.ts          # YENİ: sıfırlama-istegi icin ayrı sayaç fonksiyonu (mevcut desene ek)
└── test/integration/
    ├── us-reset-request-happy.spec.ts
    ├── us-reset-request-enumeration.spec.ts
    ├── us-reset-request-google-only.spec.ts
    ├── us-reset-request-rate-limit.spec.ts
    ├── us-reset-password-happy.spec.ts
    ├── us-reset-password-policy.spec.ts
    ├── us-reset-password-expired-used.spec.ts
    └── us-reset-password-session-revoke.spec.ts

frontend/
├── src/pages/
│   ├── forgot-password.tsx           # YENİ
│   └── reset-password.tsx            # YENİ
└── test/
    └── forgot-password-form.test.tsx  # YENİ
```

**Structure Decision**: Mevcut `backend/src/auth/` ve `frontend/src/pages/` yapısına
ek dosyalar; yeni bir modül/dizin gerekmiyor (auth slice'ının doğal uzantısı).

## Complexity Tracking

Yok — constitution ihlali/istisna gerektiren bir karar alınmadı.
