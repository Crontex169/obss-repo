# PROJECT_MAP.md — Proje Haritası (Kod + Kararlar + Durum)

> **Amaç:** Bu depodaki her kod dosyasının/klasörünün ne işe yaradığını, hangi
> teknolojinin nerede kullanıldığını, hangi kararın (ADR) hangi dosyayı
> etkilediğini ve her dilimin **hangi aşamada** olduğunu tek yerden cevaplayan
> referans doküman. Detay gerekçeler için ilgili kaynağa link verilir — burada
> tekrarlanmaz (tek doğruluk kaynağı ilkesi, bkz. `docs/DECISIONS.md`).
>
> Güncel tutulmalıdır: yeni bir dilim/klasör/karar eklendiğinde bu dosya da
> güncellenir. Son güncelleme: 2026-08-10.

---

## 1. Proje nedir (30 saniyede)

**Mock Interview** — iş ilanı yapıştırılır → LLM N adet mülakat sorusu üretir →
kullanıcı soruları tek tek (yazılı veya sesli) yanıtlar → LLM 3 eksenli
(Teknik/Davranışsal/Genel) değerlendirme raporu üretir. Ayrıca bağımsız bir
**ön yetkinlik değerlendirmesi** (pre-assessment) ve token/maliyet takibi yapan
bir **admin paneli** var. Metodoloji: **Spec-Driven Development + ATDD**
(bkz. `.specify/memory/constitution.md`).

---

## 2. Depo ağacı — üst düzey

```
Group-4/
├── backend/          NestJS API (bkz. §4)
├── frontend/          React 19 + Vite SPA (bkz. §5)
├── docs/               Kalıcı proje dokümanları — tek doğruluk kaynağı (bkz. §3)
├── specs/              Spec-Kit dilimleri: spec → plan → tasks → implement (bkz. §6)
├── SETUP.md · AI-DEVLOG.md · DECISIONS.md   Kökte teslim edilen 3 zorunlu dosya (bkz. §7)
├── .specify/           Spec-Kit motoru: şablonlar, scriptler, anayasa, workflow
├── .github/            Custom agent tanımları + prompt'lar (analyst/architect/...)
├── docker-compose.yml   Local PostgreSQL 16 (auth-postgres, port 5432)
├── .env.example         Örnek ortam değişkenleri (gerçek .env DEĞİL, commit'lenir)
└── README.md            Kurulum + çalıştırma talimatları (bkz. kök README)
```

---

## 3. `docs/` — karar ve plan kaynakları (okuma önceliği)

| Dosya | Ne içerir | Otorite |
|-------|-----------|---------|
| `.specify/memory/constitution.md` | 7 ilke (AI-devlog, spec-first, test-first/ATDD, dikey dilim, güvenlik, LLM sözleşmesi, ADR) | **En yüksek** — çelişkide bu kazanır |
| `docs/TECH_STACK.md` | Kilitlenen teknoloji tablosu (versiyonlarla) | Kilitli satırlar değiştirilemez; `_TBD_` = henüz karar yok |
| `docs/DECISIONS.md` | ADR-0001..0012, tam gerekçe/alternatif/risk analiziyle | Teknoloji seçim kaydı — bkz. §8 |
| `docs/APP_FLOW.md` | Kullanıcı/admin akış diyagramları (Mermaid), ekran listesi, kilitli UI kararları | Ürün akışı |
| `docs/PLAN.md` | Fazlı çalışma planı + MVP/Bonus fonksiyon backlog'u | Kapsam kararları |
| `docs/API_CONVENTIONS.md` | REST sözleşme kuralları (hata formatı, DTO doğrulama, LLM şema kısıtları) | Backend/Frontend contract |
| `docs/SECURITY.md` | Güvenlik analizi: doğru kurulmuş alanlar, açık bulgular (S1-S12), fazlı iyileştirme planı | Güvenlik bulgu kaydı — karar alınırsa ADR `DECISIONS.md`'ye yazılır |

---

## 4. `backend/` — NestJS API

