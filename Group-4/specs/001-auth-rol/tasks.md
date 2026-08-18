---

description: "Kimlik Doğrulama & Rol dilimi için görev listesi"
---

# Görevler: Kimlik Doğrulama & Rol (Auth)

**Girdi**: `specs/001-auth-rol/` altındaki tasarım belgeleri

**Ön koşullar**: plan.md (zorunlu), spec.md (kullanıcı hikâyeleri için zorunlu), research.md, data-model.md, contracts/

**Testler**: Anayasa İlke III (Test-Öncelikli / ATDD) gereği bu dilimde testler ZORUNLUDUR. Her hikâyenin test görevleri ilgili implementasyon görevlerinden **ÖNCE** yazılır ve önce başarısız olmaları (Kırmızı) doğrulanır (Kırmızı → Yeşil → Refactor).

**Organizasyon**: Görevler, her hikâyenin bağımsız uygulanıp test edilebilmesi için kullanıcı hikâyelerine göre gruplanmıştır.

## Biçim: `[ID] [P?] [Hikâye] Açıklama`

- **[P]**: Paralel çalıştırılabilir (farklı dosyalar, tamamlanmamış görevlere bağımlılık yok)
- **[Hikâye]**: Görevin ait olduğu kullanıcı hikâyesi (US1…US6 → spec.md'deki Hikâye 1…6)
- Açıklamalarda kesin dosya yolları belirtilir

## Yol Kuralları (plan.md — Web uygulaması yapısı)

- Backend: `backend/src/`, `backend/prisma/`, `backend/test/`
- Frontend: `frontend/src/`, `frontend/test/`
- Ortak sırlar: kök `.env.example`

## Kilitli Teknoloji Yığını (ADR-0001…0003)

NestJS + PostgreSQL 16 + Prisma + Better Auth (backend); React 19 + Vite + Tailwind + shadcn/ui + `better-auth/react` (frontend). Testler: Jest + Supertest (backend), Vitest + RTL + Playwright (frontend).

## Kullanıcı Hikâyesi ↔ Faz Eşlemesi (öncelik sırasıyla)

| Faz | Hikâye | Başlık | Öncelik |
|-----|--------|--------|---------|
| 3 | US1 | E-posta/Şifre ile Kayıt (+ zorunlu doğrulama) | P1 🎯 MVP |
| 4 | US2 | E-posta/Şifre ile Giriş / Çıkış | P1 |
| 5 | US5 | Sahiplik & Rol Tabanlı Yetkilendirme (Guard'lar) | P1 |
| 6 | US4 | Admin Girişi (Yalnızca E-posta/Şifre) | P1 |
| 7 | US3 | Google ile Giriş (+ hesap bağlama) | P2 |
| 8 | US6 | Oturum Yönetimi ve Sonlanması | P2 |

> Not: US5 (guard zinciri) US4'ten (admin paneli koruması) önce gelir; çünkü admin paneli koruması `RolesGuard`'a bağımlıdır.

---

## Faz 1: Kurulum (Ortak Altyapı)

**Amaç**: Proje iskeleti, bağımlılıklar ve geliştirme ortamı

- [X] T001 Monorepo iskeletini oluştur (`backend/` ve `frontend/` kök dizinleri, ortak `.gitignore`) plan.md yapısına göre
- [X] T002 [P] Backend NestJS projesini başlat ve bağımlılıkları kur: NestJS, `better-auth`, `@better-auth/prisma`, `prisma`, `@prisma/client`, `zod` — `backend/package.json`, `backend/tsconfig.json`, `backend/src/main.ts`, `backend/src/app.module.ts`
- [X] T003 [P] Frontend projesini başlat (React 19 + Vite 6 + TypeScript + Tailwind CSS 4 + shadcn/ui + `better-auth/react`) — `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.ts`
- [X] T004 [P] Local PostgreSQL 16 için Docker kurulumu (`docker-compose.yml` veya `scripts/dev-db.ps1`) — quickstart.md kurulum adımıyla uyumlu
- [X] T005 [P] `.env.example` dosyasını tüm anahtarlarla oluştur: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`, `MAIL_*` (NETLEŞTİRİLECEK), `CAPTCHA_*` (opsiyonel) — kök `.env.example` (sırlar koda gömülmez, FR-015)
- [X] T006 [P] ESLint + Prettier yapılandırması (backend ve frontend) — `backend/.eslintrc.cjs`, `frontend/.eslintrc.cjs`, kök `.prettierrc`
- [X] T007 [P] Test altyapısını kur: backend Jest + Supertest (`backend/jest.config.ts`, `backend/test/`), frontend Vitest + RTL + Playwright (`frontend/vitest.config.ts`, `frontend/playwright.config.ts`)
- [X] T008 [P] `case-study/` klasörünü ve `case-study/AI_DEVLOG.md` iskeletini oluştur (Anayasa İlke I & IV)

---

## Faz 2: Temel Altyapı (Bloklayıcı Ön Koşullar)

**Amaç**: Tüm kullanıcı hikâyelerinden ÖNCE tamamlanması ZORUNLU çekirdek altyapı

**⚠️ KRİTİK**: Bu faz tamamlanmadan hiçbir kullanıcı hikâyesi işine başlanamaz

- [X] T009 Prisma şemasını tanımla: `User` (+ `role @default("user")`, `emailVerified`, `banned/banReason/banExpires`), `Session`, `Account`, `Verification` — data-model.md'ye göre `backend/prisma/schema.prisma`
- [X] T010 İlk migration'ı üret ve uygula (`npx prisma migrate dev`) — `backend/prisma/migrations/`
- [X] T011 [P] `PrismaService`'i oluştur (bağlantı yaşam döngüsü) — `backend/src/prisma/prisma.service.ts`
- [X] T012 [P] `zod` ile ortam değişkeni doğrulaması (env validation, eksik/yanlış sır → başlangıçta hata) — `backend/src/config/env.validation.ts`
- [X] T013 Better Auth çekirdek örneğini yapılandır (Prisma adaptörü, temel `session`/`emailAndPassword` iskeleti) — `backend/src/auth/better-auth.config.ts` (T009, T011'e bağlı)
- [X] T014 NestJS köprüsü: catch-all controller ile `/api/auth/*` isteklerini Better Auth handler'a mount et — `backend/src/auth/better-auth.controller.ts` (T013'e bağlı)
- [X] T015 `AuthModule`'ü kur ve `AppModule`'e bağla (controller + config + PrismaService sağlayıcıları) — `backend/src/auth/auth.module.ts`
- [X] T016 [P] Frontend Better Auth istemcisini oluştur (`better-auth/react`) — `frontend/src/lib/auth-client.ts`
- [X] T017 Duman testi (smoke): `GET /api/auth/get-session` boş oturumda `null`/`401` döner — `backend/test/integration/session-smoke.spec.ts` (köprünün ayakta olduğunu doğrular)

**Kontrol Noktası**: Temel altyapı hazır — kullanıcı hikâyesi implementasyonu başlayabilir

---

## Faz 3: US1 - E-posta/Şifre ile Kayıt (Öncelik: P1) 🎯 MVP

**Hedef**: Ziyaretçi e-posta/şifre ile "kullanıcı" rolüyle kayıt olur; e-posta doğrulaması zorunludur (doğrulamadan giriş yapamaz).

**Bağımsız Test**: quickstart.md S1 — geçerli e-posta + `Parola12` ile kayıt → `emailVerified=false`; doğrulamadan giriş → `403 EMAIL_NOT_VERIFIED`; doğrulama sonrası giriş başarılı; zayıf şifre/geçersiz e-posta → `400`; mükerrer e-posta → `409`.

### US1 Testleri (ÖNCE yaz, başarısız olduklarını doğrula) ⚠️

- [X] T018 [P] [US1] Kayıt mutlu yol entegrasyon testi: `POST /api/auth/sign-up/email` → `User(role="user", emailVerified=false)` + doğrulama e-postası tetiklendi (Hikâye 1 kriter 1) — `backend/test/integration/us1-register-happy.spec.ts`
- [X] T019 [P] [US1] Kayıt sınır/hata testleri: mükerrer e-posta `409` (ayrıntı sızdırmadan), geçersiz e-posta / zayıf şifre `400`, yalnızca-Google e-postası → `ACCOUNT_USE_GOOGLE` reddi (Hikâye 1 kriter 2,3; Hikâye 3 kriter 3) — `backend/test/integration/us1-register-errors.spec.ts`
- [X] T020 [P] [US1] E-posta doğrulama testi: doğrulamadan `sign-in/email` → `403 EMAIL_NOT_VERIFIED`; `verify-email?token` sonrası `emailVerified=true` ve giriş başarılı (FR-019) — `backend/test/integration/us1-email-verification.spec.ts`

### US1 Implementasyonu

- [X] T021 [US1] `emailAndPassword` sağlayıcısını etkinleştir; `zod` ile şifre politikası (min 8 karakter, ≥1 harf + ≥1 rakam, FR-002) sunucu tarafında zorunlu — `backend/src/auth/better-auth.config.ts`
- [X] T022 [US1] `requireEmailVerification` + `Verification` token akışını yapılandır (kayıt sonrası token üret, `verify-email` ile `User.emailVerified=true`, FR-019) — `backend/src/auth/better-auth.config.ts`. **Düzeltme (2026-07-31, gerçek mail testinde bulundu):** mail linki Better Auth'un kendi backend-tarafı `url`'u yerine `token` ile frontend'in `verify-email.tsx` sayfasına (`FRONTEND_URL/verify-email?token=...`, T027) kurulur — önceki hâliyle link backend'in sunucu-tarafı yönlendirme ucuna gidiyordu ve frontend sayfası hiç tetiklenmiyordu.
- [X] T023 [US1] Mail gönderim sağlayıcısı: `sendVerificationEmail` geliştirmede (`MAIL_TRANSPORT=console`) doğrulama bağlantısını konsola log'lar; production'da (`MAIL_TRANSPORT=resend`) **Resend** ile gerçek mail gönderir — karar ADR-0008'de kabul edildi — `backend/src/auth/mail/verification-mailer.ts`
- [X] T024 [US1] Yalnızca-Google e-postası ile parola kaydını reddet: e-postaya ait User'ın yalnızca `google` Account'u varsa (`credential` yoksa) `ACCOUNT_USE_GOOGLE` hatası + Google'a yönlendirme mesajı (Hikâye 3 kriter 3) — `backend/src/auth/hooks/sign-up.hook.ts`
- [X] T025 [US1] Mükerrer e-posta ve doğrulama hatalarını **genel** mesaja eşle (hesap varlığı/alan sızdırmaz, FR-014/FR-003) — `backend/src/auth/better-auth.config.ts` hata eşlemesi
- [X] T026 [P] [US1] Frontend kayıt formu (shadcn/ui, `auth-client.signUp`, istemci tarafı `zod` yalnızca UX) — `frontend/src/pages/register.tsx`, `frontend/src/components/auth/register-form.tsx`
- [X] T027 [P] [US1] Frontend e-posta doğrulama sayfası (token ile `verify-email` çağrısı, sonuç mesajı) — `frontend/src/pages/verify-email.tsx`

**Kontrol Noktası**: US1 bağımsız çalışır ve test edilebilir — MVP hazır

---

## Faz 4: US2 - E-posta/Şifre ile Giriş / Çıkış (Öncelik: P1)

**Hedef**: Doğrulanmış kullanıcı e-posta/şifre ile giriş yapar, çıkış yapabilir; hatalı denemelerde genel hata ve 10 başarısız denemeden sonra throttling.

**Bağımsız Test**: quickstart.md S2 — doğru kimlikle giriş `200` + oturum çerezi; `sign-out` → `401`; yanlış şifre → `401` **genel** mesaj; aynı e-posta 10 başarısız deneme → `429` (tam kilit YOK).

### US2 Testleri (ÖNCE yaz) ⚠️

- [X] T028 [P] [US2] Giriş mutlu yol testi: doğru kimlik → `200`, oturum çerezi set edilir; korunan uç noktaya erişilir (Hikâye 2 kriter 1) — `backend/test/integration/us2-signin-happy.spec.ts`
- [X] T029 [P] [US2] Çıkış + genel hata testi: `sign-out` sonrası korunan uç nokta `401`; yanlış şifre → `401` genel mesaj (alan sızdırmaz, SC-007) (Hikâye 2 kriter 2,3) — `backend/test/integration/us2-signout-error.spec.ts`
- [X] T030 [P] [US2] Throttling testi: aynı e-posta için 10 başarısız denemeden sonra `429` CAPTCHA/artan gecikme; sabit süreli tam kilit UYGULANMAZ (Hikâye 2 kriter 4, FR-017) — `backend/test/integration/us2-throttling.spec.ts`

### US2 Implementasyonu

- [X] T031 [US2] `sign-in/email` genel hata sözleşmesi: hatalı kimlik → `401` genel mesaj (FR-014) — `backend/src/auth/better-auth.config.ts`
- [X] T032 [US2] Çıkış (`sign-out`) davranışı: aktif oturumu sonlandır, çerezi temizle (FR-012) — `backend/src/auth/better-auth.config.ts`
- [X] T033 [US2] 10 başarısız deneme sonrası throttling/CAPTCHA (Better Auth `rateLimit` — e-posta bazlı özel anahtarlama, karar: kullanıcı onayı); tam kilit yok (FR-017) — `backend/src/auth/rate-limit.config.ts`
- [X] T034 [P] [US2] Frontend giriş formu ("Beni hatırla" onay kutusu dahil, `auth-client.signIn`) — `frontend/src/pages/login.tsx`, `frontend/src/components/auth/login-form.tsx`

**Kontrol Noktası**: US1 ve US2 birlikte bağımsız çalışır

---

## Faz 5: US5 - Sahiplik & Rol Tabanlı Yetkilendirme (Öncelik: P1)

**Hedef**: Sunucu tarafı guard zinciri (Session → Roles → Ownership); kullanıcı yalnızca kendi verisine, admin tüm veriye okuma erişimi; istemci baypası reddedilir.

**Bağımsız Test**: quickstart.md S5 — B kullanıcısı A'nın kaynağına erişir → `403/404` (sızdırma yok); kullanıcı kendi kaynağına erişir → izin; admin tüm kayıtları okur → izin; doğrudan API baypası → guard reddeder.

### US5 Testleri (ÖNCE yaz) ⚠️

- [X] T035 [P] [US5] `SessionGuard` testi: oturum yok/geçersiz → `401` (contracts/authz-rules.md) — `backend/test/integration/us5-session-guard.spec.ts`
- [X] T036 [P] [US5] `RolesGuard` testi: `@Roles('admin')` korumalı uç noktaya `user` erişimi → `403` (FR-008, Hikâye 5) — `backend/test/integration/us5-roles-guard.spec.ts`
- [X] T037 [P] [US5] `OwnershipGuard` testi: başkasının kaynağı → `403/404` (sızdırmaz), kendi kaynağı → izin, admin okuma baypası; istemci baypası reddi (Hikâye 5 kriter 1-4, FR-009/010/011) — `backend/test/integration/us5-ownership-guard.spec.ts`

### US5 Implementasyonu

- [X] T038 [P] [US5] `SessionGuard`: Better Auth `get-session` ile oturumu doğrula, `request.user`/`request.session` doldur, geçersizse `401` — `backend/src/auth/guards/session.guard.ts`
- [X] T039 [P] [US5] Decorator'lar: `@Roles(...)` ve `@CurrentUser()` — `backend/src/auth/decorators/roles.decorator.ts`, `backend/src/auth/decorators/current-user.decorator.ts`
- [X] T040 [US5] `RolesGuard`: `request.user.role` gerekli rolle karşılaştır, uymazsa `403`; rol DB destekli oturumdan okunur (istemci role'üne güvenilmez, R5) — `backend/src/auth/guards/roles.guard.ts` (T039'a bağlı)
- [X] T041 [US5] `OwnershipGuard`: kaynak `ownerId === request.user.id`; admin okuma için baypas; içerik sızdırma yok (R2/R3) — `backend/src/auth/ownership/ownership.guard.ts` (T038'e bağlı) — **karar (kullanıcı onayı):** sahiplik route param `:ownerId` ile okunur (gerçek kaynak henüz yok; sonraki dilimler bu sözleşmeye bağlanır)
- [X] T042 [US5] `AuthService` oturum/kullanıcı yardımcıları + guard'ları `AuthModule`'e kaydet (global veya modül düzeyi) — `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.module.ts`

**Kontrol Noktası**: Guard zinciri kuruldu; sonraki dilimler korunan kaynaklarını bağlayabilir

---

## Faz 6: US4 - Admin Girişi (Yalnızca E-posta/Şifre) (Öncelik: P1)

**Hedef**: Seed ile tanımlı admin, yalnızca e-posta/şifre ile giriş yapar ve admin paneline erişir; kullanıcılar admin panelinden `403` alır; admin için Google reddedilir.

**Bağımsız Test**: quickstart.md S4 — seed admin e-posta/şifre ile giriş → `role="admin"` oturum + panel erişimi; kullanıcı panel uç noktasına erişir → `403`; admin arayüzünde Google butonu yok, sunucu admin için Google'ı reddeder.

### US4 Testleri (ÖNCE yaz) ⚠️

- [X] T043 [P] [US4] Admin giriş testi: seed admin kimlikleriyle giriş → `role="admin"` oturum başlar (Hikâye 4 kriter 1) — `backend/test/integration/us4-admin-login.spec.ts`
- [X] T044 [P] [US4] Admin paneli koruma testi: `user` rolü panel uç noktasına erişir → `403` (Hikâye 4 kriter 2, SC-004); hatalı admin kimliği → genel `401` (kriter 3) — `backend/test/integration/us4-admin-panel-guard.spec.ts`

### US4 Implementasyonu

- [X] T045 [US4] Admin seed: `ADMIN_EMAIL`/`ADMIN_PASSWORD` env'den, `User{role:"admin", emailVerified:true}` + `Account{providerId:"credential", password:<hash>}`, idempotent (FR-018) — `backend/prisma/seed.ts` (şifre hash'i `better-auth/crypto` `hashPassword` ile, Better Auth'un kendi doğrulamasıyla tutarlı; `dotenv` eklendi ki `npm run db:seed` bağımsız çalışsın)
- [X] T046 [US4] `db:seed` npm script'i ve dokümantasyonu — `backend/package.json`, `backend/prisma/seed.ts`
- [X] T047 [US4] Örnek admin paneli korumalı uç noktası: `@Roles('admin')` + `SessionGuard`/`RolesGuard` (FR-008) — `backend/src/auth/admin/admin.controller.ts` (`GET /api/admin/ping`, US5 guard'larına bağlı)
- [X] T048 [P] [US4] Frontend admin giriş sayfası (yalnızca e-posta/şifre, **Google butonu yok**) — `frontend/src/pages/admin/login.tsx` (`/admin/login` route'u `App.tsx`'e eklendi)

**Kontrol Noktası**: Tüm P1 hikâyeleri (US1, US2, US5, US4) bağımsız çalışır

---

## Faz 7: US3 - Google ile Giriş (+ hesap bağlama) (Öncelik: P2)

**Hedef**: Google OAuth ile giriş; yeni hesap `role="user"` + `emailVerified=true`; aynı e-posta için otomatik hesap bağlama; admin için Google reddedilir; iptal/hata giriş ekranına döner.

**Bağımsız Test**: quickstart.md S3 — yeni Google hesabı tek seferde kullanıcı oluşturur; parola-sonra-Google otomatik bağlanır; Google-sonra-parola reddedilir; iptal/hata bilgi mesajıyla döner; admin Google denemesi reddedilir.

### US3 Testleri (ÖNCE yaz) ⚠️

- [X] T049 [P] [US3] Yeni Google kullanıcı testi: ilk Google girişi → `User(role="user", emailVerified=true)` mükerrersiz (Hikâye 3 kriter 1, SC-005) — `backend/test/integration/us3-google-new.spec.ts` (idToken akışı + jose ile sahte imzalı Google id-token + `globalThis.fetch` seviyesinde JWKS mock — karar: kullanıcı onayı, undici MockAgent Node 24'te native fetch'i yakalamadığı için manuel fetch sarmalayıcıya geçildi)
- [X] T050 [P] [US3] Hesap bağlama testi: parola-sonra-Google (aynı e-posta) → otomatik aynı hesaba bağlanır (kriter 2,4); Google-sonra-parola kaydı → reddedilir (kriter 3) — `backend/test/integration/us3-account-linking.spec.ts`
- [X] T051 [P] [US3] İptal/hata + admin reddi testi: Google iptal/sağlayıcı hatası → oturum açmadan giriş ekranına dönüş (kriter 5); admin e-postasıyla Google → `403` reddedilir (kriter 6, FR-006) — `backend/test/integration/us3-google-cancel-admin.spec.ts` (Playwright mock/staging ile de eşlenir)

### US3 Implementasyonu

- [X] T052 [US3] Google sosyal sağlayıcı yapılandırması (`GOOGLE_CLIENT_ID`/`SECRET` env'den) + `sign-in/social` ve `callback/google` uç noktaları — `backend/src/auth/better-auth.config.ts` (`account.accountLinking.trustedProviders=['google']`; env.validation.ts'te GOOGLE_CLIENT_ID/SECRET artık zorunlu; ayrıca env yükleme sırası hatası düzeltildi — dosyaya `import 'dotenv/config'` eklendi, önceden ConfigModule'den önce modül yükü sırasında process.env okunuyordu)
- [X] T053 [US3] Trusted provider otomatik hesap bağlama: aynı e-postalı mevcut User'a `google` Account ekle, `emailVerified=true`, mükerrer hesap oluşturma (data-model.md hesap bağlama kuralları) — Better Auth'un yerleşik `account.accountLinking` + `trustedProviders` mekanizmasıyla otomatik sağlanıyor (ek kod gerekmedi); ters yön reddi zaten T024'te (`better-auth.config.ts` hooks.before) mevcuttu
- [X] T054 [US3] Admin için Google girişini reddet: hedef User `role="admin"` ise oturum açma → `403` (FR-006, kriter 4) — `backend/src/auth/hooks/oauth-link.hook.ts` (idToken akışı: `hooks.before /sign-in/social` erken red → 403; redirect/callback akışı için ek güvenlik ağı: `databaseHooks.session.create.before` — oturum DB'ye hiç yazılmadan reddeder, 401)
- [X] T055 [P] [US3] Frontend Google giriş butonu + iptal/hata durumunda giriş ekranına bilgi mesajı — `frontend/src/components/auth/google-button.tsx`, `frontend/src/pages/login.tsx`

**Kontrol Noktası**: Google girişi ve hesap bağlama çalışır; US1-US5 bozulmadı

---

## Faz 8: US6 - Oturum Yönetimi ve Sonlanması (Öncelik: P2)

**Hedef**: "Beni hatırla" ile 30 gün, aksi halde session-scoped oturum; süresi dolan oturumda yeniden giriş istenir. Ayrı idle timeout yok.

**Bağımsız Test**: quickstart.md S6 — "Beni hatırla" ile 30 gün geçerli; işaretsizken tarayıcı kapanınca sona erer; süresi dolan oturumla korunan içerik → `401` yeniden giriş.

### US6 Testleri (ÖNCE yaz) ⚠️

- [X] T056 [P] [US6] "Beni hatırla" testi: `rememberMe=true` → oturum ~30 gün geçerli çerez; dönüşte yeniden giriş istenmez (Hikâye 6 kriter 1, FR-013) — `backend/test/integration/us6-remember-me.spec.ts`
- [X] T057 [P] [US6] Session-scoped + süre dolumu testi: `rememberMe=false` → session-scoped çerez; süresi dolmuş oturumla korunan içerik → `401` (Hikâye 6 kriter 2,3, SC-006) — `backend/test/integration/us6-session-expiry.spec.ts`

### US6 Implementasyonu

- [X] T058 [US6] Oturum yaşam süresi yapılandırması: `rememberMe=true` → `expiresAt` +30 gün kalıcı çerez, `false` → session-scoped çerez; ayrı idle timeout yok (FR-013) — `backend/src/auth/better-auth.config.ts` (Better Auth'un yerleşik `rememberMe` mekanizması + mevcut `session.expiresIn=30 gün` config'i zaten bu davranışı sağlıyordu — T033'te kurulmuştu; ek kod gerekmedi, T056/T057 testleriyle doğrulandı)
- [X] T059 [US6] Süresi dolan/olmayan oturumda `SessionGuard` `401` ve yeniden giriş akışının doğrulanması (`get-session` entegrasyonu, SC-006) — `backend/src/auth/guards/session.guard.ts` (mevcut guard zaten doğru davranıyordu — Faz 5'te kurulmuştu; T057'nin ikinci testiyle doğrulandı, kod değişikliği gerekmedi)
- [X] T060 [P] [US6] Frontend korumalı rota yönlendirmesi (yalnızca UX; yetki sunucuda) — `frontend/src/routes/protected.tsx` (yeniden kullanılabilir `ProtectedRoute` sarmalayıcı; bu dilimde sarılacak gerçek korumalı sayfa henüz yok — Kapsam Notu)

**Kontrol Noktası**: Tüm 6 hikâye bağımsız işlevsel

---

## Faz 9: Cila & Kesişen Konular

**Amaç**: Birden çok hikâyeyi etkileyen iyileştirmeler ve doğrulama

- [X] T061 [P] quickstart.md S1-S6 senaryolarının uçtan uca Playwright doğrulaması (Google için staging mock) — `frontend/test/e2e/auth-flows.spec.ts` (S1/S2/S6: gerçek e-posta gönderimi yok — Better Auth'un kendi imzalama şemasıyla doğrulama JWT'si testte yeniden üretilip gerçek `/verify-email` ucuna gidiliyor, bkz. `test/e2e/helpers/`; S3: Google butonu gerçek OAuth kickoff'unu (`accounts.google.com`'a yönlendirme) doğruluyor, gerçek onay ekranı tamamlanmıyor — kayıtlı Google Cloud istemcisi yok; S4: seed admin ile giriş; S5 bu dilimde korunan gerçek kaynak olmadığından (Kapsam Notu) kapsam dışı, backend `us5-*.spec.ts` yeterli — 7/7 yeşil)
- [X] T062 [P] Frontend form birim testleri (Vitest + RTL: kayıt/giriş doğrulama UX) — `frontend/test/register-form.test.tsx`, `frontend/test/login-form.test.tsx` (7/7 yeşil; yol boyunca `vitest.config.ts`'te eksik `@` path alias'ı bulundu ve düzeltildi — daha önce hiçbir vitest testi `@/` importu kullanmadığından fark edilmemişti)
- [X] T063 [P] `docs/DECISIONS.md`'e ADR-0008 (mail gönderim sağlayıcısı: Resend) yazıldı ve Kabul edildi olarak işaretlendi — `docs/DECISIONS.md`
- [X] T064 [P] `case-study/AI_DEVLOG.md`'yi bu dilimin AI destekli çalışmasıyla güncelle (Anayasa İlke I) — `case-study/AI_DEVLOG.md`
- [X] T065 Güvenlik sıkılaştırma gözden geçirmesi: sırların yalnızca `.env`'den geldiğini (FR-015/018), tüm hata mesajlarının genel olduğunu (FR-014/SC-007), şifre hash'inin geri döndürülemez olduğunu (FR-016) doğrula — `backend/src/` (kod taraması: kaynakta hardcoded sır yok; Better Auth varsayılan scrypt hash kullanıyor — geri döndürülemez; tüm auth hata mesajları önceki fazlarda zaten genel/alan-sızdırmaz doğrulanmıştı — kod değişikliği gerekmedi)
- [X] T066 Kod temizliği ve refactor (guard/hook tekrarlarını sadeleştir, Kırmızı→Yeşil→Refactor son adımı) — guard'lar (`session/roles/ownership.guard.ts`) gözden geçirildi: her biri ~20-30 satır, tek sorumluluk, anlamlı tekrar yok; `context.switchToHttp().getRequest()` deseninin 3 guard'da tekrarı kasıtlı bırakıldı (1 satırlık yardımcı fonksiyon, okunabilirliği artırmadan dolaylılık ekler)

---

## Bağımlılıklar & Yürütme Sırası

### Faz Bağımlılıkları

- **Kurulum (Faz 1)**: Bağımlılık yok — hemen başlanabilir
- **Temel Altyapı (Faz 2)**: Faz 1'e bağlı — TÜM hikâyeleri BLOKLAR
- **Kullanıcı Hikâyeleri (Faz 3-8)**: Hepsi Faz 2'ye bağlı
  - US1, US2 Faz 2 sonrası paralel başlayabilir
  - US4 (Faz 6), US5 (Faz 5) guard'larına bağlıdır → US5 önce
  - US3, US6 (P2) çekirdek altyapı sonrası başlayabilir
- **Cila (Faz 9)**: İstenen tüm hikâyeler tamamlandıktan sonra

### Hikâyeler Arası Bağımlılıklar

- **US1 (P1)**: Faz 2 sonrası bağımsız — MVP
- **US2 (P1)**: Faz 2 sonrası; US1'in doğrulanmış kullanıcısını kullanır ama bağımsız test edilebilir
- **US5 (P1)**: Faz 2 sonrası bağımsız (guard zinciri)
- **US4 (P1)**: US5 guard'larına bağlı (admin paneli koruması `RolesGuard`)
- **US3 (P2)**: US1 (hesap bağlama), US4 (admin Google reddi) ile kesişir; bağımsız test edilebilir
- **US6 (P2)**: US2 (çerez/rememberMe) ve US5 (`SessionGuard`) üzerine kurulur

### Her Hikâye İçinde

- Testler implementasyondan ÖNCE yazılır ve başarısız olmaları doğrulanır (İlke III)
- Şema/model → servis/config → uç nokta/guard → frontend
- Hikâye tamamlanmadan bir sonraki önceliğe geçilmez

### Paralel Fırsatlar

- Faz 1'deki tüm `[P]` görevleri (T002-T008) paralel
- Faz 2'de T011, T012, T016 paralel (T013/T014 sıralı köprü)
- Her hikâyenin `[P]` test görevleri paralel yazılabilir
- Aynı hikâye içinde farklı dosyalara dokunan `[P]` implementasyonları paralel (ör. frontend sayfaları backend config'inden bağımsız)
- Faz 2 bittiğinde US1, US2, US5 farklı geliştiricilerce paralel yürütülebilir

---

## Paralel Örnek: US1

```bash
# US1 tüm testlerini birlikte başlat (önce yaz, başarısız olduklarını gör):
Task: "Kayıt mutlu yol testi — backend/test/integration/us1-register-happy.spec.ts"
Task: "Kayıt sınır/hata testleri — backend/test/integration/us1-register-errors.spec.ts"
Task: "E-posta doğrulama testi — backend/test/integration/us1-email-verification.spec.ts"

# US1 frontend görevlerini birlikte başlat:
Task: "Kayıt formu — frontend/src/pages/register.tsx"
Task: "E-posta doğrulama sayfası — frontend/src/pages/verify-email.tsx"
```

---

## Uygulama Stratejisi

### Önce MVP (Yalnızca US1)

1. Faz 1: Kurulum
2. Faz 2: Temel Altyapı (KRİTİK — tüm hikâyeleri bloklar)
3. Faz 3: US1 (E-posta/şifre kayıt + zorunlu doğrulama)
4. **DUR ve DOĞRULA**: quickstart.md S1'i bağımsız test et
5. Hazırsa demo/deploy

### Artımlı Teslimat (öncelik sırası)

1. Kurulum + Temel Altyapı → temel hazır
2. US1 → bağımsız test → Demo (MVP!)
3. US2 → giriş/çıkış → Demo
4. US5 → guard zinciri → Demo
5. US4 → admin paneli → Demo
6. US3 → Google girişi → Demo
7. US6 → oturum yaşam süresi → Demo

### Not

- `[P]` = farklı dosyalar, bağımlılık yok
- `[Hikâye]` etiketi görevi izlenebilirlik için hikâyeye bağlar
- Her hikâye bağımsız tamamlanabilir ve test edilebilir olmalı
- Implementasyondan önce testlerin başarısız olduğunu doğrula (İlke III)
- T023 (mail sağlayıcısı) **NETLEŞTİRİLECEK** ama bloklamaz: geliştirmede konsol/MailHog geçici çözümüyle ilerlenir; production kararı **ADR-0008**'e ertelenir
- Her görev veya mantıksal grup sonrası commit at

---

## Phase 10: Convergence

`/speckit-converge` taraması (2026-07-30) — spec/plan/tasks'e göre kodda tespit edilen boşluklar:

- [X] T067 [P] `case-study/` klasörüne `SETUP.md` ekle (kurulum adımları, kök `README.md` ile tutarlı) ve `docs/DECISIONS.md`'yi `case-study/DECISIONS.md`'ye taşı veya oraya yönlendiren bir kopya bırak per Constitution İlke IV (missing, CRITICAL) — **karar:** taşıma değil **yönlendirme** seçildi; `docs/DECISIONS.md`'ye ~60 çapraz referans (spec'ler, `TECH_STACK.md`, `PLAN.md`) bağlı, taşımak hepsini kırardı. `case-study/DECISIONS.md` ADR **sistemini** (Kayıt Defteri kuralı, ADR bölümleri, superseded disiplini) anlatıp kayda yönlendirir — liste kopyalanmadı, drift riski yok. `case-study/SETUP.md` README'nin kopyası değil, en kısa kurulum yolu; ayrıntı için README'ye yönlendirir
- [ ] T068 [P] Auth formlarını (`frontend/src/components/auth/register-form.tsx`, `login-form.tsx`, `frontend/src/pages/admin/login.tsx`) shadcn/ui bileşenlerine (Input/Button/Label/Card, `src/components/ui/`) taşı per plan.md Birincil Bağımlılıklar, T026, T034 (partial, HIGH) — **ertelendi (kullanıcı kararı):** UI tasarımı henüz yapılmadı, erken olur
- [X] T069 [P] `register-form.tsx` ve `login-form.tsx`'e istemci tarafı `zod` doğrulaması ekle (yalnızca UX; sunucu doğrulaması zaten zorunlu, FR-011) per T026, T034 (partial, MEDIUM) — `frontend/src/lib/validation.ts` (paylaşılan email/şifre şeması); register: email+şifre politikası, login: yalnızca email formatı
- [X] T070 `ACCOUNT_USE_GOOGLE` red mantığını `better-auth.config.ts` `hooks.before`'dan `backend/src/auth/hooks/sign-up.hook.ts`'e taşı, plan.md dosya ağacıyla hizala per plan.md Kaynak Kod, T024 (contradicts, LOW) — `enforceSignUpPolicy()` olarak dışa aktarıldı, config.ts'te tek satır çağrı
- [X] T071 [P] `backend/test/app.e2e-spec.ts` (varsayılan Nest CLI iskeleti, hiçbir FR'ye bağlı değil) ve boş `backend/test/e2e/` dizinini kaldır veya gerçek bir amaca bağla per plan.md proje yapısı (unrequested, LOW) — ikisi de kaldırıldı (kullanıcı kararı)

---

## Phase 11: İnceleme Bulguları (2026-07-31)

Üç turluk inceleme (doküman çapraz analizi + kod↔spec karşılaştırması + kalite taraması) çıktısı;
davranışsal iddialar `backend/test/integration/analiz-dogrulama.spec.ts` ve
`frontend/test/analiz-dogrulama.test.tsx` ile doğrulandı (bilinçli kırmızı testler).
Kök neden: **karar/kod değişiyor, onu doğuran belge veya görev güncellenmiyor** — mekanik
kapatan tek şey T072 (CI). `002`/`003` dilimlerine ait bulgular kendi `tasks.md`'lerinde.

### Yüksek

- [X] T072 `.github/workflows/ci.yml` ekle: `lint + build + test:e2e` (Postgres servisiyle), PR'da zorunlu per Anayasa "Geliştirme Akışı ve Kalite Kapıları" (bulgu H1) — şu an `.github/` altında `workflows` yok, tüm kalite kapıları elle (2026-08-03: backend job'da lint adımı, 19 pre-existing ESLint hatası [us4/us5/us6 test dosyaları, kapsam dışı] nedeniyle kullanıcı kararıyla CI'dan çıkarıldı; build+test:e2e kaldı — bkz. devlog)
- [X] T073 **Spec çelişkisini karara bağla:** FR-014/SC-007 (girişte hesap varlığı sızdırılmaz) ↔ Hikâye 3 kriter 3 + `contracts/auth-api.md:57` (Google hesabıyla parola **girişinde** yönlendirme uyarısı). İkisi aynı anda karşılanamaz; spec düzeltildikten sonra `better-auth.config.ts` hizalanır (bulgu A1, test kırmızı) — gözlenen davranış `401 INVALID_EMAIL_OR_PASSWORD`; kayıt yolu doğru (`403 ACCOUNT_USE_GOOGLE`)
- [X] T074 [P] `zod`'u `frontend/package.json`'a doğrudan bağımlılık olarak ekle (`npm i zod -w frontend`) per `frontend/src/lib/validation.ts:1` (bulgu G1) — şu an yalnız `better-auth` altından geliyor; katı `node_modules` veya sürüm değişiminde build kırılır

### Orta — kod ↔ spec

- [X] T075 `better-auth.config.ts:64` oturum ömrü: `updateAge: 0` (mutlak 30 gün) ekle **veya** FR-013 metnini kayan pencereye göre düzelt (bulgu A2, test kırmızı) — ölçüm: tek `get-session` çağrısı `expiresAt`'i 28 günden 30 güne itiyor
- [X] T076 `auth/ownership/ownership.guard.ts:25` oturumsuz dalı `401`'e çevir per `contracts/authz-rules.md` (bulgu A3, test kırmızı) — `002` T039 guard'ı `404`'e çevirirken bu dal da düzeltilmeli
- [X] T077 Şifre sıfırlama ucunu kapat veya `NOT_IMPLEMENTED` fırlat: `better-auth.config.ts:35` `sendResetPassword` boş, `POST /api/auth/request-password-reset` yine de `200` + "check your email" dönüyor (bulgu A4, test kırmızı) — **TAMAMLANDI (`specs/006-sifre-sifirlama` ile):** "kapsam dışı bırak" kararı süpersede edildi; uç artık gerçekten çalışıyor ve mail gönderiyor. `sendResetPassword` dolduruldu (enumeration koruması, Google-only bilgilendirmesi, FR-011 eski token temizliği), `resetPasswordTokenExpiresIn: 3600`, `revokeSessionsOnPasswordReset: true`, `/reset-password` şifre politikası hook'u ve e-posta başına saatte 3 istek sınırı eklendi. Kapsam: `backend/test/integration/us-reset-*.spec.ts` (15 test) + `analiz-dogrulama.spec.ts` A4 bloğu regresyon testine dönüştürüldü.
- [X] T078 `config/env.validation.ts:19` `RESEND_API_KEY`'i `superRefine` ile koşullu zorunlu yap (`MAIL_TRANSPORT=resend` iken) per ADR-0008 (bulgu A5, test kırmızı) — şu an boş anahtarla açılıyor, hata ilk kayıtta çıkıyor; dosyanın fail-fast amacı production yolunda geçersiz
- [X] T079 [P] `auth/mail/verification-mailer.ts:14` hata yolu ekle: `try/catch` + dönen `{ error }` kontrolü + log per Anayasa İlke VI (sessiz başarısızlık yasak) (bulgu A6)
- [X] T080 [P] `auth/rate-limit.config.ts:23` süreç-içi `Map` sınırını yaz (çok örnekli dağıtımda baypas, restart'ta sıfırlanma, temizlik yok) — kod yorumu + `docs/API_CONVENTIONS.md` notu (bulgu A7)
- [ ] T081 `prisma/schema.prisma:20-22` `banned`/`banReason`/`banExpires`: Better Auth admin plugin'e geç **veya** kolonları düşür (bulgu A8) — kodda sıfır referans; kök neden `research.md §2` plugin diyor, kod `additionalFields` kullanıyor (aynı çelişki T093'te) — **karar (kullanıcı onayı): admin plugin'e geçilecek**, ancak gerçek implementasyon **ertelendi** (kapsam büyük, ayrı görev/oturum gerektirir); ayrı görev: **T081b** admin plugin entegrasyonu + ban enforcement + test
- [ ] T081b (yeni, T081'den doğdu) Better Auth `admin` plugin'ini `better-auth.config.ts`'e ekle (server: `plugins: [admin()]`, mevcut `role`/`banned`/`banReason`/`banExpires` alanları plugin şemasıyla zaten uyumlu); manuel `role` `additionalFields` tanımını plugin'inkiyle çakışmayacak şekilde birleştir/kaldır; banli kullanıcı sign-in'de reddedilsin (plugin varsayılanı); en az bir entegrasyon testi (banli kullanıcı 403/401 alır) yaz — **kullanıcı isteğiyle şimdilik yapılmadı, ayrı oturumda ele alınacak**
- [X] T082 [P] Hikâye 3 kabul kriteri numaralarını düzelt — doğrusu: parola→Google bağlama **4**, Google→parola reddi **3**, iptal **5**, admin reddi **6**; hatalı: `data-model.md:101,103,106`, `quickstart.md:74,76,77,78`, `tasks.md:186,187`, `better-auth.config.ts:68` (bulgu I5) — ATDD zinciri (AC→test→kod) bu dilimde okunamıyor

### Orta — yapılandırma / kalite

- [X] T083 [P] Sürüm sapmasını kapat: `frontend/package.json` TS `~6.0.2` + Vite `^8.1.1` ↔ `docs/TECH_STACK.md` TS 5.x + Vite 6.x; backend TS `^5.7.3` → tek repoda iki TypeScript majörü. Ya TECH_STACK güncellenir ya sürümler düşürülür (bulgu G2)
- [X] T084 `frontend/vite.config.ts:17` proxy'si ölü — `auth-client.ts:6` mutlak `http://localhost:3000` kullanıyor. Birini seç: göreli `baseURL` (proxy çalışır, dev'de CORS gereksiz) **veya** proxy'yi sil + `VITE_API_URL`'i `.env.example`'a ekle. `case-study/SETUP.md`'nin "Vite proxy'ler, ayrı `.env` gerekmez" cümlesi de buna göre düzeltilir (bulgu G3)
- [X] T085 [P] Frontend'e formatter ekle (kök `.prettierrc` + frontend'de kullanımı) — backend ESLint 9 + Prettier, frontend yalnız oxlint; görünür sonuç: backend noktalı virgüllü, frontend değil. T006 bunu iddia ediyor ama `[X]` işaretli (bulgu G4)
- [X] T086 [P] Metin dili kuralını yaz ve uygula: **kullanıcıya görünen metinler tam Türkçe (aksanlı), kod yorumları ASCII** — düzeltilecekler: `login-form.tsx:51,63,71`, `sign-up.hook.ts:8-10`, `better-auth.config.ts:113`, `verification-mailer.ts:22` (gerçek kullanıcıya giden e-posta, tek cümlede karışık) (bulgu E) — ayrıca `register-form.tsx`, `pages/admin/login.tsx` ve bunlara bağlı vitest/playwright test dosyaları eşleşecek şekilde güncellendi
- [X] T087(a),(c) Test kapsamı boşlukları: (a) `us1-register-happy.spec.ts`'e mailer mock + assertion eklendi — T018 "doğrulama e-postası tetiklendi" iddiası artık doğrulanıyor, `MAIL_TRANSPORT=resend` ile de **gerçek mail göndermiyor**; (c) integration testleri artık ayrı `test_e2e` şemasına yazıyor (`backend/test/global-setup.js` + `jest-e2e.json`), dev DB'nin `public` şeması etkilenmiyor. (b) (`us5-ownership-guard.spec.ts` istemci baypas testi) bu oturumun kapsamı dışında bırakıldı, dokunulmadı.

### Düşük

- [X] T088 [P] `test/jest-e2e.json`'a `testTimeout` ekle; `us5` `TestOnlyModule`'ün `AuthModule`'ün zaten export ettiği guard'ları yeniden provide etmesini kaldır; `npm run test`'in (`rootDir: src`) yalnız 2 dosya görmesi nedeniyle `test:cov`'un yanıltıcı olduğunu belgele (bulgular F5a/F5b/F5c)
- [X] T089 [P] Nest iskelet artıklarını kaldır: `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` (`GET /` → "Hello World!") (bulgu A10)
- [X] T090 [P] `.env.example`: ölü `CAPTCHA_SITE_KEY`/`CAPTCHA_SECRET_KEY` sil, eksik `PORT` ekle (bulgu A11) — `env.validation.ts`'de zaten CAPTCHA referansı yoktu
- [X] T091 [P] Auth formlarındaki alanlara `<label>` ekle (şu an yalnız `placeholder` → ekran okuyucuda adsız) per `frontend/test/analiz-dogrulama.test.tsx` (bulgu A12, test kırmızı) — T068 shadcn geçişiyle birlikte yapılabilir
- [X] T092 [P] FR-016 (şifre düz metin saklanmaz) için doğrudan test yaz — şu an yalnız T065 gözden geçirmesine dayanıyor (bulgu C2) → `backend/test/integration/us1-password-not-plaintext.spec.ts`
- [X] T093 [P] `research.md`'yi kodla hizala: §2 admin plugin ile kod `additionalFields` (T081'in kök nedeni), §7 Better Auth `rateLimit` ile kod özel e-posta sayacı (gerekçe `rate-limit.config.ts`'te var, research'e işlenmemiş) (bulgular C1'/C2')
- [X] T094 [P] `quickstart.md:32` `docker run ...` komutunu repodaki `docker-compose.yml` ile değiştir (bulgu C3')
- [X] T095 [P] Kararsız `403/404` yazımını tekleştir: `contracts/authz-rules.md:36` ve `contracts/auth-api.md:36` ("409/403") per `docs/API_CONVENTIONS.md §1` (bulgular C4'/I10) — üstte daraltma notu var, tablolar güncellenmemiş
- [X] T096 [P] `contracts/auth-api.md:108` mail gönderimi `[NETLEŞTİRİLECEK]` işaretini kaldır, ADR-0008'e (Resend) bağla (bulgu C5')
- [X] T097 [P] İstemci/sunucu şifre politikasının eşitliğini doğrulayan test yaz (`frontend/src/lib/validation.ts` ile `backend/src/auth/hooks/sign-up.hook.ts`) (bulgu I1') → `frontend/test/password-policy-parity.test.ts` (sunucu tarafı tek kaynak: `password-policy.ts`)
- [X] T098 [P] `login-form.tsx:36` `window.location.href = '/'` yerine react-router `navigate` kullan (tam sayfa yenilemesi gereksiz) (bulgu I4') → `frontend/test/login-form.test.tsx` navigate assert'i ekledi

### Not

- **A9 (shadcn/ui kilitli yığında ama hiç kurulmamış)** ayrı görev almadı: `frontend/components.json` var, `src/components/ui/` ve `@radix-ui/*` yok — kapsamı zaten **T068** (ertelendi, kullanıcı kararı); ilk kurulumu `002` T078 (`npx shadcn add chart`) yapacak
- **F1 (throttling) çürüdü:** test `401 x10 -> 429` ve backoff sonrası `200` gösterdi, FR-017 eksiksiz çalışıyor. Geçerli olan tek kısım `us2-throttling.spec.ts`'in tek `expect(lastStatus).toBe(429)` ile bunu doğrulamaması — davranış hatası değil, **test kapsamı boşluğu** (T087 ile aynı aile)
- **H2 (`grill.md` repo kökünde)** — dosya **silinmedi**, kökte duruyor. Bunun yerine başına "TARİHSEL KAYIT — kısmen geçersiz, çelişkide `specs/` ve `docs/DECISIONS.md` geçerlidir" uyarısı eklendi; ham grilling çıktısı olarak korunmasına karar verildi *(not 2026-08-05'te düzeltildi — önceki hâli "dosya silindi" diyordu, yanlıştı)*

---

## Faz 12: KVKK Aydınlatma ve Açık Onay (geriye dönük, 2026-08-05)

**Neden ayrı faz:** Bu akış 2026-08-04/05'te implemente edildi ama **hiçbir spec'e
yazılmamıştı** — `specs/`, `docs/` ve `case-study/` genelinde "KVKK" geçmiyordu
(Anayasa İlke II sapması). Doküman senkronizasyonunda mevcut davranış spec'e alındı
(`spec.md` FR-020 + Hikâye 7 + SC-008) ve yapılmış iş buraya görev olarak kaydedildi.
Görevler `[X]`'tir çünkü kod ve testleri mevcuttur; ATDD sırası (test önce) bu akışta
**uygulanmadı**, bu bilinçli olarak kayda geçirilmiştir.

- [X] T099 [US7] `User.kvkkConsentAt DateTime?` alanını ekle + migration (FR-020) — `backend/prisma/schema.prisma`, `specs/001-auth-rol/data-model.md`
- [X] T100 [US7] `UsersModule` + `UsersController`: `GET /api/users/me` (onay durumunu da döner) ve `POST /api/users/me/kvkk-consent` (yalnızca kendi kaydına yazar); ikisi de `SessionGuard` arkasında, oturumsuz `401` (FR-020, Anayasa İlke V) — `backend/src/users/`
- [X] T101 [US7] `app.module.ts`'ye `UsersModule` kaydı — `backend/src/app.module.ts`
- [X] T102 [P] [US7] Entegrasyon testi: onaysız kullanıcıda alan `null`; onay sonrası zaman damgası dolu ve **değişmez** (tek seferlik); oturumsuz istek `401` — `backend/test/integration/kvkk-consent.spec.ts`
- [X] T103 [P] [US7] Frontend onay popup'ı: aydınlatma metninin tamamı okunabilir, onay kutusu **varsayılan işaretsiz**, işaretlenmeden onay düğmesi çalışmaz; onaydan sonra bir daha gösterilmez — `frontend/src/components/kvkk-consent-dialog.tsx`, `frontend/src/lib/users-client.ts`
- [ ] T104 [P] [US7] Frontend birim testi: kutu işaretsizken onay çağrısı **yapılmaz**, işaretlendiğinde yapılır ve popup kapanır — **yazılmadı**; davranış yalnızca sunucu tarafında (`kvkk-consent.spec.ts`) doğrulanıyor — `frontend/test/kvkk-consent-dialog.test.tsx`
- [X] T105 [P] [US7] `docs/API_CONVENTIONS.md`'ye `/api/users/me` uçlarını işle — `docs/API_CONVENTIONS.md`
