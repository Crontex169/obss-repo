---

description: "Admin Paneli (Görüşme İzleme & İstatistikler) dikey dilimi için görev listesi"
---

# Görevler: Admin Paneli (Görüşme İzleme & İstatistikler)

**Girdi**: `specs/005-admin/` tasarım dokümanları

**Ön Koşullar**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/admin-api.md ✅, quickstart.md ✅

**Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) — hata zarfı (§2), `401`/`403` kuralı (§1), soft-delete admin görünürlüğü (§4.3).

**Testler**: **ZORUNLU** — Anayasa İlke III (Test-Öncelikli/ATDD, PAZARLIK EDİLEMEZ). Her hikâye için kabul testleri, üretim kodundan **önce** yazılır (Kırmızı → Yeşil → Refactor).

**Organizasyon**: Görevler kullanıcı hikâyesine göre gruplanmıştır (bkz. `spec.md`).

---

## ⚠️ Bu dilim şema/sözleşme sahibi DEĞİLDİR — koordinasyon uyarısı

- `specs/001-auth-rol/**`, `specs/002-interview/**`, `specs/003-pre-assessment/**` altındaki
  **hiçbir spec/data-model/contract dosyası değiştirilmez** — yalnızca referans için okunur.
- `backend/src/interview/**` (002-interview'in `InterviewModule`'ü) ve
  `backend/src/auth/**` (001-auth-rol) içindeki **hiçbir dosyaya dokunulmaz**; bu dilim
  yalnızca **yeni, bağımsız** bir modül (`backend/src/admin/`) ekler ve mevcut
  `SessionGuard`/`RolesGuard`'ı **değiştirmeden** içe aktarıp yeniden kullanır.
- Mevcut `backend/src/auth/admin/admin.controller.ts` (`GET /api/admin/ping`, `001-auth-rol`
  yer tutucusu) **değiştirilmez**; bu dilim aynı `/api/admin` ön ekini paylaşan **ayrı**
  controller'lar ekler (Nest'te birden fazla controller aynı prefiksi paylaşabilir).
- `frontend/src/pages/admin/login.tsx` (001-auth-rol) **değiştirilmez**; bu dilim aynı
  `frontend/src/pages/admin/` klasörüne **yeni** sayfalar ekler.
- `002-interview`'in `GET /api/interviews` uç noktası **genişletilmez** (meslek filtresi/
  sayfalama parametreleri eklenmez) — bu dilim kendi ayrı `/api/admin/*` uç noktalarını
  kurar (plan.md, research.md §1 kararı).

## 📥 Bu dilim cross-cutting altyapıyı DEVRALIR (yeniden kurmaz)