**Çalıştırma:** `cd backend && npm run start:dev` → `http://localhost:3000`
**DB:** Prisma 6.19.3 (exact pin, ADR-0005) → PostgreSQL 16 (Docker local)

```
backend/src/
├── main.ts                    Nest bootstrap, global pipe/filter kayıtları
├── app.module.ts               Kök modül — tüm alt modülleri birbirine bağlar
├── config/
│   └── env.validation.ts       Zod ile .env doğrulama — eksikse uygulama BAŞLAMAZ
├── common/                     Cross-cutting, dilime özel olmayan yardımcılar
│   ├── guards/llm-rate-limit.guard.ts  Ortak LLM kotası guard'ı (`llmQuota(n)` ile dikey başına yapılandırılır)
│   ├── http-exception.filter.ts  Tekdüzen hata JSON formatı
│   ├── zod-validation.pipe.ts   HTTP DTO doğrulama (class-validator DEĞİL, Zod — ADR gerekçesi TECH_STACK.md'de)
│   └── language.ts              Accept-Language → tr|en tespiti (cross-cutting, 002/003 ortak)
├── prisma/
│   ├── prisma.module.ts / prisma.service.ts   Prisma Client'ı Nest DI'a bağlar
├── auth/                        001-auth-rol dilimi
│   ├── better-auth.config.ts     Better Auth kurulumu (self-hosted, kendi Postgres)
│   ├── better-auth.controller.ts /api/auth/* köprüsü
│   ├── auth.service.ts / auth.module.ts
│   ├── guards/session.guard.ts   Oturum var mı kontrolü (guard zincirinin 1. halkası)
│   ├── guards/roles.guard.ts     Rol kontrolü (user/admin) — 2. halka
│   ├── ownership/ownership.guard.ts  Kaynak sahiplik kontrolü — 3. halka (kullanıcı başkasının verisini göremez)
│   ├── decorators/               @Roles() vb. custom decorator'lar
│   ├── hooks/sign-up.hook.ts      Kayıt sırasında ek iş kuralları
│   ├── hooks/oauth-link.hook.ts   Google hesabı mevcut e-postayla eşleşirse bağlama
│   ├── hooks/reset-password.hook.ts  006: sıfırlama politikası (tek kullanım, süre, oturum iptali)
│   ├── hooks/password-policy.ts   Şifre kuralları — frontend `validation.ts` ile eşlenir (parite testi var)
│   ├── mail/verification-mailer.ts  Doğrulama + şifre sıfırlama e-postaları (console|resend, ADR-0008)
│   ├── rate-limit.config.ts      Throttling (başarısız login + sıfırlama isteği sayaçları)
│   └── admin/admin.controller.ts  Admin oturum uçları (001 kapsamı)
├── users/                        Kullanıcı profili + KVKK onayı (001 FR-020) + hesap silme
│   ├── users.controller.ts        `GET /api/users/me`, `POST /api/users/me/kvkk-consent`, `DELETE /api/users/me` (hesabı sil)
│   └── dto/delete-account.dto.ts   Hesap silme girdi şeması (Zod)
├── admin/                        005-admin dilimi
│   ├── admin-interviews.controller.ts  `GET /api/admin/interviews`, `/:id` (salt okunur)
│   ├── admin-stats.controller.ts       `GET /api/admin/stats` (meslek/süre/tamamlanma/token serisi)
│   ├── admin.service.ts / admin.module.ts
│   └── dto/                             Liste filtresi + istatistik sorgu şemaları (Zod)
├── interview/                   002-interview dilimi
│   ├── interview.controller.ts / .service.ts / .module.ts
│   │     Uçlar: `POST /api/interviews`, `GET /api/interviews`, `GET /:id`,
│   │     `POST /:id/answers`, `GET /:id/report`, `POST /:id/report/retry`,
│   │     `POST /:id/panel-events` (sözlü mod real-time AI asistan olayları), `DELETE /:id`
│   ├── dto/                      Zod şemaları (soru sayısı, mod, cevap, panel-event)
│   ├── llm/                      Soru üretimi + adaptif değerlendirme + rapor prompt entegrasyonu
│   └── ownership/                 Interview'ın sahibi mi kontrolü (auth/ownership'i kullanır)
├── pre-assessment/               003-pre-assessment dilimi
│   ├── pre-assessment.controller.ts / .service.ts / .module.ts
│   │     Uçlar: `POST /api/pre-assessments`, `GET /api/pre-assessments/active`,
│   │     `GET /api/pre-assessments` (liste), `GET /:id`
│   ├── constants/                 Sabit seçenek listeleri (enum → UI etiketi eşlemesi)
│   ├── dto/                       Girdi şemaları (Zod)
│   └── llm/                       Yetkinlik raporu prompt entegrasyonu
├── llm/                          Cross-cutting LLM istemci katmanı (tüm dilimler kullanır)
│   ├── llm.service.ts             Sağlayıcıya bağımsız genel çağrı arayüzü
│   ├── llm.provider.ts            Sağlayıcı seçimi (groq|deepseek, ADR-0007)
│   ├── providers/openai-compatible.provider.ts  Groq/DeepSeek ikisi de OpenAI-uyumlu API (tek `openai` SDK)
│   ├── schema-to-provider.ts       Zod şema → JSON Schema (strict mod, yalnızca gpt-oss-20b/120b'de)
│   ├── token-usage.service.ts      Her çağrıda input/output token + tahmini maliyeti TokenUsage tablosuna yazar
│   └── llm.errors.ts               Hata sınıfları (timeout, şema doğrulama hatası, boş yanıt)
├── pdf/pdf-extraction.service.ts   İş ilanı PDF'inden metin çıkarma (unpdf, ADR-0009)
```

