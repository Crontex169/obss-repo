# Uygulama Planı: Admin Paneli (Görüşme İzleme & İstatistikler)

**Dal (Branch)**: `005-admin` | **Tarih**: 2026-08-03 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/005-admin/spec.md` özellik spesifikasyonu

**Not**: Bu plan `speckit.plan` iş akışıyla üretilmiştir. Teknoloji yığını ADR-0001…0011
(bkz. `docs/DECISIONS.md`, `docs/TECH_STACK.md`) ile kilitlenmiştir ve burada yeniden
tartışılmaz; bu dilim **yeni bir ADR açmaz**. Bu dilim, `001-auth-rol` (rol/guard),
`002-interview` (Interview/Question/Answer/Report veri modeli ve `GET /api/interviews`
sözleşmesi) ve `003-pre-assessment`'in tasarladığı `TokenUsage` tablosuna **bağımlıdır**;
hiçbirinin **spec/data-model/contract** dosyalarını değiştirmez (şema/sözleşme sahipliği
onlarda kalır).

## Özet

Bu dilim, Admin Dashboard'ın **görüşme izleme** (tüm kullanıcıların görüşmelerini meslek
filtresiyle listeleme + tam detay görüntüleme, silinmiş kayıtlar dahil) ve **istatistik**
(meslek bazlı sayı, ortalama süre, tamamlanma oranı, günlük token zaman serisi)
ekranlarını kapsar. Admin panel **tamamen salt-okunurdur** (FR-008); hiçbir yazma/
güncelleme/silme uç noktası açılmaz.

**Teknik yaklaşım**: Backend'de yeni, bağımsız bir `AdminModule` eklenir
(`backend/src/admin/`); bu modül `002-interview`'in `InterviewModule`'üne **dokunmaz**,
yalnızca `PrismaService` üzerinden `Interview`/`Question`/`Answer`/`Report`/`TokenUsage`/
`User` tablolarını **salt-okunur** sorgular (doğrudan Prisma sorguları — read-only servis
katmanı, yazma metodu yok). Mevcut `GET /api/interviews` (`002-interview`) admin rolü için
zaten tüm kayıtları + `deletedAt` döndürüyor, ama meslek filtresi/sayfalama/istatistik
parametrelerini **kasıtlı olarak dışarıda bırakmıştı** (`interview-api.md` §2: *"Silme uç
noktası ve meslek filtresi parametreleri kapsam dışıdır"*) — tam da bu dilimin
sorumluluğu. Bu yüzden bu dilim o uç noktayı **genişletmez**, kendi ayrı `/api/admin/*`
uç noktalarını (liste, detay, istatistik) ekler; böylece `002-interview`'in kullanıcıya
dönük sözleşmesi hiç değişmez ve iki farklı tüketici (kullanıcı/admin) birbirine karışmaz.

Mevcut `backend/src/auth/admin/admin.controller.ts` (`GET /api/admin/ping`) — `001-auth-rol`
kapsamında guard zincirini kanıtlayan bir yer tutucu uç nokta olarak **korunur,
değiştirilmez**; bu dilim aynı `/api/admin` ön ekini paylaşan **ayrı** bir controller/modül
ekler (Nest'te birden fazla controller aynı prefiksi paylaşabilir).

Frontend'de yeni bir sayfa ağacı açılır: `frontend/src/pages/admin/` altına
`dashboard.tsx` (görüşme listesi + meslek filtresi), `interview-detail.tsx` ve
`stats.tsx` eklenir; kilitli UI kararlarına uyar (aynı layout, beyaz + açık mavi vurgu,
üst navbar — `docs/APP_FLOW.md` §5/§6). Grafikler için ek bağımlılık **gerekmez**
(Recharts zaten kilitli, ADR-0011).

**Kapsam dışı (bilinçli)**: Görüşme oluşturma/soru-cevap/rapor üretimi (`002-interview`),
soft-delete yazma uç noktası (`004-history`), pre-assessment (`003-pre-assessment`),
kullanıcı hesap yönetimi (askıya alma/silme/rol değiştirme — spec Assumptions).

## Teknik Bağlam

**Dil/Sürüm**: TypeScript 5.7.x (Node.js, NestJS 11 backend); React 19 (frontend) —
mevcut proje yığınıyla aynı, yeni bir dil/sürüm kararı yok.

**Birincil Bağımlılıklar**:
- Backend: NestJS, Prisma 6.19.3 (salt-okunur `findMany`/`groupBy`/`aggregate`
  sorguları) — yeni npm bağımlılığı **yok**. Girdi doğrulama (query param'lar: meslek
  filtresi, sayfa/limit) Zod ile (`backend/src/common/zod-validation.pipe.ts`, mevcut
  desen).
- `001-auth-rol`'den `SessionGuard`, `RolesGuard`, `@Roles('admin')` — **yeniden
  kullanılır**, yeni bir guard yazılmaz (admin okuma erişimi zaten `OwnershipGuard`'a
  ihtiyaç duymaz — `authz-rules.md` R3, sahiplik kontrolü admin için baypas edilir).
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui (`Table`, `Badge`, `Select`
  [meslek filtresi], `Card`, `Chart` bileşenleri) — kilitli bileşen kütüphanesi; yeni
  bir veri getirme kütüphanesi (React Query/SWR) **eklenmez** (`004-history/research.md`
  §4 ile tutarlı, proje genelinde `fetch` sarmalayıcı deseni sürdürülür).
- Recharts (zaten kilitli, ADR-0011) — `BarChart` (meslek bazlı sayı), `PieChart`
  (tamamlanma oranı), `LineChart` (günlük token zaman serisi).

**Depolama**: PostgreSQL 16 — **aynı** veritabanı, **aynı** şema; bu dilim **hiçbir yeni
tablo, alan veya migration açmaz** (bkz. data-model.md "Bu dilim şema sahibi DEĞİLDİR").
Tüm sorgular mevcut `Interview`, `Question`, `Answer`, `Report`, `TokenUsage`, `User`
tabloları üzerinde salt-okunur `SELECT`/`GROUP BY` işlemleridir.

**Test**: Jest + Supertest (backend — yeni `/api/admin/interviews`, `/api/admin/interviews/:id`,
`/api/admin/stats` uç noktaları için entegrasyon testleri: rol/oturum reddi, meslek
filtresi doğruluğu, silinmiş kayıt görünürlüğü, istatistik hesap doğruluğu, salt-okunurluk
— yazma denemesi `403`), Vitest + React Testing Library (liste/detay/istatistik bileşen
testleri), Playwright (US1-US3 uçtan uca akışları, bkz. quickstart.md). Bu dilim yeni bir
LLM çağrısı **yapmaz**; hiçbir LLM'e bağlı test gerekmez.

**Hedef Platform**: Modern web tarayıcıları (SPA); backend Linux sunucu/container —
diğer dilimlerle aynı.

**Proje Türü**: Web uygulaması (mevcut `backend/` + `frontend/`, aynı proje köküne
eklenen yeni bir dikey dilim). Backend'de **yeni, bağımsız bir modül** (`AdminModule`);
mevcut `InterviewModule`'e **hiçbir değişiklik yapılmaz**.

**Performans Hedefleri**: Görüşme detayına erişim < 3 sn (SC-001); liste/istatistik
sayfaları standart SPA beklentileri içinde (< 2 sn) yüklenir. Bu dilim LLM'e bağımlı
değildir (yalnızca kayıtlı veriyi okur/toplar), performans riski düşüktür.

**Kısıtlar**:
- Tüm `/api/admin/*` uç noktaları `SessionGuard` → `RolesGuard('admin')` ile korunur;
  oturumsuz `401`, rolü yetersiz `403` (FR-001, `authz-rules.md` R1).
- Salt-okunurluk **sunucu tarafında** zorunludur: `AdminModule` hiçbir `POST`/`PATCH`/
  `PUT`/`DELETE` uç noktası **tanımlamaz**; böyle bir istek zaten route eşleşmediği için
  `404`/`405` alır — ayrıca istemci arayüzünde de yazma aksiyonu **hiç render edilmez**
  (FR-008, SC-005).
- Soft-delete edilmiş (`deletedAt != null`) görüşmeler admin listesinden/istatistiklerinden
  **asla filtrelenmez** (FR-004, FR-009-012, Clarifications 2026-08-03 Q1).
- Kullanıcı kimliği admin görünümünde **e-posta** (`User.email`) ile gösterilir
  (Clarifications Q2) — ekstra bir PII maskeleme katmanı bu MVP'de yok.
- Token zaman serisi **günlük granülaritede, varsayılan son 30 gün** (Clarifications Q3);
  liste sayfalama **varsayılan 20 kayıt/sayfa** (Clarifications Q4).
- İç hata detayı (sağlayıcı yanıtı, stack trace, SQL) hiçbir yanıtta sızdırılmaz
  (`docs/API_CONVENTIONS.md` §2, FR-006).

**Ölçek/Kapsam**: Staj/vaka çalışması ölçeği. 3 kullanıcı hikâyesi (tümü MVP), 15
fonksiyonel gereksinim, backend tarafında **1 yeni modül + 3 yeni uç nokta**, frontend
tarafında 3 yeni sayfa (liste, detay, istatistik).

## Anayasa Kontrolü (Constitution Check)

*KAPI: Phase 0 araştırmasından önce geçilmeli; Phase 1 tasarımdan sonra yeniden kontrol edilir.*

Anayasa `v1.0.0` ilkelerine göre değerlendirme:

| İlke | Durum | Bu dilimde nasıl karşılanıyor |
|------|-------|-------------------------------|
| **I. AI-Native & Devlog** | ✅ Uyumlu | Oturum sonunda `AI-DEVLOG.md` güncellenecek (bu oturumun ve sonraki tasks/implement fazlarının çıktısı). |
| **II. Spec-Öncelikli** | ✅ Uyumlu | `spec.md` mevcut, clarify oturumuyla netleştirildi, kalite kontrol listesi (`checklists/requirements.md`) tüm maddelerde geçti; Türkçe Gherkin kabul kriterleri (3 hikâye) mutlu yol + edge + error kapsıyor. |
| **III. Test-Öncelikli / ATDD** | ✅ Uyumlu (kapı: tasks) | Kabul kriterleri quickstart.md senaryolarına eşlenecek; yeni `/api/admin/*` uç noktaları ve admin görünürlüğü kritik akış, test kapsamı olmadan merge edilmez. |
| **IV. Dikey Dilim & Düzen** | ✅ Uyumlu | Tek dikey değer (admin izleme + istatistik) uçtan uca (UI → yeni `AdminModule` → Postgres); mevcut guard'lar ve veri modeli **yeniden yazılmadan** kullanılır. Kökteki teslim dosyaları (`SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md`) zorunlu, dokunulmaz. |
| **V. Güvenlik & Injection Savunması** | ✅ Uyumlu | Rol kontrolü **sunucu tarafında** (`SessionGuard`+`RolesGuard`, FR-001); bu dilim LLM'e hiç kullanıcı verisi göndermez ve hiçbir yazma uç noktası açmaz — prompt injection ve veri bütünlüğü yüzeyi **genişletilmez**, yalnızca **daralır** (salt-okunur). |
| **VI. LLM Sözleşmesi & Gözlemlenebilirlik** | ✅ Uyumlu | Bu dilim yeni bir LLM çağrısı **yapmaz**; mevcut `TokenUsage` kayıtlarını admin'e görünür kılar (İlke VI'nın açıkça istediği "token/maliyet admin panelinde görünür" gereksinimini **tamamlar**). Soft-delete admin görünürlüğü (İlke VI'nın diğer maddesi) bu dilimde **tam olarak uygulanır** (FR-004). |
| **VII. Kararların Gerekçelendirilmesi & UX** | ✅ Uyumlu | Yeni teknoloji kararı **yok** (Recharts/Prisma/NestJS zaten kilitli). Clarify oturumunda alınan 4 uygulama-yaklaşımı kararı (istatistiklere silinmiş dahil, e-posta gösterimi, granülarite, sayfa boyutu) spec'te gerekçeleriyle belgelendi. UX: rapor/token eksikliğinde zarif "veri yok" durumu (FR-006, FR-007, FR-013), sessiz başarısızlık yok. |

**Karmaşıklık kapıları**: İlave karmaşıklık yok. Yeni tablo/migration açılmıyor; yeni
modül (`AdminModule`) tek amaçlı ve küçük (3 salt-okunur uç nokta, mevcut guard'ları
yeniden kullanıyor); yeni frontend veri getirme kütüphanesi eklenmiyor. **Sonuç: GEÇTİ
(PASS)** — gerekçesiz ihlal yok.

**Post-Design yeniden değerlendirme (Phase 1 sonrası)**: Tasarım çıktıları
(`data-model.md`, `contracts/admin-api.md`, `quickstart.md`) `001-auth-rol`,
`002-interview`, `003-pre-assessment`'in şemasını/sözleşmelerini **değiştirmeden**
referans verdi; üç yeni uç nokta `API_CONVENTIONS.md` §1/§2 ile tam uyumlu tasarlandı.
Anayasa kontrolü **hâlâ GEÇİYOR**.

## Proje Yapısı

### Dokümantasyon (bu özellik)

```text
specs/005-admin/
├── plan.md              # Bu dosya (speckit.plan çıktısı)
├── research.md          # Phase 0 çıktısı
├── data-model.md         # Phase 1 çıktısı (şema sahibi DEĞİL — 001/002/003'ü tüketir)
├── quickstart.md        # Phase 1 çıktısı
├── contracts/           # Phase 1 çıktısı
│   └── admin-api.md     # YENİ 3 uç nokta (liste/detay/istatistik)
├── checklists/
│   └── requirements.md  # (mevcut)
└── tasks.md             # Phase 2 çıktısı (speckit.tasks — henüz üretilmedi)
```

### Kaynak Kod (repo kökü)

Web uygulaması yapısı (`backend/` + `frontend/` — diğer dilimlerle **aynı** proje
köküne eklenen dikey dilim). Backend'de **yeni, bağımsız bir modül**; mevcut
`InterviewModule`'e **hiçbir dosya değişikliği yok**.

```text
backend/
├── src/
│   ├── auth/
│   │   ├── guards/session.guard.ts       # (mevcut — yeniden kullanılır, değişmez)
│   │   ├── guards/roles.guard.ts         # (mevcut — yeniden kullanılır, değişmez)
│   │   ├── decorators/roles.decorator.ts # (mevcut — yeniden kullanılır, değişmez)
│   │   └── admin/admin.controller.ts     # (mevcut — DEĞİŞMEZ, `GET /api/admin/ping` yer tutucusu korunur)
│   ├── interview/                        # (002-interview — DEĞİŞMEZ, bu dilim yalnızca okur)
│   └── admin/                            # (+) YENİ modül — bu dilimin sorumluluğu
│       ├── admin.module.ts               # (+) SessionGuard/RolesGuard içe aktarır, PrismaModule'e bağımlı
│       ├── admin-interviews.controller.ts # (+) GET /api/admin/interviews, GET /api/admin/interviews/:id
│       ├── admin-stats.controller.ts     # (+) GET /api/admin/stats
│       ├── admin.service.ts              # (+) salt-okunur Prisma sorguları (liste, detay, istatistik toplamaları)
│       └── dto/
│           ├── list-interviews-query.dto.ts  # (+) Zod: position?, page?, pageSize? (varsayılan 20)
│           └── stats-query.dto.ts            # (+) Zod: tokenWindowDays? (varsayılan 30)
└── test/
    └── integration/
        └── admin.spec.ts                 # (+) rol/oturum reddi, meslek filtresi, silinmiş görünürlük, istatistik doğruluğu, salt-okunurluk

frontend/
├── src/
│   ├── pages/
│   │   └── admin/
│   │       ├── login.tsx                # (mevcut — 001-auth-rol, değişmez)
│   │       ├── dashboard.tsx            # (+) YENİ — görüşme listesi + meslek filtresi (US1)
│   │       ├── interview-detail.tsx     # (+) YENİ — soru/cevap/rapor/token detayı (US2)
│   │       └── stats.tsx                # (+) YENİ — istatistik ekranı (US3)
│   ├── components/
│   │   └── admin/
│   │       ├── interview-table.tsx      # (+) YENİ — shadcn/ui Table, "silindi" rozeti
│   │       ├── profession-filter.tsx    # (+) YENİ — meslek/pozisyon Select (+ "Belirsiz" kovası)
│   │       ├── token-cost-panel.tsx     # (+) YENİ — detay ekranında token/maliyet özeti
│   │       ├── profession-bar-chart.tsx # (+) YENİ — Recharts BarChart
│   │       ├── completion-pie-chart.tsx # (+) YENİ — Recharts PieChart
│   │       └── token-line-chart.tsx     # (+) YENİ — Recharts LineChart (günlük, 30 gün)
│   ├── lib/
│   │   └── admin-client.ts              # (+) YENİ — listInterviews, getInterview, getStats fetch sarmalayıcıları
│   └── routes/                          # (~) admin dashboard/detail/stats rotaları eklenir (mevcut router dosyasına ekleme)
└── test/
    ├── admin-dashboard.test.tsx         # (+)
    ├── admin-interview-detail.test.tsx  # (+)
    └── admin-stats.test.tsx             # (+)
```

`(~)` = mevcut dosyaya ek/değişiklik, `(+)` = yeni dosya.

**Yapı Kararı**: Mevcut web uygulaması yapısı (`backend/` + `frontend/`) korunur. Backend'de
`002-interview`'in `InterviewModule`'üne dokunmadan, **yeni ve bağımsız** bir `AdminModule`
eklenir; bu, iki farklı tüketici (kullanıcı vs. admin) için tek bir controller'ı büyütüp
karmaşıklaştırmak yerine net bir sorumluluk ayrımı sağlar ve `002-interview`'in kilitli
sözleşmesini (`interview-api.md`) hiç değiştirmeden bırakır. Frontend'de mevcut
`frontend/src/pages/admin/login.tsx` (`001-auth-rol`) yanına üç yeni sayfa eklenir; bu,
`docs/APP_FLOW.md` #10/#11/#12 ekran listesindeki üç admin ekranıyla birebir eşleşir.

## Karmaşıklık Takibi

> Anayasa kontrolünde gerekçelendirilmesi gereken ihlal bulunmadığından bu tablo boştur.

İhlal yok — yeni tablo/migration açılmadı; yeni modül tek amaçlı ve küçük (3 salt-okunur
uç nokta, mevcut guard'ları yeniden kullanıyor); yeni frontend veri getirme kütüphanesi
eklenmedi; yeni ADR gerektiren bir teknoloji kararı yok (Recharts/Prisma zaten kilitli).

## Phase 0: Araştırma

Ayrıntılar için bkz. [research.md](./research.md). Çözülen uygulama-yaklaşımı kararları:
admin uç noktalarının `002-interview`'den **ayrı** bir modülde toplanması gerekçesi,
istatistik sorgularının Prisma `groupBy`/`aggregate` ile mi yoksa ham SQL ile mi
yapılacağı, meslek/pozisyon "Belirsiz" kovası normalizasyonu, günlük token zaman serisi
sorgu yaklaşımı, sayfalama parametresi tasarımı.

`[NEEDS CLARIFICATION]` kalmadı; hiçbir nokta kilitli ADR'lerle çelişmiyor
(4 belirsizlik `/speckit-clarify` oturumunda çözüldü — bkz. spec.md `## Clarifications`).

## Phase 1: Tasarım & Sözleşmeler

- **Veri modeli**: [data-model.md](./data-model.md) — bu dilimin **şema sahibi
  olmadığını** açıkça belgeler; `User`, `Interview`, `Question`, `Answer`, `Report`,
  `TokenUsage` alanlarının bu dilim için kullanımını izlenebilir kılar. Bu dilimin
  eklediği **tek** yeni şey, aggregation için kullanılan salt-okunur DTO/view tipleridir
  (yeni Prisma modeli değil).
- **Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) —
  hata zarfı, `403` (rol) / `401` (oturum) kuralları, soft-delete admin görünürlüğü (§4.3).
  Bu dilimin sözleşmesi bunu **yeniden tanımlamaz**.
- **Sözleşmeler**: [contracts/admin-api.md](./contracts/admin-api.md) — 3 **yeni**
  uç noktayı (`GET /api/admin/interviews`, `GET /api/admin/interviews/:id`,
  `GET /api/admin/stats`) tanımlar; `002-interview/contracts/interview-api.md`'yi
  referans verir, değiştirmez.
- **Doğrulama kılavuzu**: [quickstart.md](./quickstart.md) — kurulum + kabul
  senaryolarının (US1-US3) uçtan uca doğrulanması ve başarı kriteri eşlemesi.

## Tamamlanma Raporu

Bu komut Phase 1 tasarımından sonra sonlanır. Üretilen çıktılar Tamamlanma bölümünde özetlenir.