| Devralınan | Kaynak dosya | Bu dilimde ne yapılır |
|-----------|--------------------------------------|------------------------|
| `SessionGuard` | `backend/src/auth/guards/session.guard.ts` (001-auth-rol) | Değiştirilmez, `AdminModule`'ün her uç noktasında yeniden kullanılır |
| `RolesGuard` + `@Roles('admin')` | `backend/src/auth/guards/roles.guard.ts`, `backend/src/auth/decorators/roles.decorator.ts` (001-auth-rol) | Değiştirilmez, yeniden kullanılır (FR-001) |
| `Interview`/`Question`/`Answer`/`Report`/`TokenUsage`/`User` Prisma modelleri | `backend/prisma/schema.prisma` (001/002/003) | Yeni migration **yok**; yalnızca salt-okunur sorgu (`AdminService`) |
| Ortak hata zarfı filtresi | `backend/src/common/http-exception.filter.ts` | Değiştirilmez (`API_CONVENTIONS.md` §2) |
| `AppShell` (kullanıcı navbar'ı) | `frontend/src/components/app-shell.tsx` (002-interview) | Değiştirilmez; admin için **ayrı** `AdminShell` bileşeni eklenir (farklı nav öğeleri + açık mavi vurgu, `docs/APP_FLOW.md` §5/§6) |
| `ProtectedRoute` (oturum kontrolü) | `frontend/src/routes/protected.tsx` (001-auth-rol) | Değiştirilmez; admin rotaları için **ayrı** `AdminProtectedRoute` eklenir (rol kontrolü de ekler) |
| Backend test yardımcıları (`create-test-interview.ts`, `complete-interview.ts`, `auth-session.ts`, `interview-app.ts`) | `backend/test/integration/helpers/` (002-interview) | **Yeniden kullanılır**; `createInterviewTestApp()` zaten `AppModule`'ü import ettiği için `AdminModule` kaydedilince otomatik dahil olur |
| Recharts (ADR-0011) | `frontend/package.json` (kilitli bağımlılık) | `BarChart`/`PieChart`/`LineChart` istatistik ekranında kullanılır, yeni bağımlılık **yok** |
| Zod DTO doğrulama deseni | `backend/src/common/zod-validation.pipe.ts` (mevcut desen) | Admin query parametreleri (meslek filtresi, sayfalama, `tokenWindowDays`) için aynı desen kullanılır |

**Bu dilime ÖZGÜ olan (gerçekten yeni)**: `backend/src/admin/**` (tüm modül), 3 yeni
uç nokta, `frontend/src/pages/admin/dashboard.tsx`, `interview-detail.tsx`, `stats.tsx`,
`frontend/src/components/admin/**`, `frontend/src/lib/admin-client.ts`.

---

## Biçim: `[ID] [P?] [Hikâye] Açıklama`

- **[P]**: Paralel çalıştırılabilir (farklı dosyalar, tamamlanmamış göreve bağımlılık yok)
- **[Hikâye]**: US1…US3 → spec.md Hikâye 1…3
- Açıklamalarda kesin dosya yolları belirtilir

## Yol Kuralları (plan.md — Web uygulaması yapısı)

- Backend: `backend/src/admin/` (YENİ modül), `backend/src/admin/dto/`,
  `backend/test/integration/`, `backend/test/integration/helpers/` (mevcut yardımcılar)
- Frontend: `frontend/src/pages/admin/`, `frontend/src/components/admin/`,
  `frontend/src/lib/admin-client.ts`, `frontend/src/routes/`
- Frontend testleri: `frontend/test/*.test.tsx` (düz yapı, mevcut proje konvansiyonu)
- E2e: `frontend/test/e2e/*.spec.ts` (Playwright, mevcut konvansiyon)

## Kilitli Teknoloji Yığını (ADR-0001…0011, `docs/TECH_STACK.md`)

NestJS + PostgreSQL 16 + Prisma (backend, **yeni** `AdminModule`); React 19 + Vite +
Tailwind 4 + shadcn/ui (frontend); Recharts (ADR-0011, meslek/tamamlanma/token grafikleri).
Testler: Jest + Supertest (backend), Vitest + RTL (frontend bileşenleri), Playwright (e2e).

**Bu dilimin eklediği yeni backend bağımlılığı: 0.** **Yeni frontend bağımlılığı: 0**
(Recharts zaten kilitli, veri getirme mevcut `fetch` sarmalayıcı deseniyle yapılır).

## Kullanıcı Hikâyesi ↔ Faz Eşlemesi (öncelik sırasıyla)

| Faz | Hikâye | Başlık | Öncelik |
|-----|--------|--------|---------|
| 3 | US1 | Tüm görüşmeleri meslek bazında listeleme | P1 🎯 MVP |
| 4 | US2 | Görüşme detayını inceleme | P2 |
| 5 | US3 | Genel istatistikleri görüntüleme | P3 |

> **Sıralama gerekçesi**: `spec.md` önceliklendirmesiyle birebir. US1 (liste) temel
> gözetim değeri sağladığından MVP; US2 (detay) listeye bağımlı bir sonraki adım;
> US3 (istatistik) diğer ikisinin ürettiği veriye dayanan özet görünüm olduğundan son.

---

## Faz 1: Kurulum

**Amaç**: `AdminModule`'ün iskeletini kurmak ve frontend rota/sayfa yer tutucularını
oluşturmak. Henüz iş mantığı **yazılmaz**.

- [X] T001 `backend/src/admin/admin.module.ts` dosyasını oluştur (boş `AdminModule`,
  `PrismaModule` import eder) ve `backend/src/app.module.ts`'e `imports` listesine ekle
  (`InterviewModule`'den sonra) — `002-interview`'in kendi dosyalarına **dokunulmadan**
  yalnızca tek bir import satırı eklenir.
- [X] T002 [P] Zod query DTO'larını oluştur: `backend/src/admin/dto/list-interviews-query.dto.ts`
  (`position?: string`, `page?: number ≥ 1` varsayılan 1, `pageSize?: number` 1-100
  varsayılan 20 — Clarifications Q4) ve `backend/src/admin/dto/stats-query.dto.ts`
  (`tokenWindowDays?: number` 1-90 varsayılan 30 — Clarifications Q3); mevcut
  `backend/src/common/zod-validation.pipe.ts` deseniyle kullanılabilir şekilde.
- [X] T003 [P] Frontend admin sayfa yer tutucularını oluştur: `frontend/src/pages/admin/dashboard.tsx`,
  `frontend/src/pages/admin/interview-detail.tsx`, `frontend/src/pages/admin/stats.tsx`
  (yalnızca iskelet bileşen, `<div>TODO</div>`) ve `frontend/src/App.tsx`'e rotaları ekle:
  `/admin/dashboard`, `/admin/interview/:id`, `/admin/stats` (henüz korumasız).

**Checkpoint**: Modül iskeleti ve boş sayfalar hazır; Faz 2'ye geçilebilir.

---

## Faz 2: Foundational (Tüm Hikâyeler İçin Ortak Altyapı)

**Amaç**: US1, US2, US3'ün tümünün paylaştığı ortak altyapı. **⚠️ KRİTİK**: Hiçbir
kullanıcı hikâyesi bu faz tamamlanmadan başlayamaz.

- [X] T004 `AdminService` iskeletini oluştur: `PrismaService` enjekte eden, henüz metodu
  olmayan sınıf + paylaşılan `resolvePositionLabel(position: string | null): string`
  yardımcı fonksiyonu (`null` → `"Belirsiz"`, research.md §3) — `backend/src/admin/admin.service.ts`.
- [X] T005 Paylaşılan yanıt/DTO tiplerini tanımla (`AdminInterviewListItem`,
  `AdminInterviewDetail`, `AdminStatsResponse` — `contracts/admin-api.md` ile birebir) —
  `backend/src/admin/dto/admin-response.types.ts` (T002'ye bağlı).
- [X] T006 [P] `frontend/src/lib/admin-client.ts` oluştur: `listInterviews(params)`,
  `getInterview(id)`, `getStats(params)` fetch sarmalayıcıları + TypeScript tipleri
  (`admin-api.md` yanıt şemasıyla birebir) — mevcut `interview-client.ts` deseniyle tutarlı.
- [X] T007 [P] `AdminProtectedRoute` bileşenini oluştur: `frontend/src/routes/protected.tsx`'teki
  `ProtectedRoute`'u **değiştirmeden**, oturum + `role==='admin'` kontrolü yapan ayrı bir
  sarmalayıcı — `frontend/src/routes/admin-protected.tsx` (istemci tarafı UX katmanı;
  gerçek yetki sunucuda `RolesGuard`, İlke V).
- [X] T008 [P] `AdminShell` bileşenini oluştur: `frontend/src/components/app-shell.tsx`'i
  **değiştirmeden**, admin'e özgü nav öğeleriyle (Kullanıcılar/Görüşmeler | İstatistikler)
  ve açık mavi vurgu temasıyla (`docs/APP_FLOW.md` §5/§6) ayrı bir kabuk —
  `frontend/src/components/admin/admin-shell.tsx`.
- [X] T009 [P] Backend test yardımcı fonksiyonunu ekle: birden fazla kullanıcı, farklı
  meslek/`null` pozisyon, tamamlanmış/yarım kalmış/silinmiş görüşme ve farklı günlerde
  `TokenUsage` kaydı üreten senaryo kurucu — mevcut `create-test-interview.ts` +
  `complete-interview.ts` yardımcılarını **kullanır** (yeniden yazmaz), yalnızca
  çoklu-kullanıcı/çoklu-gün senaryosunu birleştiren ince bir sarmalayıcı ekler —
  `backend/test/integration/helpers/admin-scenario.ts`.

**Checkpoint**: Ortak servis iskeleti, istemci fonksiyonları, route guard, admin kabuğu
ve test senaryosu kurucusu hazır — kullanıcı hikâyeleri paralel başlayabilir.

---

## Faz 3: User Story 1 - Tüm görüşmeleri meslek bazında listeleme (Priority: P1) 🎯 MVP

**Hedef**: Admin, tüm kullanıcılara ait tüm görüşmeleri (silinmiş dahil) tek bir listede
görür ve meslek/pozisyon alanına göre filtreleyebilir.

**Bağımsız Test Kriteri**: Farklı kullanıcılara ait, farklı mesleklerde ve farklı
durumlarda (tamamlandı/yarım/silinmiş) birkaç görüşme oluşturularak admin listesinin
doğru sayıda, doğru sırada ve doğru etiketlerle geldiği; meslek filtresi uygulandığında
yalnızca eşleşen kayıtların döndüğü doğrulanarak bağımsız test edilebilir (spec.md Hikâye 1).

### Testler için User Story 1 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T010 [P] [US1] Supertest: oturumsuz istek `401`, `role="user"` oturumu `403` alır,
  hiçbir veri sızmaz (FR-001, SC-004) — `backend/test/integration/us-admin1-list-auth.spec.ts`.
- [X] T011 [P] [US1] Supertest: tüm kullanıcılara ait tüm görüşmeler (silinmiş dahil,
  `deletedAt` alanı yanıtta) döner; meslek filtresi (`?position=...`) yalnızca eşleşenleri,
  `?position=unspecified` yalnızca `position=null` kayıtları döner (FR-002, FR-003, FR-004,
  SC-002, SC-003) — `backend/test/integration/us-admin1-list-filter.spec.ts`.
- [X] T012 [P] [US1] Supertest: sayfalama — `pageSize` verilmezse 20, `page`/`pageSize`
  aralık dışıysa `400`, yanıtta `total`/`page`/`pageSize` doğru (FR-014, Clarifications Q4)
  — `backend/test/integration/us-admin1-list-pagination.spec.ts`.
- [X] T013 [P] [US1] Vitest+RTL: `dashboard.tsx` listeyi tablo halinde render eder, her
  satırda e-posta/pozisyon/tarih/durum rozeti + "Silindi" rozeti (yalnızca `deletedAt`
  doluyken) gösterir, meslek filtresi seçildiğinde yalnızca eşleşenler görünür —
  `frontend/test/admin-dashboard.test.tsx`.
- [X] T014 [P] [US1] Playwright e2e: quickstart.md US1 senaryosu (giriş → liste → filtre →
  "Belirsiz" filtresi → yetkisiz erişim denemesi reddi) — `frontend/test/e2e/admin-dashboard.spec.ts`.

### Implementasyon for User Story 1

- [X] T015 [US1] `AdminService.listInterviews(query)` metodunu ekle: `position` filtresi
  (`"unspecified"` → `position: null`), sayfalama, `createdAt` DESC sıralama, soft-delete
  kayıtları **filtrelemeden** dahil eder, `User.email` join'i — `backend/src/admin/admin.service.ts`
  (T004, T005, T009'a bağlı).
- [X] T016 [US1] `AdminInterviewsController`'ı oluştur: `GET /api/admin/interviews`
  (`SessionGuard` → `RolesGuard('admin')`) — `backend/src/admin/admin-interviews.controller.ts`
  (T015, T002, T001'e bağlı).
- [X] T017 [P] [US1] `interview-table.tsx` bileşenini oluştur: shadcn/ui `Table`, durum
  rozeti, "Silindi" rozeti (`deletedAt` doluyken) — `frontend/src/components/admin/interview-table.tsx`.
- [X] T018 [P] [US1] `profession-filter.tsx` bileşenini oluştur: shadcn/ui `Select`,
  dinamik meslek listesi + sabit "Belirsiz" seçeneği (FR-003) — `frontend/src/components/admin/profession-filter.tsx`.
- [X] T019 [US1] `dashboard.tsx`'i tamamla: `listInterviews()` (T006) çağrısı, `interview-table.tsx`
  + `profession-filter.tsx` entegrasyonu, sayfalama kontrolleri, yükleniyor/hata/boş
  durumları, `AdminShell` (T008) ile sarmalama — `frontend/src/pages/admin/dashboard.tsx`
  (T006, T008, T017, T018'e bağlı).
- [X] T020 [US1] `/admin/dashboard` rotasını `AdminProtectedRoute` (T007) ile sarmala —
  `frontend/src/App.tsx`.

**Checkpoint**: User Story 1 bağımsız olarak tam işlevsel ve test edilebilir (MVP demo
edilebilir).

---

## Faz 4: User Story 2 - Görüşme detayını inceleme (Priority: P2)

**Hedef**: Admin, listeden seçtiği herhangi bir görüşmenin sorularını, cevaplarını,
raporunu ve token/maliyet bilgisini görüntüler; silinmiş olsa bile içerik eksiksiz görünür.

**Bağımsız Test Kriteri**: Sorusu/cevabı/raporu olan bir görüşme + rapor üretimi
başarısız/eksik olan ayrı bir görüşme hazırlanarak admin detay ekranının her iki durumda
da doğru içerik gösterdiği ve token/maliyet toplamının doğru hesaplandığı bağımsız
doğrulanabilir (spec.md Hikâye 2).

### Testler için User Story 2 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T021 [P] [US2] Supertest: tamamlanmış+raporlu bir görüşmenin detayı tüm soru/cevap
  çiftlerini, raporu (3 eksen skor + metin) ve token/maliyet toplamını döner; silinmiş
  bir görüşmede de içerik eksiksiz kalır (FR-004, FR-005, FR-007) —
  `backend/test/integration/us-admin2-detail.spec.ts`.
- [X] T022 [P] [US2] Supertest: `reportStatus` `pending`/`failed` iken rapor alanı `null`,
  iç hata metni/sağlayıcı yanıtı **sızmaz**; `TokenUsage` kaydı yoksa `tokenUsage: null`
  (FR-006, FR-007, `API_CONVENTIONS.md` §2) — `backend/test/integration/us-admin2-detail-report-states.spec.ts`.
- [X] T023 [P] [US2] Supertest: `/api/admin/interviews/:id` üzerinde `PATCH`/`PUT`/`DELETE`
  route'u **tanımlı değildir** → `404` (salt-okunurluk garantisi, FR-008, SC-005) —
  `backend/test/integration/us-admin2-readonly.spec.ts`.
- [X] T024 [P] [US2] Vitest+RTL: `interview-detail.tsx` soru/cevap listesi, rapor bölümü,
  `token-cost-panel.tsx`, "silindi" durumu ve eksik/başarısız rapor durumunu doğru render
  eder — `frontend/test/admin-interview-detail.test.tsx`.
- [X] T025 [P] [US2] Playwright e2e: quickstart.md US2 senaryosu (tam rapor, eksik/
  başarısız rapor, silinmiş kayıt, yazma denemesi reddi) — `frontend/test/e2e/admin-interview-detail.spec.ts`.

### Implementasyon for User Story 2

- [X] T026 [US2] `AdminService.getInterviewDetail(id)` metodunu ekle: soru/cevap/rapor
  (varsa) + `TokenUsage` `SUM` toplamı (kayıt yoksa `null`), gerçekten yoksa `null` döner
  (controller `404`'e çevirir) — `backend/src/admin/admin.service.ts` (T004, T005'e bağlı).
- [X] T027 [US2] `AdminInterviewsController`'a `GET /api/admin/interviews/:id` ekle —
  `backend/src/admin/admin-interviews.controller.ts` (T026, T016'ya bağlı).
- [X] T028 [P] [US2] `token-cost-panel.tsx` bileşenini oluştur: toplam token + tahmini
  maliyet, kayıt yoksa "maliyet bilgisi yok" (FR-007) — `frontend/src/components/admin/token-cost-panel.tsx`.
- [X] T029 [US2] `interview-detail.tsx`'i tamamla: `getInterview(id)` (T006) çağrısı,
  soru/cevap render, rapor bölümü (eksik/başarısız için zarif durum, FR-006),
  `token-cost-panel.tsx` entegrasyonu, `AdminShell` ile sarmalama —
  `frontend/src/pages/admin/interview-detail.tsx` (T006, T008, T028'e bağlı).
- [X] T030 [US2] `/admin/interview/:id` rotasını `AdminProtectedRoute` ile sarmala ve
  `dashboard.tsx`'teki tablo satırlarından bu sayfaya bağlantı ekle —
  `frontend/src/App.tsx`, `frontend/src/components/admin/interview-table.tsx`.

**Checkpoint**: User Story 1 VE 2 birlikte bağımsız çalışır durumda.

---

## Faz 5: User Story 3 - Genel istatistikleri görüntüleme (Priority: P3)

**Hedef**: Admin, meslek bazlı görüşme sayısı, ortalama görüşme süresi, tamamlanma/yarım
kalma oranı ve günlük token tüketimini (son 30 gün) tek bir ekranda görür.

**Bağımsız Test Kriteri**: Bilinen sayıda görüşme (farklı meslek, durum, süre ve token
tüketimiyle) hazırlanarak istatistik ekranının her metriğinin elle hesaplanan beklenen
değerlerle karşılaştırılarak bağımsız doğrulanabilir (spec.md Hikâye 3).

### Testler için User Story 3 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T031 [P] [US3] Supertest: meslek bazlı sayı, ortalama süre (`completedAt - createdAt`)
  ve tamamlanma oranı — hepsi silinmiş görüşmeler dahil hesaplanır ve ham veriden elle
  hesaplanan referans değerlerle birebir eşleşir (Clarifications Q1, FR-009, FR-010,
  FR-011, SC-006) — `backend/test/integration/us-admin3-stats.spec.ts`.
- [X] T032 [P] [US3] Supertest: günlük token zaman serisi `tokenWindowDays` (varsayılan 30)
  penceresinde, veri olmayan günler `0` ile dolu, toplam ham `TokenUsage` toplamıyla
  eşleşir (Clarifications Q3, FR-012, SC-006) — `backend/test/integration/us-admin3-token-series.spec.ts`.
- [X] T033 [P] [US3] Supertest: hiç görüşme/token kaydı yokken `200` + sıfır/boş değerler,
  hata **yok** (FR-013, SC-007) — `backend/test/integration/us-admin3-empty.spec.ts`.
- [X] T034 [P] [US3] Vitest+RTL: `stats.tsx` bar/pie/line grafiklerini doğru veriyle
  render eder, veri yokken boş durum mesajı gösterir — `frontend/test/admin-stats.test.tsx`.
- [X] T035 [P] [US3] Playwright e2e: quickstart.md US3 senaryosu (dolu + boş veri durumu)
  — `frontend/test/e2e/admin-stats.spec.ts`.

### Implementasyon for User Story 3

- [X] T036 [US3] `AdminService.getStats(query)` metodunu ekle: `groupBy` meslek sayısı
  (`resolvePositionLabel` ile "Belirsiz" etiketleme), ortalama süre hesabı, tamamlanma
  oranı, günlük token `groupBy` + sıfır doldurma (research.md §2, §4) —
  `backend/src/admin/admin.service.ts` (T004, T005, T009'a bağlı).
- [X] T037 [US3] `AdminStatsController`'ı oluştur: `GET /api/admin/stats` —
  `backend/src/admin/admin-stats.controller.ts` (T036, T002, T001'e bağlı).
- [X] T038 [P] [US3] `profession-bar-chart.tsx` bileşenini oluştur: Recharts `BarChart`
  (ADR-0011) — `frontend/src/components/admin/profession-bar-chart.tsx`.
- [X] T039 [P] [US3] `completion-pie-chart.tsx` bileşenini oluştur: Recharts `PieChart`
  — `frontend/src/components/admin/completion-pie-chart.tsx`.
- [X] T040 [P] [US3] `token-line-chart.tsx` bileşenini oluştur: Recharts `LineChart`
  (günlük, 30 gün) — `frontend/src/components/admin/token-line-chart.tsx`.
- [X] T041 [US3] `stats.tsx`'i tamamla: `getStats()` (T006) çağrısı, üç grafik bileşeninin
  entegrasyonu, ortalama süre/oran metin özeti, veri-yok boş durumu, `AdminShell` ile
  sarmalama — `frontend/src/pages/admin/stats.tsx` (T006, T008, T038, T039, T040'a bağlı).
- [X] T042 [US3] `/admin/stats` rotasını `AdminProtectedRoute` ile sarmala ve `AdminShell`
  nav bağlantısını ekle — `frontend/src/App.tsx`, `frontend/src/components/admin/admin-shell.tsx`.

**Checkpoint**: Tüm kullanıcı hikâyeleri (US1+US2+US3) bağımsız ve birlikte çalışır durumda.

---

## Faz 6: Cilalama & Çapraz Kesişen Konular

**Amaç**: Tüm hikâyeleri etkileyen iyileştirmeler.

- [X] T043 [P] Erişilebilirlik: her Recharts bileşeninde `accessibilityLayer` açık ve
  yanında metinsel değer/özet olduğunu doğrula (`docs/TECH_STACK.md` Data Visualization
  notu) — `frontend/src/components/admin/profession-bar-chart.tsx`,
  `completion-pie-chart.tsx`, `token-line-chart.tsx`.
- [X] T044 [P] Salt-okunurluk statik incelemesi: `backend/src/admin/**` altında `@Post`/
  `@Patch`/`@Put`/`@Delete` dekoratörü **hiç kullanılmadığını** doğrula (FR-008) —
  kod incelemesi, bulgu `specs/005-admin/quickstart.md`'ye not düşülür.
- [X] T045 [P] `docs/API_CONVENTIONS.md`'ye `005-admin` referansının (hâlihazırda §0/§3.1
  taslağında mevcut) yeni uç noktalarla tutarlı olduğunu doğrula; gerekirse küçük bir
  netleştirme notu ekle — `docs/API_CONVENTIONS.md`.
- [X] T046 quickstart.md'deki tüm senaryoları (US1-US3) uçtan uca manuel/otomatik koş,
  sonuçları ve SC eşlemesini doğrula — `specs/005-admin/quickstart.md`.
- [X] T047 `case-study/AI_DEVLOG.md`'yi bu dilimin implementasyon oturumuyla güncelle
  (İlke I) — `case-study/AI_DEVLOG.md`.

---

## Bağımlılıklar & Yürütme Sırası

### Faz Bağımlılıkları

- **Kurulum (Faz 1)**: Bağımsız — hemen başlayabilir.
- **Foundational (Faz 2)**: Kurulum'un tamamlanmasına bağlı — tüm kullanıcı hikâyelerini
  **BLOKE EDER**.
- **Kullanıcı Hikâyeleri (Faz 3+)**: Tümü Foundational tamamlanmasına bağlı.
  - US1, US2, US3 paralel ilerleyebilir (ekip kapasitesi varsa) veya öncelik sırasıyla
    (P1 → P2 → P3) sırayla işlenebilir.
- **Cilalama (Son Faz)**: İstenen tüm kullanıcı hikâyelerinin tamamlanmasına bağlı.

### Kullanıcı Hikâyesi Bağımlılıkları

- **US1 (P1)**: Foundational sonrası başlayabilir — diğer hikâyelere bağımlı değil.
- **US2 (P2)**: Foundational sonrası başlayabilir; `dashboard.tsx`'ten detay sayfasına
  bağlantı (T030) US1'in tablo bileşenine (T017) dokunur ama US2'nin kendi backend/sayfa
  mantığı US1'den **bağımsız** test edilebilir (doğrudan `/admin/interview/:id` ile).
- **US3 (P3)**: Foundational sonrası başlayabilir — US1/US2'nin ürettiği veriyi okur
  ama kendi ayrı uç noktası/sayfası olduğundan **bağımsız** test edilebilir.

### Her Kullanıcı Hikâyesi İçinde

- Testler (dahilse) üretim kodundan **önce** yazılır ve **başarısız olmalı**.
- Servis metodu → controller uç noktası → sayfa entegrasyonu sırası izlenir.
- Hikâye, bir sonraki önceliğe geçmeden önce tamamlanır.

### Paralel Fırsatlar

- Faz 1'deki tüm `[P]` görevler paralel çalışabilir.
- Faz 2'deki tüm `[P]` görevler paralel çalışabilir.
- Foundational tamamlandıktan sonra, ekip kapasitesi varsa US1/US2/US3 paralel
  başlayabilir.
- Her hikâye içindeki `[P]` testler paralel çalışabilir.
- Her hikâye içindeki bağımsız bileşen dosyaları (`[P]`) paralel çalışabilir.

---

## Paralel Örnek: User Story 1

```bash
# User Story 1 icin tum testleri birlikte baslat:
Task: "Supertest: rol/oturum reddi (401/403) - backend/test/integration/us-admin1-list-auth.spec.ts"
Task: "Supertest: meslek filtresi + Belirsiz kovasi + silinmis dahil - backend/test/integration/us-admin1-list-filter.spec.ts"
Task: "Supertest: sayfalama varsayilan 20 - backend/test/integration/us-admin1-list-pagination.spec.ts"
Task: "Vitest+RTL: dashboard.tsx render - frontend/test/admin-dashboard.test.tsx"

# User Story 1 icin bagimsiz bilesenleri birlikte baslat:
Task: "interview-table.tsx - frontend/src/components/admin/interview-table.tsx"
Task: "profession-filter.tsx - frontend/src/components/admin/profession-filter.tsx"
```

---

## Uygulama Stratejisi

### Önce MVP (Yalnızca User Story 1)

1. Faz 1: Kurulum'u tamamla.
2. Faz 2: Foundational'ı tamamla (KRİTİK — tüm hikâyeleri bloke eder).
3. Faz 3: User Story 1'i tamamla.
4. **DUR ve DOĞRULA**: User Story 1'i bağımsız test et (quickstart.md US1).
5. Hazırsa demo et/dağıt.

### Artımlı Teslimat

1. Kurulum + Foundational tamamla → Temel hazır.
2. User Story 1 ekle → Bağımsız test et → Demo et (MVP!).
3. User Story 2 ekle → Bağımsız test et → Demo et.
4. User Story 3 ekle → Bağımsız test et → Demo et.
5. Her hikâye, öncekini bozmadan değer ekler.

### Paralel Ekip Stratejisi

Birden fazla geliştiriciyle:

1. Ekip, Kurulum + Foundational'ı birlikte tamamlar.
2. Foundational bittikten sonra:
   - Geliştirici A: User Story 1 (liste + filtre)
   - Geliştirici B: User Story 2 (detay)
   - Geliştirici C: User Story 3 (istatistik)
3. Hikâyeler bağımsız tamamlanır ve entegre olur.

---

## Notlar

- `[P]` görevler = farklı dosyalar, bağımlılık yok.
- `[Hikâye]` etiketi görevi belirli bir kullanıcı hikâyesine izlenebilir kılar.
- Her kullanıcı hikâyesi bağımsız tamamlanabilir ve test edilebilir olmalı.
- Uygulamadan önce testlerin başarısız olduğunu doğrula.
- Her görev veya mantıksal grup sonrası commit at.
- Herhangi bir checkpoint'te durup hikâyeyi bağımsız doğrula.
- Kaçının: belirsiz görevler, aynı dosya çakışmaları, bağımsızlığı bozan hikâyeler-arası
  bağımlılıklar.

---

## Faz 7: Convergence (`/speckit-converge`, 2026-08-04)

Faz 1-6 tamamlandıktan sonra kod, `spec.md`/`plan.md`/`tasks.md` ve anayasaya karşı
yeniden değerlendirildi. `missing` ve `contradicts` boşluk **yok**; aşağıdakiler
`partial`/`unrequested` kalemlerdir.

- [X] T048 Admin görüşme detayında rapor bölümüne "Ek notlar" (`report.additionalNotes`)
  render et — sunucu alanı zaten döndürüyor, kullanıcı tarafı raporu
  (`frontend/src/pages/interview/report.tsx`) gösteriyor, admin göstermiyor —
  `frontend/src/pages/admin/interview-detail.tsx` (FR-005, partial)
- [X] T049 `specs/005-admin/contracts/admin-api.md` §2 yanıt şemasına `additionalNotes`
  alanını ekle (uygulama döndürüyor, sözleşme listelemiyor) (contracts/admin-api.md §2, unrequested)
- [X] T050 `docs/APP_FLOW.md` açık sorular listesindeki "Admin renk teması ne olacak?"
  maddesini kapat; verilen kararı (`--color-admin-accent` / `-strong` / `-soft`, açık
  mavi-camgöbeği) yaz — `docs/APP_FLOW.md` (plan: APP_FLOW §5/§6 kararı, FR-015, partial)
- [X] T051 `docs/DECISIONS.md`'ye bu dilimin uygulama kararlarını (pageSize üst sınırı,
  shadcn `Table`/`Select` yerine native öğeler, admin vurgu rengi token'ları) kısa bir
  kayıt olarak ekle — `docs/DECISIONS.md` (Constitution VII, partial)
- [X] T052 SC-001 doğrulaması: liste → detay geçişinde sayfa yüklenme süresini ölç ve
  sonucu `specs/005-admin/quickstart.md` doğrulama tablosuna yaz (SC-001, partial)