### Backend akış özeti
`main.ts` → global Zod pipe + exception filter kurulur → istek önce
`SessionGuard` (oturum var mı) → `RolesGuard` (user/admin) →
`OwnershipGuard` (kaynağın sahibi mi) sırasıyla süzülür → controller → service
→ Prisma (DB) veya `llm.service.ts` (LLM çağrısı, her çağrı `token-usage.service.ts`
ile loglanır).

---

## 5. `frontend/` — React 19 + Vite SPA

**Çalıştırma:** `cd frontend && npm run dev` → `http://localhost:5173`

> **Backend adresi iki moddan biriyle çözülür.** `VITE_API_URL` dolu ise istemciler
> **mutlak URL** kullanır (local geliştirme yolu); boş bırakılırsa istekler göreli
> `/api/...` yoluna düşer ve `vite.config.ts`'teki proxy devreye girer (Cloudflare
> tunnel gibi tek-origin senaryolar için). Google One Tap ayrıca
> `VITE_GOOGLE_CLIENT_ID` ister — bkz. `frontend/.env.example`.

```
frontend/src/
├── main.tsx / App.tsx            Uygulama kökü, router kurulumu, toast (sonner) kökü
├── routes/protected.tsx           Auth guard'lı route wrapper (giriş yoksa login'e yönlendirir)
├── routes/admin-protected.tsx     Admin rolü guard'ı (005-admin)
├── lib/
│   ├── auth-client.ts              Better Auth istemci SDK sarmalayıcısı
│   ├── interview-client.ts         002-interview API çağrıları
│   ├── pre-assessment-client.ts    003-pre-assessment API çağrıları
│   ├── pre-assessment-options.ts   Enum → Türkçe UI etiketi eşlemesi
│   ├── admin-client.ts             005-admin API çağrıları
│   ├── users-client.ts             001: profil + KVKK onayı uçları
│   ├── voice-client.ts             Web Speech API sarmalayıcısı (ADR-0010, sözlü mod)
│   ├── speech/                      Sözlü mod ileri katmanı (002 FR-035–FR-038, ADR-0010)
│   │   ├── interview-script.ts      Mülakat diyalog kurgusu (FR-037/FR-038)
│   │   ├── pronunciation.ts         Telaffuz normalizasyonu ("C#" → "C sharp", FR-035)
│   │   ├── segment.ts               Dil segmentasyonu + cümle parçalama (FR-035/FR-036)
│   │   └── speech-queue.ts          Ses seçimi, prosodi ve seslendirme kuyruğu (FR-036)
│   ├── theme/                       Açık/koyu tema katmanı (i18n ile aynı desen — bkz. TECH_STACK)
│   │   ├── index.ts                 `light`/`dark`, localStorage + `<html data-theme>`
│   │   └── theme-provider.tsx       Tema context'i (mount tetiklemez, veri kaybettirmez)
│   ├── score-trend.ts              004-history: zaman içinde skor trendi hesaplama
│   ├── report-pdf.ts               004-history: jsPDF ile rapor PDF'i (radar + skor görselleri + soru bazlı geri bildirim, #68)
│   ├── pdf-font-roboto.ts          PDF'e gömülü Roboto (Türkçe karakter desteği)
│   ├── interview-config.ts         Soru başına süre sınırı gibi istemci sabitleri (FR-027)
│   ├── validation.ts               Zod şemaları (frontend form doğrulama)
│   ├── i18n/                        TR/EN çeviri altyapısı (i18next + react-i18next)
│   │   ├── index.ts / language-provider.tsx   Kurulum + dil context'i
│   │   └── locales/{tr,en}/*.json             Alan bazlı çeviri sözlükleri
│   ├── use-sign-out.ts             Ortak çıkış akışı (kabuklar bunu paylaşır)
│   ├── support.ts                  Destek adresi — TEK doğruluk kaynağı (issue #51)
│   └── ui-styles.ts / utils.ts     Ortak stil/yardımcı fonksiyonlar
├── components/
│   ├── app-shell.tsx                Üst navbar + layout kabuğu (sidebar YOK, kilitli karar)
│   ├── kvkk-consent-dialog.tsx      İlk girişte KVKK onay popup'ı (001 FR-020)
│   ├── support-link.tsx             Destek adresi + kopyala; `SupportEscape` hata ekranları için
│   ├── site-footer.tsx              Site geneli alt bilgi (üç kabukta da) — issue #51
│   ├── auth/                        Login/register/şifre-sıfırlama formları + google-one-tap.tsx
│   ├── interview/                   Soru-cevap chat bileşenleri, sayaç, PDF butonu, trend grafiği
│   ├── pre-assessment/               Ön değerlendirme form + rapor bileşenleri
│   ├── admin/                        AdminShell + tablo + Recharts panelleri (005-admin)
│   ├── settings/                     Ayarlar bileşenleri — `delete-account-dialog.tsx` (hesap silme onayı)
│   ├── logo.tsx
│   └── ui/                          shadcn/ui bileşenleri (Button, Card, Dialog, Chart, ...)
└── pages/
    ├── login.tsx / register.tsx / verify-email.tsx     001-auth-rol
    ├── forgot-password.tsx / reset-password.tsx        006-sifre-sifirlama
    ├── dashboard.tsx                                     3 sekme: Geçmiş / Ön Değerlendirme / Görüşme
    ├── home.tsx                                           İniş/tanıtım sayfası (007-ui-design landing spec)
    ├── settings.tsx                                       Ayarlar — uygulama dili (TR/EN) + tema (açık/koyu) + hesap silme
    ├── interview/{list,new,session,report}.tsx           002-interview ekranları
    ├── pre-assessment/{list,new,report}.tsx               003-pre-assessment ekranları
    └── admin/{login,dashboard,stats,interview-detail}.tsx 005-admin ekranları
```

