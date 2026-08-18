# Phase 1 Veri Modeli: Kimlik Doğrulama & Rol (Auth)

**Dilim**: `001-auth-rol` | **Tarih**: 2026-07-29 | **ORM**: Prisma / PostgreSQL 16

Bu belge, Better Auth'un gerektirdiği çekirdek tabloları (`user`, `session`, `account`,
`verification`) ve bu dilime eklenen `role` alanını tanımlar. Alanlar Better Auth şema
sözleşmesine göre adlandırılır; son sütun kümesi `@better-auth/cli generate` çıktısıyla
doğrulanmalıdır (research.md §2).

---

## Varlık Genel Bakış

| Varlık | Amaç | Spec karşılığı |
|--------|------|----------------|
| **User** | Kayıtlı kişi; kimlik + rol | Anahtar Varlık "Kullanıcı", FR-001/007 |
| **Session** | Kimlik doğrulanmış etkin erişim dönemi | Anahtar Varlık "Oturum", FR-012/013 |
| **Account** | Kimlik yöntemi (parola veya Google) — kullanıcıya bağlı | "Kimlik Sağlayıcı Bağlantısı", FR-005 |
| **Verification** | E-posta doğrulama / token'lar | FR-019 |

---

## User

Sisteme kayıtlı kişiyi temsil eder. `id`, `email`, `role` sonraki dilimlerin veri temelidir.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String (cuid/uuid) | PK |
| `email` | String | **Benzersiz** (FR-003), zorunlu |
| `emailVerified` | Boolean | Varsayılan `false`; Google girişte `true` (FR-019) |
| `name` | String? | Opsiyonel görünen ad |
| `image` | String? | Opsiyonel (Google profil resmi) |
| `role` | String | `@default("user")`; değerler: `"user"` \| `"admin"` (FR-007) |
| `banned` | Boolean? | Admin plugin — throttling/koruma ile ilişkili opsiyonel. ⚠️ **Kodda sıfır referans** — kullanılması ya da düşürülmesi T081/T081b'ye bağlı |
| `banReason` | String? | Opsiyonel (aynı uyarı) |
| `banExpires` | DateTime? | Opsiyonel (aynı uyarı) |
| `kvkkConsentAt` | DateTime? | KVKK açık onayının verildiği an (FR-020). `null` → onay verilmemiş, ilk girişte popup gösterilir; dolu → bir daha gösterilmez |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Doğrulama kuralları**:
- `email` biçimsel olarak geçerli olmalı (FR-002).
- Parola (Account.password) politikası: **min 8 karakter, en az bir harf + bir rakam** (FR-002).
  Parola `User`'da değil, `Account.password`'da hash'li tutulur (FR-016 — geri döndürülemez).
- `role` yalnızca seed/migration ile `"admin"` olabilir; uygulama içi yükseltme yok (FR-018).

**İlişkiler**: `User 1—* Session`, `User 1—* Account`.

---

## Session

Bir kullanıcının kimlik doğrulanmış etkin erişim dönemi.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `userId` | String | FK → `User.id` (cascade delete) |
| `token` | String | **Benzersiz** oturum token'ı |
| `expiresAt` | DateTime | "Beni hatırla" → +30 gün; aksi halde session-scoped çerez (FR-013) |
| `ipAddress` | String? | Opsiyonel (denetim) |
| `userAgent` | String? | Opsiyonel |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Durum geçişleri**:
- **Başlangıç**: Başarılı giriş → yeni Session (FR-012).
- **Geçerli**: `now() < expiresAt` ve çerez mevcut.
- **Sonlanma**: (a) çıkış (logout) → Session silinir; (b) `expiresAt` geçmiş → geçersiz;
  (c) "Beni hatırla" yoksa tarayıcı kapanınca session çerezi silinir → erişilemez (FR-013).
- Ayrı idle timeout **yoktur**.

**İlişki**: `Session *—1 User`.

---

