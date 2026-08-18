# Uygulama Planı: Kimlik Doğrulama & Rol (Auth)

**Dal (Branch)**: `001-auth-rol` | **Tarih**: 2026-07-29 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/001-auth-rol/spec.md` özellik spesifikasyonu

**Not**: Bu plan `speckit.plan` iş akışıyla üretilmiştir. Teknoloji yığını ADR-0001…0003
(bkz. `docs/DECISIONS.md`) ile kilitlenmiştir ve burada yeniden tartışılmaz.

## Özet

Bu dilim, AI destekli Mock Interview uygulamasının **ilk dikey dilimi** olan Kimlik
Doğrulama & Rol temelini kurar: e-posta/şifre ile kayıt ve giriş (zorunlu e-posta
doğrulaması), Google OAuth ile kullanıcı girişi, yalnızca e-posta/şifre ile admin
girişi, "kullanıcı/admin" rol ayrımı, "Beni hatırla" ile 30 gün / aksi halde
session-scoped oturum yönetimi ve **sunucu tarafı** rol/sahiplik yetkilendirmesi.

**Teknik yaklaşım**: Kimlik doğrulama altyapısı olarak **Better Auth**, NestJS
backend içinde bir kütüphane olarak (kendi PostgreSQL'imizde) çalıştırılır. Better
Auth'un framework-agnostik Node/Web `handler`'ı, NestJS'e küçük bir **adapter/köprü**
(catch-all controller) ile mount edilir. Veri erişimi **Prisma** ORM ile yapılır ve
Better Auth'un resmi Prisma adaptörü, kullanıcı/oturum/hesap/doğrulama tablolarını
yönetir. Rol tabanlı yetkilendirme NestJS **Guard + decorator** ile, sahiplik
kontrolü kaynak sahibi karşılaştırmasıyla sunucu tarafında uygulanır. Frontend React
19 + Vite + TypeScript + Tailwind + shadcn/ui ile Better Auth React istemcisini kullanır.

## Teknik Bağlam

**Dil/Sürüm**: TypeScript 5.x (Node.js 20 LTS backend); React 19 (frontend)

**Birincil Bağımlılıklar**:
- Backend: NestJS (latest), Better Auth (latest) + `@better-auth/prisma` adaptörü,
  Prisma (latest), `zod` (girdi doğrulama)
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui, `better-auth/react` istemcisi

**Depolama**: PostgreSQL 16 — geliştirmede Docker (local), production'da managed
bulut Postgres (Neon/Supabase/Railway/RDS). Ortamlar arasında yalnızca `DATABASE_URL` değişir.

**Test**: Jest (backend birim/entegrasyon), Supertest (NestJS e2e/HTTP), Vitest +
React Testing Library (frontend), Playwright (uçtan uca akış — Google OAuth mock/staging).
Spec'teki Türkçe Gherkin kabul kriterleri entegrasyon/e2e testlerine bağlanır (ATDD, İlke III).

**Hedef Platform**: Modern web tarayıcıları (SPA); backend Linux sunucu / container.

**Proje Türü**: Web uygulaması (ayrı `backend/` + `frontend/`).

**Performans Hedefleri**: Kayıt akışı < 2 dk (SC-001), giriş akışı < 30 sn (SC-002).
Auth uç noktaları için tipik p95 < 300 ms hedeflenir (kesin bütçe kritik değil, bu dilim
düşük hacimlidir).

**Kısıtlar**:
- Tüm yetkilendirme sunucu tarafında (FR-011, İlke V); istemci kontrolüne güvenilmez.
- Sırlar koda gömülmez; `.env` ile sağlanır, `.env.example` paylaşılır (FR-015/FR-018, İlke V).
- Şifreler geri döndürülemez biçimde saklanır (FR-016) — Better Auth varsayılan hash (scrypt).
- Admin yalnızca seed/migration ile tanımlanır; uygulama içi admin kaydı/yükseltme yok (FR-018).

**Ölçek/Kapsam**: Staj/vaka çalışması ölçeği (onlarca–yüzlerce kullanıcı). Bu dilimin
kapsamı: 6 kullanıcı hikâyesi, 19 fonksiyonel gereksinim, tek `AuthModule` dikey dilimi.

## Anayasa Kontrolü (Constitution Check)

*KAPI: Phase 0 araştırmasından önce geçilmeli; Phase 1 tasarımdan sonra yeniden kontrol edilir.*

Anayasa `v1.0.0` ilkelerine göre değerlendirme:

| İlke | Durum | Bu dilimde nasıl karşılanıyor |
|------|-------|-------------------------------|
| **I. AI-Native & Devlog** | ✅ Uyumlu | Oturum sonunda `AI-DEVLOG.md` güncellenecek (tasks fazının çıktısı). Planlama AI ile yürütülüyor. |
| **II. Spec-Öncelikli** | ✅ Uyumlu | `spec.md` mevcut; Türkçe Gherkin kabul kriterleri mutlu yol + edge + error kapsıyor. |
| **III. Test-Öncelikli / ATDD** | ✅ Uyumlu (kapı: tasks) | Kabul kriterleri e2e/entegrasyon testlerine eşlenir; testler koddan önce yazılır (Kırmızı→Yeşil→Refactor). Auth kritik akış olduğundan test kapsamı olmadan merge edilmez. |
| **IV. Dikey Dilim & Düzen** | ✅ Uyumlu | Tek `AuthModule` uçtan uca (UI → NestJS Guard/handler → Postgres). Kökteki teslim dosyaları (`SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md`) zorunlu. |
| **V. Güvenlik & Injection Savunması** | ✅ Uyumlu | Sunucu tarafı yetki (FR-011), sır gömme yasağı (`.env`/`.env.example`, FR-015/018), şifre hash (FR-016), throttling (FR-017). Bu dilimde LLM girdisi yok; injection yüzeyi minimal. |
| **VI. LLM Sözleşmesi & Gözlemlenebilirlik** | ➖ Uygulanamaz (bu dilimde LLM yok) | Auth diliminde LLM çağrısı yoktur; ilke sonraki dilimlerde uygulanır. |
| **VII. Kararların Gerekçelendirilmesi & UX** | ✅ Uyumlu | Backend/DB/Auth kararları ADR-0001…0003'te gerekçeli. Mail gönderim yolu ayrı ADR olarak [NETLEŞTİRİLECEK]. UX: genel hata mesajları (FR-014, SC-007), Google yönlendirme uyarısı. |

**Karmaşıklık kapıları**: İlave karmaşıklık yok. Better Auth managed servis yerine
self-hosted seçildi (ADR-0003) — veri sahipliği ve admin istatistik/soft-delete
ihtiyacıyla gerekçeli. Ayrı bir auth mikroservisi kurulmaz; kütüphane olarak backend
içinde çalışır. **Sonuç: GEÇTİ (PASS)** — gerekçesiz ihlal yok.

**Post-Design yeniden değerlendirme (Phase 1 sonrası)**: Tasarım çıktıları
(`data-model.md`, `contracts/`, `quickstart.md`) yalnızca `AuthModule` sınırında kaldı;
yeni bağımlılık veya katman eklenmedi. Anayasa kontrolü **hâlâ GEÇİYOR**.

## Proje Yapısı

### Dokümantasyon (bu özellik)

```text
specs/001-auth-rol/
├── plan.md              # Bu dosya (speckit.plan çıktısı)
├── research.md          # Phase 0 çıktısı
├── data-model.md        # Phase 1 çıktısı
├── quickstart.md        # Phase 1 çıktısı
├── contracts/           # Phase 1 çıktısı (auth uç nokta sözleşmeleri)
│   ├── auth-api.md
│   └── authz-rules.md
├── checklists/
│   └── requirements.md  # (mevcut)
└── tasks.md             # Phase 2 çıktısı (speckit.tasks — bu komut ÜRETMEZ)
```

### Kaynak Kod (repo kökü)

Web uygulaması yapısı (frontend + backend ayrı):

```text
backend/
├── prisma/
│   ├── schema.prisma          # user, session, account, verification + role
│   └── seed.ts                # admin hesabı seed (env'den kimlik bilgileri)
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/                  # AuthModule (dikey dilim)
│   │   ├── auth.module.ts
│   │   ├── better-auth.config.ts   # Better Auth örneği (plugins, providers)
│   │   ├── better-auth.controller.ts # catch-all köprü: /api/auth/* → handler
│   │   ├── auth.service.ts          # oturum/kullanıcı yardımcıları
│   │   ├── rate-limit.config.ts     # başarısız giriş throttling ayarları (FR-017)
│   │   ├── guards/
│   │   │   ├── session.guard.ts     # oturum doğrulama (server-side)
│   │   │   └── roles.guard.ts       # rol tabanlı yetki
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts   # @Roles('admin')
│   │   │   └── current-user.decorator.ts
│   │   ├── ownership/
│   │   │   └── ownership.guard.ts   # sahiplik (kendi verisi) kontrolü
│   │   ├── hooks/
│   │   │   ├── sign-up.hook.ts      # kayıt sonrası doğrulama maili tetikleme (FR-019)
│   │   │   └── oauth-link.hook.ts   # Google/e-posta hesap eşleştirme kuralı (FR-006)
│   │   ├── mail/
│   │   │   └── verification-mailer.ts # e-posta doğrulama gönderimi
│   │   └── admin/
│   │       └── admin.controller.ts  # admin seed/panel erişim uçları (FR-018)
│   ├── prisma/
│   │   └── prisma.service.ts
│   └── config/
│       └── env.validation.ts        # zod ile env doğrulama
└── test/
    ├── integration/           # register/login/verify/authz (Gherkin eşlemesi)
    └── e2e/                    # Supertest + Playwright akışları

