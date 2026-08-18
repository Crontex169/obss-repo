# Tasks: Şifre Sıfırlama

**Girdi**: `specs/006-sifre-sifirlama/plan.md`, `spec.md`, `research.md`, `data-model.md`

**Testler**: Anayasa İlke III (test-first/ATDD) gereği ZORUNLU — her görev için testler koddan ÖNCE yazılır (Red→Green).

## Faz 1: Ortak Altyapı (Foundational)

- [X] T001 `backend/src/auth/hooks/password-policy.ts` YENİ dosya: `sign-up.hook.ts` içindeki `passwordPolicy` zod şemasını buraya taşı, `sign-up.hook.ts`'te buradan import et (davranış değişmez, sadece paylaşılabilir hale gelir)
- [X] T002 `backend/src/auth/rate-limit.config.ts`: sıfırlama-istegi icin ayrı bir sayaç fonksiyonu ekle: `checkResetRequestRateLimit(email)` / `recordResetRequest(email)` — e-posta başına saatte 3 istek eşiği, ayrı bir `Map` (mevcut giriş-denemesi `Map`'inden bağımsız)

**Checkpoint**: Paylaşılan sifre politikası ve rate-limit fonksiyonu hazır, US1/US2 bunlara bağımlı.

---

## Faz 2: User Story 1 — Sifirlama istegi gonderme (Priority: P1)

**Goal**: Kullanıcı e-postasıyla istek gönderir; kayıtlı/parola-hesaplı ise gerçek link, Google-only ise bilgilendirme, kayıtsız ise hiçbir mail — ama HER durumda aynı genel yanıt.

### Testler (önce yazılır, FAIL beklenir)

- [X] T003 [P] [US1] `backend/test/integration/us-reset-request-happy.spec.ts`: parola hesaplı kayıtlı kullanıcı için istek → 200 genel mesaj + mail gönderildi (fake mailer spy)
- [X] T004 [P] [US1] `backend/test/integration/us-reset-request-enumeration.spec.ts`: kayıtsız e-posta için istek → AYNI 200 genel mesaj + mail GÖNDERİLMEDİ
- [X] T005 [P] [US1] `backend/test/integration/us-reset-request-google-only.spec.ts`: yalnızca-Google hesap için istek → aynı 200 genel mesaj + "Google ile giriş yapın" içerikli mail gönderildi
- [X] T006 [P] [US1] `backend/test/integration/us-reset-request-rate-limit.spec.ts`: aynı e-posta ile 4. istek → 429

### Implementasyon

- [X] T007 [US1] `backend/src/auth/mail/verification-mailer.ts` yanına `sendPasswordResetEmail(email, url)` ve `sendGoogleOnlyResetNoticeEmail(email)` fonksiyonlarını ekle (mevcut Resend/console transport altyapısı yeniden kullanılır)
- [X] T008 [US1] `backend/src/auth/better-auth.config.ts`: `emailAndPassword.sendResetPassword` callback'ini doldur — Prisma ile `hasCredential`/`hasGoogle` kontrolü (sign-up.hook'taki desenle aynı), credential varsa T007'deki gerçek link mailini, yalnızca google ise bilgilendirme mailini gönder; ayrıca aynı kullanıcı için eski `reset-password:%` `Verification` kayıtlarını (yeni token hariç) sil (FR-011)
- [X] T009 [US1] `better-auth.config.ts`: `emailAndPassword.resetPasswordTokenExpiresIn: 3600` ekle
- [X] T010 [US1] `better-auth.config.ts` `hooks.before`: `ctx.path === '/request-password-reset'` (veya Better Auth'un gerçek path adı, T003 testinde doğrulanır) dalına T002'deki rate-limit kontrolünü ekle

**Checkpoint**: US1 bağımsız test edilebilir/çalışır durumda.

---

## Faz 3: User Story 2 — Yeni sifre belirleme (Priority: P1)

**Goal**: Geçerli token ile yeni şifre belirlenir, politika uygulanır, eski oturumlar sonlandırılır.

### Testler (önce yazılır, FAIL beklenir)

- [X] T011 [P] [US2] `backend/test/integration/us-reset-password-happy.spec.ts`: geçerli token + politika-uyumlu şifre → 200, eski şifre ile giriş REDDEDİLİR, yeni şifre ile giriş BAŞARILI
- [X] T012 [P] [US2] `backend/test/integration/us-reset-password-policy.spec.ts`: geçerli token + politika-dışı şifre (kısa/harfsiz/rakamsız) → 400, şifre DEĞİŞMEZ, token hâlâ kullanılabilir
- [X] T013 [P] [US2] `backend/test/integration/us-reset-password-session-revoke.spec.ts`: sıfırlama öncesi açık bir oturum, sıfırlama sonrası o oturumla yapılan istek → 401

### Implementasyon

- [X] T014 [US2] `backend/src/auth/hooks/reset-password.hook.ts` YENİ dosya: T001'deki `passwordPolicy` ile `newPassword`'ü doğrulayan `enforceResetPasswordPolicy` fonksiyonu (sign-up hook'taki WEAK_PASSWORD desenine benzer)
- [X] T015 [US2] `better-auth.config.ts` `hooks.before`: `ctx.path === '/reset-password'` dalına T014'ü bağla
- [X] T016 [US2] `better-auth.config.ts`: `emailAndPassword.revokeSessionsOnPasswordReset: true` ekle

**Checkpoint**: US1 + US2 birlikte tam akışı oluşturur (MVP).

---

## Faz 4: User Story 3 — Gecersiz/suresi dolmus token (Priority: P2)

**Goal**: Süresi dolmuş/tekrar kullanılan/hiç var olmayan token ile denemeler güvenli şekilde reddedilir.

### Testler (önce yazılır, FAIL beklenir)

- [X] T017 [P] [US3] `backend/test/integration/us-reset-password-expired-used.spec.ts`: (a) süresi dolmuş token → 400, (b) daha önce kullanılmış token → 400 (ikisi de Better Auth'un native davranışı, bu test SADECE doğrulama amaçlı — regresyon testi)

### Implementasyon

- [X] T018 [US3] Ek kod GEREKMEZ — Better Auth'un native `consumeVerificationValue`/`expiresAt` kontrolü zaten bunu karşılıyor (bkz. research.md Karar 1). T017 yeşil değilse mevcut Better Auth sürümünde regresyon var demektir, o zaman burada düzeltme yapılır.

**Checkpoint**: Tüm hikayeler bağımsız çalışır durumda.

---

## Faz 5: Frontend

- [X] T019 [P] `frontend/src/pages/forgot-password.tsx` YENİ: e-posta formu, `authClient.requestPasswordReset({ email, redirectTo: '<origin>/reset-password' })` (**not:** bu Better Auth sürümünde istemci metodu `forgetPassword` değil `requestPasswordReset`; rota `/request-password-reset`), gönderim sonrası her zaman aynı genel mesajı gösterir (backend'in FR-002 davranışını olduğu gibi yansıtır, frontend ayrım YAPMAZ)
- [X] T020 [P] `frontend/src/pages/reset-password.tsx` YENİ: URL'den `token` okur, yeni şifre formu, `authClient.resetPassword({ newPassword, token })`, başarı sonrası `/login`'e yönlendirir
- [X] T021 `frontend/src/pages/login.tsx` (veya mevcut giriş formu) içine "Şifremi unuttum" bağlantısı ekle (`/forgot-password`'e yönlendirir)
- [X] T022 `frontend/src/App.tsx` route tanımlarına `/forgot-password` ve `/reset-password` ekle
- [X] T023 [P] `frontend/test/forgot-password-form.test.tsx`: formun geçerli/geçersiz e-posta ile davranışını test eder (backend mock'lanır)

---

## Faz 6: Belgeleme ve Kapanış

- [X] T024 `specs/001-auth-rol/tasks.md` T077 satırındaki "SÜPERSEDE EDİLDİ" notunu, bu feature tamamlandıktan sonra "TAMAMLANDI" olarak güncelle
- [X] T025 `backend/test/integration/analiz-dogrulama.spec.ts` A4 test bloğunu güncelle: artık uç GERÇEKTEN çalışıyor ve mail gönderiyor, eski "kapsam dışı, başarılı yanıt DÖNMEMELİ" iddiası artık geçersiz — teste gerçek davranışı doğrulayan yeni assertion'lar yaz (veya bloğu kaldırıp US1/US2 testlerine yönlendiren bir not bırak)
- [X] T026 `case-study/AI_DEVLOG.md`'ye bu oturum için devlog girişi ekle (AI aracı, iterasyonlar, kullanılan MCP/skill'ler)

## Bağımlılıklar

- Faz 1 (T001-T002) → Faz 2/3/4'ü bloklar.
- Faz 2 (US1) ve Faz 3 (US2) paralel yürütülebilir (farklı hook'lar/testler) ama ikisi de `better-auth.config.ts`'i değiştirdiği için SIRAYLA commit edilmeli (aynı dosya çakışması).
- Faz 4 (US3) yalnızca doğrulama; Faz 2/3 tamamlanınca çalıştırılabilir.
- Faz 5 (Frontend) Faz 2/3 API sözleşmesi netleşince başlayabilir, backend'den bağımsız geliştirilebilir (mock ile).
- Faz 6 en son.