### Frontend test altyapısı
- **Vitest + React Testing Library** → `npm run test` (birim/component)
- **Playwright** → `npm run test:e2e` (backend + Postgres ayrı ayrı ayakta olmalı)

---

## 6. `specs/` — Spec-Kit dilimleri ve **güncel durum**

Her dilim: `spec.md` (ne/neden + Gherkin AC) → `plan.md`+`research.md`+
`data-model.md`+`contracts/` → `tasks.md` (T001, T002, ... checkbox'lı görev
listesi — ilerleme buradan okunur).

| Dilim | Konu | Tamamlanan görev | Durum |
|-------|------|:---:|:--|
| `001-auth-rol` | Kayıt, giriş, Google OAuth, rol/sahiplik guard zinciri, admin seed | **102/106** | ✅ Tamamlandı — açık 3 madde kasıtlı ertelendi (T068 shadcn form geçişi; T081/T081b Better Auth admin plugin) |
| `002-interview` | İş ilanı → soru üretimi → cevap → rapor, sesli/yazılı mod | **142/142** | ✅ Tamamlandı |
| `003-pre-assessment` | Ön yetkinlik değerlendirmesi (meslek-bağımsız) | **66/99** | ✅ Uygulama çalışıyor — açık 33 görevin çoğu Faz 11/12 (meslek-bağımsızlık pivotu) tarafından kapsam dışı bırakılmış/süpersede edilmiş eski satırlardır, gerçek eksik değildir |
| `004-history` | Geçmiş görüşmeler, soft-delete, PDF export, skor trendi | **50/57** | ✅ Tamamlandı — açık 7 madde Playwright e2e + manuel ölçüm (gerçek tarayıcı/dev-server gerektirir) |
| `005-admin` | Admin paneli: kullanıcı/görüşme listesi, token/maliyet istatistiği, filtre | **52/52** | ✅ Tamamlandı |
| `006-sifre-sifirlama` | Şifre sıfırlama: tek-kullanımlık süreli link, enumeration koruması, istek hız sınırı | **26/26** | ✅ Tamamlandı — `001` T077'yi süpersede eder |
| `007-ui-design` | UI tasarımı: iniş sayfası + auth ekranları + responsive düzen (`v2.pen` tasarım kaynağı) | — | 🟡 Uygulanıyor — standart `spec.md` yerine mini-spec'ler (`landing-page-spec.md`, `tasks-auth-ui.md`); responsive iş PR #80 ile birleşti |
| `008-onay-akisi` | Kullanım şartları + gizlilik + KVKK onay kapısı (Google girişinin onayı atlaması düzeltilir) | — | ✅ Approved (spec.md, 2026-08-07, issue #71) — sunucuya onay iletilmesini zorunlu kılar |

> Görev tamamlanma sayıları `tasks.md` içindeki `- [X]` işaretlerinden
> sayıldı (2026-08-05). Kesin ilerleme için ilgili dilimin `tasks.md`
> dosyasına bakın — bazı görevler kasıtlı olarak Bonus/ertelenmiş olabilir,
> bazıları da sonraki bir faz tarafından **geçersiz kılınmıştır** (ör.
> `003-pre-assessment` Faz 12).

Diğer dilim-içi dosyalar: `checklists/` (spec kalite kontrol listeleri),
`quickstart.md` (uçtan uca manuel doğrulama senaryoları), `devir-notu.md` /
`devralma-dogrulama.md` (dilimler arası devir notları — kim neyi kime
devretti), `spike/` + `spike-model-secimi.md` (002-interview: LLM model
seçimi için yapılan deneysel doğrulama, T001).

---

## 7. Repo kökü — teslim edilen zorunlu 3 dosya

| Dosya | İçerik | Kural |
|-------|--------|-------|
| `SETUP.md` | Kurulum/çalıştırma özeti (kök `README.md`'ye referans verir) | Eksik/yanlış konumda → proje değerlendirmeye alınmaz |
| `AI-DEVLOG.md` | Hangi AI aracı/model, kaç iterasyon, blocker, kullanılan MCP/skill | **Sürekli** güncellenir, sona bırakılmaz |
| `DECISIONS.md` | Üst seviye tasarım + mantıksal/fiziksel diyagramlar + karar özeti | ADR kaydının tamamı `docs/DECISIONS.md`'dedir |

---

## 8. Teknoloji yığını — ne nerede kullanılıyor (ADR referanslı)

| Katman | Teknoloji | Nerede | ADR |
|--------|-----------|--------|-----|
| Frontend framework | React 19 + Vite + TS + Tailwind 4 + shadcn/ui | `frontend/src/**` | ADR-0001 |
| Backend framework | NestJS 11 | `backend/src/**` | ADR-0002 |
| Veritabanı | PostgreSQL 16 (Docker local / managed prod) | `docker-compose.yml`, `DATABASE_URL` | ADR-0002 |
| Auth | Better Auth (self-hosted, kendi Postgres) | `backend/src/auth/**` | ADR-0003 |
| Test | Jest+Supertest (backend) / Vitest+RTL+Playwright (frontend) | `backend/test/**`, `frontend/src/test`, `*.spec.ts` | ADR-0004 |
| ORM | Prisma **6.19.3 exact pin** | `backend/prisma/schema.prisma` | ADR-0005 |
| LLM (ilk karar, değiştirildi) | OpenAI | — | ⛔ ADR-0006 (superseded → ADR-0007) |
| LLM (güncel) | Groq (birincil) + DeepSeek (yedek), `openai` SDK ile OpenAI-uyumlu çağrı | `backend/src/llm/**` | ADR-0007 |
| Mail | Resend (`console` modu dev'de varsayılan) | `backend/src/auth/mail/**` | ADR-0008 |
| PDF çıkarma | unpdf | `backend/src/pdf/**` | ADR-0009 |
| Sözlü mod (STT/TTS) | Tarayıcı Web Speech API (istemci taraflı, sunucu maliyeti yok) | `frontend/src/lib/voice-client.ts` | ADR-0010 |
| Grafik | Recharts (shadcn/ui `Chart` üzerinden) | `frontend/src/components/**` (rapor radar/bar, admin) | ADR-0011 |
| PDF üretimi (istemci) | jsPDF (tek başına — `html2canvas` yok) | `frontend/src/lib/report-pdf.ts` | ADR yok — kasıtlı, bkz. `specs/004-history/research-pdf-karar.md` |
| Toast bildirimi | sonner | `frontend/src/App.tsx` + interview bileşenleri | ADR yok — shadcn/ui ekosistemi içi, düşük riskli |
| Tema (açık/koyu) | Kendi ince katmanı (`<html data-theme>` + localStorage) | `frontend/src/lib/theme/**`, `settings.tsx` | ADR yok — kütüphanesiz, düşük riskli (bkz. TECH_STACK) |
| Oturum çerezi / CSRF savunması | Better Auth çerez duruşu + `OriginGuard` | `backend/src/auth/better-auth.config.ts`, `backend/src/common/guards/origin.guard.ts` | ADR-0012 |
| **TBD** | Storage, DevOps/Deployment, Development Tools, Git Workflow | — | Henüz karar yok, bkz. `docs/TECH_STACK.md` `_TBD_` satırları |

---

## 9. Veritabanı şeması — özet (`backend/prisma/schema.prisma`)

| Model | Ait olduğu dilim | Not |
|-------|------|-----|
| `User`, `Session`, `Account`, `Verification` | 001-auth-rol | Better Auth çekirdek tabloları, `@@map` ile küçük harf tablo adı; `User.role` = "user"\|"admin"; `User.kvkkConsentAt` = KVKK onay damgası (null → popup gösterilir, FR-020); `Verification` 006-sifre-sifirlama sıfırlama token'larını da taşır |
| `Interview`, `Question`, `Answer`, `Report` | 002-interview | PascalCase tablo adı (`@@map` yok); soft-delete `deletedAt` alanı (004-history bunu kullanır) |
| `TokenUsage` | Cross-cutting (şema sahibi: 003-pre-assessment) | Her LLM çağrısında provider/model/token/maliyet kaydı — 005-admin'in istatistik ekranı bunu okuyacak |
| `PreAssessment`, `CompetencyReport` | 003-pre-assessment | Meslek-bağımsız girdi enum'ları; `experienceLevel` türetilmiş alan (002-interview FR-021 bunu okur) |

Cross-cutting enum'lar (`LlmOperation`, `ReportLanguage`, `ExperienceLevel`)
şema sahibi 003-pre-assessment olsa da uygulama sırası nedeniyle önce
oluşturuldu — 003 bunları **devralır**, yeniden tanımlamaz.

> **Not (bkz. önceki konuşma):** Bu şema **local Docker Postgres**'e uygulanıyor;
> her geliştiricinin verisi kendi makinesinde izole. Admin'in tüm kullanıcıları
> görebilmesi için paylaşımlı bir ortam (managed Postgres + deploy) gerekiyor —
> bu henüz `_TBD_` (DevOps/Deployment).

---

## 10. Ortam değişkenleri ve config dosyaları

| Dosya | Rol |
|-------|-----|
| `.env.example` (kökte) | Örnek değerler, commit'lenir |
| `backend/.env` (git'e girmez) | Gerçek local değerler — `cp .env.example backend/.env` |
| `frontend/.env.example` / `frontend/.env` | `VITE_API_URL` (mutlak URL mi proxy mi) + `VITE_GOOGLE_CLIENT_ID` (One Tap; kök `GOOGLE_CLIENT_ID` ile aynı olmalı) |
| `backend/src/config/env.validation.ts` | Zod ile zorunlu alan kontrolü — eksikse backend başlamaz |
| `docker-compose.yml` | Local `auth-postgres` container (Postgres 16, port 5432, `mock_interview` DB) |

---

## 11. Genel durum özeti (2026-08-10)

- ✅ **Tamamlanan:** altı çekirdek dilim — 001-auth-rol, 002-interview,
  003-pre-assessment, 004-history, 005-admin, 006-sifre-sifirlama; ayrıca
  **008-onay-akisi** (onay kapısı, Approved) ve **007-ui-design** (iniş sayfası +
  auth UI + responsive, PR #80) uygulandı
- ✅ **Sonradan eklenen özellikler (docs'a bu turda işlendi):** açık/koyu **tema**
  (`lib/theme/`, Ayarlar), **hesap silme** (`DELETE /api/users/me` + `settings/`
  bileşeni), sözlü mod **speech** ileri katmanı (`lib/speech/*`), görüşme
  **rapor retry** ve **panel-events** uçları
- 🟡 **Kasıtlı açık kalanlar:** `001` T068 (auth formlarının shadcn'e geçişi —
  UI tasarımı beklendiği için ertelendi), `001` T081/T081b (Better Auth `admin`
  plugin entegrasyonu + ban zorlaması — ayrı oturuma bırakıldı), `004` 7 madde
  (Playwright e2e senaryoları + SC-001 süre ölçümü — gerçek tarayıcı gerektirir).
  `003`'te açık görünen 33 satırın çoğu Faz 11/12 pivotunun geride bıraktığı
  bayat görev metinleridir — bkz. o dosyanın Faz 12 notu
- 📋 **Spec'i olmayan implementasyon:** yok — KVKK onay akışı 2026-08-05'te
  geriye dönük olarak `001-auth-rol` spec'ine bağlandı (FR-020, Faz 12)
- ⚠️ **Açık altyapı kararı:** Paylaşımlı/deploy ortamı yok — local geliştirme
  her geliştiricide izole DB ile ilerliyor; admin'in tüm kullanıcıları görmesi
  ancak tek bir paylaşımlı Postgres + deploy edilmiş backend ile mümkün olur
  (`docs/TECH_STACK.md` DevOps/Deployment satırı `_TBD_`).

---

## 12. Bu dosyayı nasıl güncel tutarım?

- Yeni bir ADR eklendiğinde → §8 tablosuna satır ekle.
- Yeni bir dilim (`specs/00N-...`) açıldığında → §6 tablosuna satır ekle.
- `tasks.md` ilerlemesi önemli ölçüde değiştiğinde → §6 ve §11'i güncelle.
- Yeni bir backend/frontend klasörü eklendiğinde → §4/§5 ağacına ekle.
- Bu dosya **`docs/DECISIONS.md` ve `docs/TECH_STACK.md`'nin yerine geçmez** —
  onların özetidir; çelişki olursa o kaynaklar geçerlidir.
