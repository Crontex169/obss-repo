# Hızlı Başlangıç & Doğrulama: Kimlik Doğrulama & Rol (Auth)

**Dilim**: `001-auth-rol` | **Tarih**: 2026-07-29

Bu belge, Auth diliminin **uçtan uca çalıştığını kanıtlayan** doğrulama senaryolarını
tanımlar. Uygulama ayrıntıları (kod, migration gövdeleri) burada tekrarlanmaz; bkz.
[plan.md](./plan.md), [data-model.md](./data-model.md), [contracts/](./contracts/).
Senaryolar spec'teki Türkçe Gherkin kabul kriterlerine bağlıdır (ATDD, İlke III).

---

## Ön Koşullar

- Node.js 20 LTS, npm/pnpm
- Docker (local PostgreSQL için)
- Google OAuth istemci kimliği/sırrı (test projesi)
- `.env` dosyası `.env.example`'dan türetilmiş (gerçek değerlerle; git'e girmez)

### Ortam değişkenleri (`.env.example` → `.env`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL`,
`MAIL_*` **[NETLEŞTİRİLECEK — ADR-0008]**, `CAPTCHA_*` (opsiyonel).
Tam liste: [research.md §9](./research.md).

---

## Kurulum

```bash
# 1) PostgreSQL (local Docker Compose — repo kokunde docker-compose.yml)
docker compose up -d postgres

# 2) Backend
cd backend
npm install
npx prisma migrate dev          # user/session/account/verification + role
npm run db:seed                 # admin hesabı (ADMIN_EMAIL/ADMIN_PASSWORD env'den)
npm run start:dev               # NestJS + Better Auth handler (/api/auth/*)

# 3) Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

Geliştirmede e-posta gönderimi henüz kararlaştırılmadığından (ADR-0008), doğrulama
bağlantısı geçici olarak konsola log'lanır veya bir local mail yakalayıcı (ör. MailHog)
kullanılır.

---

## Doğrulama Senaryoları

Her senaryo bir kabul kriterine eşlenir. ✅ = beklenen sonuç.

### S1 — E-posta/şifre kaydı + zorunlu doğrulama *(Hikâye 1, FR-019)*
1. `POST /api/auth/sign-up/email` geçerli e-posta + `Parola12` ile.
   ✅ `User(role="user", emailVerified=false)` oluşur; doğrulama bağlantısı gönderilir.
2. Doğrulamadan `sign-in/email` denenir → ✅ `403 EMAIL_NOT_VERIFIED`.
3. Doğrulama bağlantısı açılır → `emailVerified=true` → giriş başarılı.
4. Zayıf şifre (`abc`) veya geçersiz e-posta → ✅ `400` genel doğrulama hatası.
5. Aynı e-posta ile tekrar kayıt → ✅ `409` (ayrıntı sızdırmadan).

### S2 — Giriş / Çıkış *(Hikâye 2)*
1. Doğru kimlik bilgisiyle giriş → ✅ `200`, oturum çerezi.
2. `sign-out` → ✅ oturum sonlanır; korunan uç nokta `401`.
3. Yanlış şifre → ✅ `401` **genel** mesaj (alan sızdırmaz — SC-007).
4. Aynı e-posta 10 başarısız deneme → ✅ `429` throttling/CAPTCHA; tam kilit YOK (FR-017).

### S3 — Google OAuth + hesap bağlama *(Hikâye 3)*
1. Yeni Google hesabıyla giriş → ✅ `User(role="user", emailVerified=true)` tek seferde (SC-005).
2. Önce parola ile kayıtlı e-posta, sonra aynı e-posta Google ile → ✅ otomatik aynı hesaba bağlanır
   (mükerrer yok — kriter 4).
3. Önce Google ile kayıtlı e-posta, sonra parola ile kayıt/giriş → ✅ parola hesabı OLUŞMAZ,
   "Google ile giriş yapın" uyarısı + yönlendirme (kriter 3).
4. Google akışı iptal/hata → ✅ oturum açmadan giriş ekranına bilgi mesajı (kriter 5).
5. Admin e-postasıyla Google denemesi → ✅ reddedilir (FR-006, kriter 6).

### S4 — Admin girişi *(Hikâye 4)*
1. Seed admin, e-posta/şifre ile giriş → ✅ `role="admin"` oturum; admin paneli erişilir.
2. Kullanıcı (user) admin paneli uç noktasına erişir → ✅ `403` (SC-004).
3. Admin arayüzünde Google butonu **yok**; sunucu admin için Google'ı reddeder.

### S5 — Sahiplik & rol yetkilendirme *(Hikâye 5, sunucu tarafı)*
1. Kullanıcı B, A'nın kaynağına erişir → ✅ `403/404`, içerik sızdırılmaz (SC-003).
2. Kullanıcı kendi kaynağına erişir → ✅ izin verilir.
3. Admin tüm kayıtları okur → ✅ izin verilir (FR-010).
4. İstemci baypası (doğrudan API) → ✅ sunucu guard reddeder (FR-011).

### S6 — Oturum yaşam süresi *(Hikâye 6, FR-013)*
1. "Beni hatırla" ile giriş → 30 gün geçerli; dönüşte yeniden giriş istenmez.
2. "Beni hatırla" olmadan giriş → tarayıcı oturumu kapanınca oturum sona erer (session-scoped).
3. Süresi dolan oturumla korunan içerik → ✅ `401`, yeniden giriş (SC-006).

---

## Test Bağlama (ATDD)

- Backend entegrasyon/e2e: Jest + Supertest — S1…S6 uç nokta sözleşmelerini doğrular.
- Google OAuth: staging'de mock/otomatik test hesabı ile Playwright.
- Frontend: Vitest + RTL (form doğrulama UX), Playwright (uçtan uca akış).
- Kırmızı → Yeşil → Refactor: testler koddan önce yazılır (İlke III). Auth kritik akış
  olduğundan test kapsamı olmadan merge edilmez.

## Başarı Kriteri Doğrulaması

| Senaryo | Başarı Kriteri |
|---------|----------------|
| S1 (kayıt süresi) | SC-001 (<2 dk) |
| S2 (giriş süresi) | SC-002 (<30 sn) |
| S5.1 / S5.4 | SC-003 (%100 yetkisiz ret) |
| S4.2 | SC-004 (%100 admin paneli ret) |
| S3.1 | SC-005 (mükerrersiz Google kaydı) |
| S6.3 | SC-006 (süre dolunca ret) |
| S2.3 | SC-007 (sızdırmayan hata) |