frontend/
├── src/
│   ├── lib/
│   │   └── auth-client.ts     # better-auth/react istemcisi
│   ├── pages/
│   │   ├── register.tsx
│   │   ├── login.tsx
│   │   ├── verify-email.tsx
│   │   └── admin/login.tsx    # admin: yalnızca e-posta/şifre
│   ├── components/
│   │   └── auth/              # form bileşenleri (shadcn/ui)
│   └── routes/
│       └── protected.tsx      # istemci tarafı yönlendirme (UX; yetki sunucuda)
└── test/                      # Vitest + RTL

.env.example                  # tüm gizli anahtarların örnek şablonu (kök veya backend/)
```

**Yapı Kararı**: Web uygulaması yapısı seçildi çünkü frontend (React SPA) ve backend
(NestJS) ayrı çalışır ve farklı test/derleme araçlarına sahiptir. Auth mantığı tek bir
`backend/src/auth/` dikey diliminde toplanır (İlke IV). Better Auth istemci/sunucu
sözleşmesi `frontend/src/lib/auth-client.ts` ↔ `backend/src/auth/better-auth.*` arasında
paylaşılır.

## Karmaşıklık Takibi

> Anayasa kontrolünde gerekçelendirilmesi gereken ihlal bulunmadığından bu tablo boştur.

İhlal yok — tüm kararlar ADR-0001…0003 ile gerekçelendirilmiş; ek katman/proje eklenmedi.

## Phase 0: Araştırma

Ayrıntılar için bkz. [research.md](./research.md). Çözülen belirsizlikler:
Better Auth ↔ NestJS köprü yaklaşımı, Prisma şema stratejisi, Google OAuth + hesap
bağlama mantığı, throttling/CAPTCHA, oturum stratejisi, admin seed, rol yetkilendirme.
**Kalan [NETLEŞTİRİLECEK]**: E-posta gönderim yolu (SMTP/servis) — ayrı ADR'ye ertelendi.

## Phase 1: Tasarım & Sözleşmeler

- **Veri modeli**: [data-model.md](./data-model.md) — Prisma şeması (user/session/account/
  verification + `role`, `banned`/deneme sayacı), ilişkiler, doğrulama kuralları.
- **Sözleşmeler**: [contracts/auth-api.md](./contracts/auth-api.md) (uç noktalar),
  [contracts/authz-rules.md](./contracts/authz-rules.md) (rol/sahiplik matrisi).
- **Doğrulama kılavuzu**: [quickstart.md](./quickstart.md) — kurulum + kabul senaryolarının
  uçtan uca doğrulanması.

## Tamamlanma Raporu

Bu komut Phase 1 tasarımından sonra sonlanır. Üretilen çıktılar Tamamlanma bölümünde özetlenir.