## Account

Bir kullanıcının bir kimlik yöntemini (parola veya sosyal sağlayıcı) temsil eder. Hesap
bağlama mantığının veri temeli (research.md §3).

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `userId` | String | FK → `User.id` (cascade delete) |
| `providerId` | String | `"credential"` (parola) veya `"google"` |
| `accountId` | String | Sağlayıcıdaki hesap kimliği (Google sub / user id) |
| `password` | String? | Yalnızca `credential` için; **hash'li** (FR-016), politika FR-002 |
| `accessToken` | String? | Google için opsiyonel |
| `refreshToken` | String? | Google için opsiyonel |
| `idToken` | String? | Google için opsiyonel |
| `accessTokenExpiresAt` | DateTime? | Opsiyonel |
| `scope` | String? | Opsiyonel |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Kısıt**: `(providerId, accountId)` benzersiz olmalı. Bir `User`, en fazla bir `credential`
ve/veya bir `google` `Account`'a sahip olabilir.

**Hesap bağlama kuralları (FR-005, Hikâye 3)**:
- **Önce credential, sonra google (aynı e-posta)** → mevcut User'a yeni `google` Account
  eklenir (otomatik bağlama; trusted provider). *(kriter 4)*
- **Önce google, sonra credential kaydı (aynı e-posta)** → `credential` Account **oluşturulmaz**;
  "Google ile giriş yapın" hatası döner. Kontrol: e-postaya ait User'ın yalnızca `google`
  Account'u varsa ve `credential` yoksa parola kaydı reddedilir. *(kriter 3)*
- **Admin (role=admin) + google** → Google ile oturum reddedilir (FR-006). *(kriter 6)*

**İlişki**: `Account *—1 User`.

---

## Verification

E-posta doğrulama ve diğer token akışları (FR-019).

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `identifier` | String | Genelde e-posta veya doğrulama anahtarı |
| `value` | String | Token değeri |
| `expiresAt` | DateTime | Token son geçerlilik |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Akış**: E-posta/şifre kaydında doğrulama token'ı üretilir → doğrulama bağlantısı gönderilir
(gönderim yolu **[NETLEŞTİRİLECEK]** — ADR-0008) → kullanıcı bağlantıya tıklayınca
`User.emailVerified=true`. Doğrulanmadan giriş engellenir (FR-019). Google girişinde
`emailVerified` doğrudan `true` (token akışı yok).

---

## İlişki Diyagramı (mantıksal)

```text
                 ┌──────────────┐
                 │     User     │  role: user|admin
                 │  id, email,  │  emailVerified
                 │  role        │
                 └──────┬───────┘
        1—*            │            1—*
   ┌──────────────────┼───────────────────┐
   │                  │                    │
┌──▼───────┐   ┌──────▼──────┐      (Verification: identifier=email)
│ Session  │   │   Account   │
│ token,   │   │ providerId: │  credential (password hash) | google (tokens)
│ expiresAt│   │ accountId,  │
└──────────┘   │ password?   │
               └─────────────┘
```

---

## Seed Verisi (admin)

`prisma/seed.ts` (FR-018, research.md §8):
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` ortam değişkenlerinden okunur (koda gömülmez).
- Oluşturulan kayıt: `User { role: "admin", emailVerified: true }` + `Account { providerId: "credential", password: <hash> }`.
- İdempotent: aynı e-posta varsa yeniden oluşturmaz.

---

## Gereksinim İzlenebilirliği

| Alan/Kural | Gereksinim |
|------------|-----------|
| `User.email` benzersiz | FR-003 |
| Parola politikası + hash | FR-002, FR-016 |
| `User.role` (user/admin) | FR-007 |
| `emailVerified` zorunlu akış | FR-019 |
| `Session.expiresAt` (30 gün / session) | FR-013 |
| `Account` google/credential bağlama | FR-005, Hikâye 3 (5,6) |
| Admin seed | FR-018 |
