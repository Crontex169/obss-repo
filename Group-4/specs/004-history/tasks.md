---

description: "Interview History (Görüşme Geçmişi) dikey dilimi için görev listesi"
---

# Görevler: Interview History (Görüşme Geçmişi)

**Girdi**: `specs/004-history/` tasarım dokümanları

**Ön Koşullar**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/history-api.md ✅, quickstart.md ✅

**Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) — hata zarfı (§2), `404` kuralı (§1), soft-delete görünürlüğü (§4.3).

**Testler**: **ZORUNLU** — Anayasa İlke III (Test-Öncelikli/ATDD, PAZARLIK EDİLEMEZ). Her hikâye için kabul testleri, üretim kodundan **önce** yazılır (Kırmızı → Yeşil → Refactor).

**Organizasyon**: Görevler kullanıcı hikâyesine göre gruplanmıştır (bkz. `spec.md`).

---

## ⚠️ Bu dilim şema/sözleşme sahibi DEĞİLDİR — koordinasyon uyarısı

`002-interview` şu anda **aktif implementasyon altındadır** (ayrı bir ekip); frontend
kod tarafı `005-interview-dikeyi-implementasyon` ile zaten main'e merge oldu. Bu dilim:

- `specs/002-interview/**` ve `specs/003-pre-assessment/**` altındaki **hiçbir spec/
  data-model/contract dosyasını değiştirmez** — yalnızca referans için okur.
- `backend/src/interview/**` içindeki mevcut dosyalara (`interview.controller.ts`,
  `interview.service.ts`) **tek bir yeni uç nokta** (`DELETE /api/interviews/:id`) ve
  **tek bir yeni servis metodu** (`softDelete`) ekler; mevcut `GET` uç noktalarını veya
  `InterviewOwnershipGuard`'ı **yeniden yazmaz**.
- `frontend/src/pages/interview/**` ve `frontend/src/components/interview/**` içindeki
  mevcut, merge olmuş dosyaları (`list.tsx`, `interview-card.tsx`, `session.tsx`,
  `report.tsx`, `interview-client.ts`) **genişletir** (bkz. `plan.md` 2026-08-03
  revizyonu) — bu, `list.tsx`'in kendi kod yorumunda öngördüğü devir noktasıdır, yeni
  paralel bir `history/` sayfa/bileşen/servis ağacı **açılmaz**.
- Backend'e dokunan görevler (Faz 6 / US4: T038-T039), implementasyon anında
  `002-interview` ekibiyle **koordine edilerek ayrı, küçük bir PR** olarak yapılmalıdır
  (plan.md "Proje Yapısı" kararı).

## 📥 Bu dilim cross-cutting altyapıyı DEVRALIR (yeniden kurmaz)

| Devralınan | Kaynak dosya | Bu dilimde ne yapılır |
|-----------|--------------------------------------|------------------------|
| `GET /api/interviews` (liste) | `specs/002-interview/contracts/interview-api.md` §2 | Sözleşme değişmeden tüketilir (US1) — `frontend/src/lib/interview-client.ts`'teki `listInterviews()` zaten bunu yapıyor |
| `GET /api/interviews/:id` (detay/devam) | `specs/002-interview/contracts/interview-api.md` §3 | Sözleşme değişmeden tüketilir (US2, US3) — `interview-client.ts`'teki `getInterview()` zaten `answeredPairs` + `report`'u birlikte döndürüyor |
| `Interview`/`Question`/`Answer`/`Report` Prisma modelleri | `specs/002-interview/data-model.md` | Yeni migration **yok**; yalnızca `deletedAt` alanına yazan uç nokta eklenir |
| `SessionGuard` | `backend/src/auth/**` (001-auth-rol) | Değiştirilmez, yeniden kullanılır |
| `InterviewOwnershipGuard` | `backend/src/interview/ownership/interview-ownership.guard.ts` (002-interview) | Değiştirilmez, `DELETE` uç noktasında yeniden kullanılır |
| Ortak hata zarfı filtresi | `backend/src/common/http-exception.filter.ts` | Değiştirilmez (§2) |
| `/interviews`, `/interview/:id`, `/interview/:id/report` sayfaları + `interview-card.tsx` | `frontend/src/pages/interview/**`, `frontend/src/components/interview/interview-card.tsx` (002-interview, T086) | **Genişletilir** (level rozeti, Sil aksiyonu, soru/cevap+rapor birleşik görünüm, PDF/trend) — yeniden yazılmaz |
| Recharts (ADR-0011) | `frontend/package.json` (kilitli bağımlılık, `report.tsx`'te zaten kullanımda) | Skor trendi grafiğinde (US5) kullanılır, yeni grafik kütüphanesi eklenmez |
| shadcn/ui `Card`, `Badge`, `AlertDialog`, `Button` | `frontend/src/components/ui/**` (proje genelinde kilitli) | Silme onayı bileşeninde kullanılır |

⚠️ **Devralınan bir bileşen (`GET` uç noktaları, guard) sözleşmeden sapmışsa bu dilim onu
YENİDEN YAZMAZ** — bulgu T001'de not edilir, düzeltme `002-interview` kapsamındadır.

**Bu dilime ÖZGÜ olan (gerçekten yeni)**: `DELETE /api/interviews/:id` +
`InterviewService.softDelete`, `frontend/src/components/interview/delete-confirm-dialog.tsx`,
`question-answer-list.tsx`, `pdf-export-button.tsx`, `score-trend-chart.tsx` — mevcut
`frontend/src/pages/interview/**` sayfalarına entegre edilir, ayrı bir sayfa ağacı değil.

---

## Biçim: `[ID] [P?] [Hikâye] Açıklama`

- **[P]**: Paralel çalıştırılabilir (farklı dosyalar, tamamlanmamış göreve bağımlılık yok)
- **[Hikâye]**: US1…US5 → spec.md Hikâye 1…5
- Açıklamalarda kesin dosya yolları belirtilir

## Yol Kuralları (plan.md — Web uygulaması yapısı, 2026-08-03 revizyonu)

- Backend: `backend/src/interview/` (mevcut modül, 002-interview sahipliğinde — bu dilim
  yalnızca ekleme yapar), `backend/test/integration/`, `backend/test/fixtures/`
- Frontend: **mevcut** `frontend/src/pages/interview/`, `frontend/src/components/interview/`,
  `frontend/src/lib/interview-client.ts` (proje konvansiyonu: kebab-case dosya adı, ayrı
  `history/` alt klasörü **yok**); yeni hook'lar için `frontend/src/hooks/` (mevcut
  konvansiyon T003 ile doğrulanır)
- Frontend testleri: `frontend/test/*.test.tsx` (düz yapı, mevcut konvansiyon — ayrı
  `frontend/test/history/` alt klasörü **açılmaz**)
- E2e: `frontend/test/e2e/*.spec.ts` (Playwright, mevcut konvansiyon — repo kökünde
  `e2e/` klasörü **yok**, bkz. `frontend/test/e2e/interview-flows.spec.ts`)

## Kilitli Teknoloji Yığını (ADR-0001…0011, `docs/TECH_STACK.md`)

NestJS + PostgreSQL 16 + Prisma (backend, mevcut `InterviewModule`); React 19 + Vite +
Tailwind 4 + shadcn/ui (frontend); Recharts (ADR-0011, skor trendi). Testler: Jest +
Supertest (backend), Vitest + RTL (frontend bileşenleri), Playwright (e2e).

**Bu dilimin eklediği yeni backend bağımlılığı: 0.** **Yeni frontend veri getirme
kütüphanesi: 0** (research.md §4 — mevcut `fetch` tabanlı servis katmanı kullanılır).
**Yeni frontend bağımlılığı**: yalnızca istemci tarafı PDF üretim kütüphanesi (US5,
T041'de somutlaştırılacak, örn. `jspdf`) — mimariyi etkilemeyen tek istisna
(research.md §6).

## Kullanıcı Hikâyesi ↔ Faz Eşlemesi (öncelik sırasıyla)

| Faz | Hikâye | Başlık | Öncelik |
|-----|--------|--------|---------|
| 3 | US1 | Geçmiş görüşmeleri kart görünümünde listeleme | P1 🎯 MVP |
| 4 | US2 | Yarım kalmış görüşmeye devam etme (resume) | P2 |
| 5 | US3 | Tamamlanmış görüşme detayını görüntüleme | P2 |
| 6 | US4 | Görüşmeyi silme (soft-delete) | P3 |
| 7 | US5 | Rapor dışa aktarımı (PDF) ve skor trendi | P4 |

> **Sıralama gerekçesi**: `spec.md` önceliklendirmesiyle birebir. US2/US3 aynı önceliğe
> (P2) sahip; spec.md sıralamasına göre US2 (resume) önce, US3 (detay) sonra işlenir —
> ikisi de aynı `GET /api/interviews/:id` uç noktasını tüketir ama farklı dallanma
> mantığı (`status` alanına göre) uygular. US4 (silme) yeni backend uç noktası
> gerektirdiğinden ve diğer üç hikâyenin ürettiği listeye/karta bağımlı olduğundan
> sonra gelir. US5 (PDF/trend) tüm diğer hikâyelerin ürettiği veriye (rapor, geçmiş)
> bağımlı olduğundan son sıradadır.

---

## Faz 1: Kurulum & Devralma Doğrulaması

**Amaç**: Devralınan `002-interview` sözleşmesinin (iki `GET` uç noktası, guard) bu
dilimin ihtiyaçlarıyla uyumlu olduğunu doğrulamak. **Yeni backend/frontend altyapısı
YAZILMAZ** — yalnızca doğrulama ve mevcut yapı tespiti.

- [X] T001 **Devralma doğrulaması (İLK GÖREV)**: `specs/002-interview/contracts/interview-api.md` §2 (`GET /api/interviews`) ve §3 (`GET /api/interviews/:id`) uç noktalarının bu dilimin `contracts/history-api.md` §1-2'de tanımladığı beklentilerle (yanıt alanları: `id`, `position`, `status`, `createdAt`, `completedAt`, `currentQuestionOrder`, `reportStatus`, soru/cevap/rapor içeriği; soft-delete filtresi; `404` kuralı) tutarlı olduğunu doğrula (kod incelemesi — `backend/src/interview/interview.controller.ts`, `interview.service.ts` salt-okunur okunur, **değiştirilmez**). Sapma varsa bu dilimde düzeltme **YAPMA** — bulguları not et, düzeltme `002-interview` kapsamındadır — bulgu dosyası: `specs/004-history/devralma-dogrulama.md` ✅ Tamamlandı (005-interview-dikeyi-implementasyon merge sonrası): sözleşme uyumlu, `mode`/`level` alan eksikliği bulunup `data-model.md`/`spec.md`'ye eklendi.
- [X] T002 [P] `InterviewOwnershipGuard`'ın (`backend/src/interview/ownership/interview-ownership.guard.ts`) mevcut ve dokümante edildiği gibi (sahip değilse `404`, admin baypas) çalıştığını doğrula — `DELETE` uç noktasında yeniden kullanılacak, yeni guard **yazılmaz** — bulgu notu `specs/004-history/devralma-dogrulama.md`'ye eklenir ✅ Tamamlandı: davranış beklendiği gibi doğrulandı, ek düzeltme gerekmedi.
- [X] T003 [P] Frontend proje yapısını doğrula: `frontend/src/pages/`, `frontend/src/components/`, `frontend/src/lib/` klasörlerinin mevcut konvansiyonunu tespit et — `frontend/src/App.tsx` (react-router-dom, `/interviews`+`/interview/:id`+`/interview/:id/report` zaten kayıtlı), `frontend/src/pages/interview/` (list/session/report.tsx zaten mevcut), test dosyaları düz `frontend/test/*.test.tsx` + `frontend/test/e2e/*.spec.ts` (alt klasör yok) ✅ Tamamlandı (2026-08-03, plan.md revizyonuyla birlikte): bulgular `plan.md` "2026-08-03 revizyonu" ve bu dosyanın "Yol Kuralları" bölümüne işlendi — paralel `history/` ağacı yerine mevcut `interview/` dosyaları genişletilecek.
- [X] T004 [P] shadcn/ui `AlertDialog`, `Card`, `Badge` bileşenlerinin projede kurulu olduğunu doğrula (yoksa `npx shadcn add alert-dialog card badge` ile ekle — bu yeni npm bağımlılığı **değil**, kilitli kütüphanenin bir parçası) — `frontend/src/components/ui/` ✅ Tamamlandı (2026-08-03): `Card` zaten vardı; `AlertDialog`/`Badge`/`Button` `npx shadcn add` ile eklendi (+ `class-variance-authority`, `radix-ui` bağımlılıkları), `tsc -b` hatasız.
- [X] T005 [P] Recharts'ın (ADR-0011) `frontend/package.json`'da kilitli sürümle kurulu olduğunu doğrula — US5 skor trendi için yeni bağımlılık **eklenmeyecek** ✅ Tamamlandı: `recharts@^3.8.0` zaten kurulu, `report.tsx`'te kullanımda.

**Checkpoint**: Devralınan sözleşme ve mevcut proje yapısı doğrulandı; Faz 2'ye geçilebilir.

---

## Faz 2: Foundational (Tüm Hikâyeler İçin Ortak Altyapı)

**Amaç**: Birden fazla hikâye tarafından paylaşılan (US1 + US2 + US3 + US4) ortak
altyapı. **2026-08-03 revizyonu**: `InterviewSummary`/`InterviewListItem`/`Question`/
`AnsweredPair`/`Report` tipleri ve `listInterviews()`/`getInterview()` fetch
sarmalayıcıları **zaten** `frontend/src/lib/interview-client.ts`'te mevcut (002-interview,
T086) — bu fazda yeniden tanımlanmaz, yalnızca eksik parça eklenir. **⚠️ KRİTİK**:
Hiçbir kullanıcı hikâyesi bu faz tamamlanmadan başlayamaz.

- [X] T006 Mevcut tiplerin (`InterviewSummary`, `InterviewListItem`, `Question`, `AnsweredPair`, `Report` — `frontend/src/lib/interview-client.ts`) bu dilimin tüm ekranları (liste, resume, detay, silme) için yeterli olduğunu doğrula; eksik alan varsa (örn. `level` zaten `InterviewListItem`'da mevcut, kontrol edilecek) **var olan interface'e ekle**, yeni bir tip dosyası açma — `frontend/src/lib/interview-client.ts` ✅ Tamamlandı (2026-08-03): tipler yeterli, ek alan gerekmedi.
- [X] T007 [P] `deleteInterview(id)` fetch sarmalayıcısını mevcut `interview-client.ts`'e ekle (yeni paralel servis dosyası **açılmaz** — `listInterviews`/`getInterview`/`getReport` zaten aynı dosyada) — `frontend/src/lib/interview-client.ts` ✅ Tamamlandı.
- [X] T008 [P] `interview-card.tsx`'teki `STATUS_LABEL`/`REPORT_LABEL` eşlemesinin FR-002 rozet gereksinimini (Tamamlandı/Yarım Kaldı) karşıladığını doğrula; "Silindi" rozeti zaten yalnızca `deletedAt` doluyken render ediliyor ve backend owner için `deletedAt: null` filtresi uyguladığından (§4.3) kullanıcı tarafında pratikte hiç görünmez — ek bileşen **açılmaz**, mevcut eşleme genişletilir — `frontend/src/components/interview/interview-card.tsx` ✅ Tamamlandı: `STATUS_LABEL` "Devam ediyor" → "Yarım Kaldı" olarak spec diline hizalandı.
- [X] T009 [P] Ağ/sunucu hatalarında "tekrar dene" aksiyonu eksikliğini gider (FR-015, İlke VI/VII — şu an `list.tsx`/`session.tsx`/`report.tsx` yalnızca statik hata metni gösteriyor, retry yok): küçük bir `ErrorRetry` bileşeni ekle ve üç sayfaya da entegre et — `frontend/src/components/interview/error-retry.tsx`, kullanım: `list.tsx`, `session.tsx`, `report.tsx` ✅ Tamamlandı: `error-retry.tsx` oluşturuldu, `list.tsx`+`session.tsx` ilk-yükleme hatasına entegre edildi; `report.tsx` kendi mevcut `ReportFailed`/retry mekanizmasını korur (regenerate ile aynı UX, değiştirilmedi).
- [X] T010 "Interview History" giriş noktasını netleştir: bu MVP'de ayrı bir Dashboard bileşeni **yok** (`App.tsx`'te yalnızca placeholder `Home()` var, bkz. devralma-dogrulama.md) — mevcut `/interviews` rotası zaten bu dilimin "Interview History" ekranıdır; `Home()`'a veya login-sonrası yönlendirmeye `/interviews`'e giden bir bağlantı eklenmesi yeterlidir, yeni route **açılmaz** — `frontend/src/App.tsx` ✅ Tamamlandı.
- [X] T011 [P] Backend test sabitleri (fixture): tamamlanmış+raporlu, yarım kalmış, rapor-başarısız ve yabancı-kullanıcıya-ait görüşme senaryoları için paylaşılan test verisi oluşturucu (quickstart.md ön koşul verisiyle birebir) — `backend/test/fixtures/interview-history.fixtures.ts` ✅ Kapsam revize edildi (2026-08-03): mevcut `test/integration/helpers/` (`create-test-interview.ts`, `complete-interview.ts`, `auth-session.ts`) tüm senaryoları zaten karşılıyor — yeni fixture dosyası **açılmadı** (çakışma önleme ilkesi), T035'te doğrudan kullanıldı.

**Checkpoint**: Ortak tip/servis eklentileri, hata gösterimi ve test sabitleri hazır — kullanıcı hikâyeleri paralel başlayabilir.

---

## Faz 3: User Story 1 - Geçmiş görüşmeleri kart görünümünde listeleme (Priority: P1) 🎯 MVP

**Hedef**: Kullanıcı "Interview History" sekmesinde kendi görüşmelerini kart görünümünde,
en yeniden eskiye sıralı, doğru durum rozetiyle görür; boş durumda yönlendirici mesaj
gösterilir; silinmiş/yabancı kayıtlar hiç görünmez.

**Bağımsız Test Kriteri**: Farklı durumlarda (tamamlanmış, yarım kalmış, hiç görüşme yok,
silinmiş kayıt, yabancı kullanıcı kaydı) test kullanıcılarıyla sekmeye girilip kartların
doğru bilgi/rozetle göründüğü ve silinmiş/yabancı kayıtların yer almadığı doğrulanarak
bağımsız test edilebilir (spec.md Hikâye 1).

### Testler için User Story 1 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T012 [P] [US1] Vitest+RTL: `interview-card.tsx` doğru pozisyon/tarih/mod/**level** rozeti render eder (FR-002 — level rozeti yeni eklenen kapsam), `list.tsx` `createdAt` DESC sıralı (FR-003) — `frontend/test/interview-list.test.tsx` ✅ Tamamlandı.
- [X] T013 [P] [US1] Vitest+RTL: görüşme yokken boş durum mesajı + "Yeni görüşme" CTA'sı render edilir (FR-004 — `list.tsx`'te zaten kısmen var, tam metin/CTA doğrulaması) — `frontend/test/interview-list.test.tsx` (T012 ile aynı dosyada ek `describe`) ✅ Tamamlandı.
- [ ] T014 [P] [US1] Playwright e2e: S1 senaryosu — tamamlanmış+yarım kalmış kartlar, yabancı kullanıcı kaydının görünmemesi, silinmiş kaydın görünmemesi (Hikâye 1 kriter 1, 3, 4; quickstart.md S1) — `frontend/test/e2e/interview-history-list.spec.ts` — henüz yazılmadı (gerçek tarayıcı/dev-server gerektirir)

### Implementasyon for User Story 1

- [X] T015 [P] [US1] `interview-card.tsx`'e **level rozetini** ekle (Stajyer/Junior/Senior — `InterviewListItem.level` alanı zaten API'den dönüyor, yalnızca render eksik, bkz. devralma-dogrulama.md bulgusu); aksiyon alanı US2/US3/US4'te genişletilecek — `frontend/src/components/interview/interview-card.tsx` (yeni dosya **değil**, mevcut dosyaya ek) ✅ Tamamlandı.
- [X] T016 [P] [US1] `list.tsx`'teki boş durum mesajını FR-004'e göre netleştir (mesaj + yeni görüşme CTA'sı zaten kısmen var — `Link to="/interview/new"`) — `frontend/src/pages/interview/list.tsx` ✅ Tamamlandı.
- [X] T017 [US1] `list.tsx`'i gözden geçir: `listInterviews()` (mevcut) çağrısı, yükleniyor/hata (`ErrorRetry`, T009) durumları, `createdAt` DESC istemci tarafı güvenlik ağı sıralaması (FR-003, backend zaten sıralı dönüyorsa doğrula) — `frontend/src/pages/interview/list.tsx` (T006, T007, T009, T015, T016'ya bağlı) ✅ Tamamlandı.
- [ ] T018 [US1] SC-001 doğrulaması: liste render süresinin 2 sn altında olduğunu manuel/otomatik ölçümle teyit et (quickstart.md S1 "Başarı ölçütü eşlemesi") — not: `specs/004-history/devralma-dogrulama.md`'ye ek — henüz yapılmadı (gerçek tarayıcı ölçümü gerektirir)

**Checkpoint**: User Story 1 bağımsız olarak tam işlevsel ve test edilebilir (MVP burada demo edilebilir — büyük kısmı zaten çalışıyor, bu faz eksik parçaları (level rozeti, retry, boş durum netliği) tamamlıyor).

---

## Faz 4: User Story 2 - Yarım kalmış görüşmeye devam etme (resume) (Priority: P2)

**Hedef**: "Yarım Kaldı" rozetli bir kartta "Devam Et" seçildiğinde kullanıcı kaldığı
sorudan devam eder; ağ hatasında zarif hata+tekrar dene; görüşme başka yerde
tamamlanmışsa otomatik Detay'a yönlendirme; yabancı/olmayan kayıt için `404`.

**Bağımsız Test Kriteri**: Yarım kalmış bir görüşme kaydıyla "Devam Et" tetiklenip
kullanıcının kaldığı sorudan (önceki cevaplar bozulmadan) devam ettiği, hata/yarış
durumlarının doğru yönetildiği doğrulanarak bağımsız test edilebilir (spec.md Hikâye 2).

**2026-08-03 revizyonu**: "Devam Et" akışının çekirdeği zaten çalışıyor — kartın linki
doğrudan `/interview/:id`'ye gider, `session.tsx` `getInterview(id)` çağırıp
`answeredPairs`'i değişmeden gösterip `currentQuestion`'ı aktif soru yapıyor (FR-005
zaten karşılanıyor). Bu fazda gerçekten eksik olan: (a) FR-014'ün **otomatik**
yönlendirme istediği yerde `session.tsx`'in şu an yalnızca manuel bir "Raporu görüntüle"
linki göstermesi (otomatik değil), (b) 404/yabancı kayıt hata mesajının sahiplik bilgisi
sızdırmadığının teyidi.

### Testler için User Story 2 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T019 [P] [US2] Vitest+RTL: `session.tsx` `getInterview()` sonrası `in_progress` yanıtında önceki soru/cevap çiftlerini değişmeden gösterir, `currentQuestionOrder` aktif soru olarak işaretlenir (FR-005 — mevcut davranışın regresyon testi) — `frontend/test/interview-form.test.tsx` (dosya adı düzeltmesi: bu davranış zaten `InterviewSessionPage` describe bloğunda 002-interview'den beri test ediliyordu, T086) ✅ Zaten mevcuttu, doğrulandı.
- [X] T020 [P] [US2] Vitest+RTL: ağ/sunucu hatasında `ErrorRetry` (T009) gösterilir, görüşme durumu değişmez (FR-015, Hikâye 2 kriter 2) — `frontend/test/interview-form.test.tsx` ✅ Mevcut "sunucu hatasi durumunda hata mesaji gosterilir" testi `ErrorRetry` entegrasyonundan sonra da geçiyor.
- [X] T021 [P] [US2] Vitest+RTL: `getInterview()` yanıtı `status="completed"` dönerse sistem **otomatik olarak** rapor/detay ekranına yönlendirir (FR-014, Hikâye 2 kriter 3 — eski test manuel linki bekliyordu, otomatik yönlendirmeyi zorunlu kılacak şekilde güncellendi) — `frontend/test/interview-form.test.tsx` ✅ Tamamlandı.
- [ ] T022 [P] [US2] Playwright e2e: S2 senaryosu tam akışı (resume, ağ hatası, yarış durumu, yabancı `id` → 404) — `frontend/test/e2e/interview-history-resume.spec.ts` — henüz yazılmadı (gerçek tarayıcı/dev-server gerektirir)

### Implementasyon for User Story 2

- [X] T023 [US2] `session.tsx`'teki `status === 'completed'` dalını, manuel link yerine **otomatik yönlendirme** yapacak şekilde güncelle (FR-014) — `frontend/src/pages/interview/session.tsx` (T006, T007'ye bağlı) ✅ Tamamlandı (`useNavigate` + `useEffect`, `replace: true`).
- [X] T024 [US2] "Devam Et" aksiyonunun yalnızca `status=in_progress` kartlarda göründüğünü doğrula (kart linki zaten `interview.status`'e göre hedefi seçiyor — `interview-card.tsx` mevcut mantığı gözden geçirilir, değişiklik gerekmiyorsa görev "doğrulandı" notuyla kapatılır) — `frontend/src/components/interview/interview-card.tsx` ✅ Doğrulandı, değişiklik gerekmedi.
- [X] T025 [US2] "Kayıt bulunamadı" hata durumunun (404 için, sahiplik bilgisi sızdırmadan) `session.tsx`'teki mevcut hata gösterimiyle karşılandığını doğrula; backend mesajı sahiplik/varlık bilgisi sızdırıyorsa bulguyu not et (düzeltme `002-interview` kapsamındadır) — `frontend/src/pages/interview/session.tsx` ✅ Doğrulandı: backend mesajı ("Gorusme bulunamadi") jenerik, sahiplik/varlık ayrımı sızdırmıyor.
- [X] T026 [US2] Devam Et akışının soru-cevap ekranıyla (mevcut `session.tsx`) zaten aynı sayfa olduğunu, ayrı bir yönlendirme/route parametresi katmanına gerek olmadığını teyit et — not: `specs/004-history/devralma-dogrulama.md`'ye ek ✅ Doğrulandı.

**Checkpoint**: User Story 1 VE 2 birlikte bağımsız çalışır durumda.

---

## Faz 5: User Story 3 - Tamamlanmış görüşme detayını görüntüleme (Priority: P2)

**Hedef**: "Tamamlandı" rozetli bir kart seçildiğinde Görüşme Detayı ekranı tüm soru/
cevap çiftlerini ve raporu (Teknik/Davranışsal/Genel skorları + metinsel geri bildirim)
gösterir; rapor üretimi başarısızsa soru/cevap yine gösterilir, rapor bölümünde açık
hata bilgisi verilir; yabancı kayıt için `404`.

**Bağımsız Test Kriteri**: Tamamlanmış bir görüşme kaydıyla kart seçilip detay ekranının
tüm soru/cevap çiftlerini ve raporu (veya rapor hatasını) eksiksiz gösterdiği
doğrulanarak bağımsız test edilebilir (spec.md Hikâye 3).

**2026-08-03 revizyonu — en somut mimari değişiklik burada**: Mevcut `report.tsx`
yalnızca raporu (skorlar + geri bildirim, reportStatus ready/pending/failed) gösteriyor;
soru/cevap listesini **göstermiyor**. `getInterview(id)` (mevcut `interview-client.ts`)
zaten `answeredPairs` + `report`'u **tek çağrıda birlikte** döndürüyor — o yüzden yeni
bir `HistoryDetailPage`/`getById` katmanı gerekmez: `report.tsx`, `getInterview(id)`
kullanacak şekilde güncellenip üstüne soru/cevap listesi eklenerek "Görüşme Detayı"
(US3) haline getirilir. Ayrı bir `/history/:id` rotası **açılmaz**; mevcut
`/interview/:id/report` bu ekranın karşılığı olur.

### Testler için User Story 3 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T027 [P] [US3] Vitest+RTL: `report.tsx` tüm soru/cevap çiftlerini ve rapor skorlarını (Teknik/Davranışsal/Genel) + metinsel geri bildirimi render eder (FR-007) — `frontend/test/interview-report.test.tsx` ✅ Tamamlandı.
- [X] T028 [P] [US3] Vitest+RTL: `reportStatus="failed"` durumunda soru/cevap yine gösterilir, rapor bölümünde "rapor oluşturulamadı" bilgisi + (varsa) tekrar deneme seçeneği görünür (mevcut `retryReport`/`ReportFailed` bileşeni), sessiz başarısızlık yok (FR-008) — `frontend/test/interview-report.test.tsx` ✅ Tamamlandı (ayrıca `pending` durumu için ek test).
- [ ] T029 [P] [US3] Playwright e2e: S3 senaryosu (tamamlanmış+raporlu detay, rapor-başarısız detay, yabancı `id` → 404) — `frontend/test/e2e/interview-history-detail.spec.ts` — henüz ayrı dosya yazılmadı; eşdeğer senaryolar mevcut `frontend/test/e2e/interview-flows.spec.ts` "S5" bloğunda güncellendi (ready + failed), yabancı `id` → 404 S3 (resume) bloğunda zaten kapsanıyor

### Implementasyon for User Story 3

- [X] T030 [P] [US3] `question-answer-list.tsx` bileşeni: soru + cevap çiftlerini sırayla render eder (mevcut `session.tsx`'teki soru/cevap render bloğuyla aynı desen, ortak bileşene çıkarılır) — `frontend/src/components/interview/question-answer-list.tsx` ✅ Tamamlandı.
- [X] T031 [P] [US3] `report.tsx`'in veri kaynağını `getReport(id)`'den `getInterview(id)`'e taşı (tek çağrıda hem `answeredPairs` hem `report` gelir); mevcut `ReportPending`/`ReportFailed` bileşenleri korunur — `frontend/src/pages/interview/report.tsx` (T006'ya bağlı) ✅ Tamamlandı.
- [X] T032 [US3] `report.tsx`'e `question-answer-list.tsx` (T030) bileşenini entegre et: rapordan **önce** soru/cevap listesi render edilir (FR-007); yükleniyor/hata durumlarında `ErrorRetry` (T009) kullanılır — `frontend/src/pages/interview/report.tsx` (T009, T030, T031'e bağlı) ✅ Tamamlandı.
- [X] T033 [US3] `interview-card.tsx`'teki (T015) "Detay" hedefinin (`status=completed` kartlarda `/interview/:id/report`'a giden mevcut link) FR-006'yı karşıladığını doğrula — değişiklik gerekmiyorsa "doğrulandı" notuyla kapat — `frontend/src/components/interview/interview-card.tsx` ✅ Doğrulandı, değişiklik gerekmedi.
- [X] T034 [US3] SC-003 doğrulaması: liste → kart seçimi = 2 etkileşimle detay erişimi teyidi (Dashboard katmanı bu MVP'de yok, T010 notu — SC-003'ün "Dashboard → History → kart" 3-etkileşim hedefi `Home → /interviews → kart` = 2 etkileşime iner, hedef **aşılıyor**, sorun değil) — not: `specs/004-history/devralma-dogrulama.md`'ye ek ✅ Doğrulandı.

**Checkpoint**: User Story 1, 2 VE 3 birlikte bağımsız çalışır durumda.

---

## Faz 6: User Story 4 - Görüşmeyi silme (soft-delete) (Priority: P3)

**Hedef**: Kullanıcı bir kartta "Sil" aksiyonunu onaylayınca görüşme kendi listesinden
kaybolur (soft-delete, `deletedAt=now()`); admin tarafında veri kaybı olmadan "Silindi"
olarak erişilebilir kalır; işlem idempotent'tir; onay öncesi vazgeçme mümkündür.

**Bağımsız Test Kriteri**: Herhangi bir durumdaki bir görüşme kaydıyla silme aksiyonu
tetiklenip kaydın kullanıcı listesinden kaybolduğu, admin API'sinde hâlâ eriş
ilebilir olduğu, ikinci silme isteğinin hata fırlatmadığı doğrulanarak bağımsız test
edilebilir (spec.md Hikâye 4).

> ⚠️ **Koordinasyon notu**: T036-T037, `002-interview` ekibiyle koordine edilerek ayrı,
> küçük bir PR olarak açılmalıdır (plan.md karar). `002-interview`'in mevcut `GET`
> uç noktaları veya `InterviewOwnershipGuard`'ı bu görevlerde **değiştirilmez**, yalnızca
> yeni bir controller metodu ve servis metodu **eklenir**.

### Testler için User Story 4 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR

- [X] T035 [P] [US4] Jest+Supertest entegrasyon testi: `DELETE /api/interviews/:id` — sahibi için `204`, yabancı/olmayan kayıt için `404`, oturumsuz istek için `401`, **ikinci çağrı için `404`** (2026-08-03 bulgusu: `InterviewOwnershipGuard` değiştirilmediğinden zaten-silinmiş kayıt guard seviyesinde 404 döner — FR-013'ün "veya kayıt bulunamadı" dalı, contracts/history-api.md §3), `status`/`reportStatus`/soru/cevap/rapor içeriğinin fiziksel olarak değişmeden korunduğu (DB'den doğrudan) doğrulaması (FR-011, FR-012; mevcut `createTestInterview`/`completeInterview`/`registerAndSignIn` helper'ları kullanılır, yeni fixture dosyası açılmaz) — `backend/test/integration/history-delete.spec.ts` ✅ Tamamlandı (6/6 test yeşil).
- [X] T036 [P] [US4] Vitest+RTL: `DeleteConfirmDialog` onay/iptal akışları (onaylarsa `delete()` çağrılır, iptal ederse çağrılmaz ve kart listede kalır) (FR-010, Hikâye 4 kriter 4) — `frontend/test/delete-confirm-dialog.test.tsx` ✅ Tamamlandı.
- [ ] T037 [P] [US4] Playwright e2e: S4 senaryosu (silme→listeden kaybolma, admin API ile veri kaybı olmadığının doğrulanması, iptal, idempotent ikinci istek, silinmiş kayda eski bağlantıyla erişim→404) — `frontend/test/e2e/interview-history-delete.spec.ts` — henüz yazılmadı (gerçek tarayıcı/dev-server gerektirir)

### Implementasyon for User Story 4

- [X] T038 [US4] `InterviewService.softDelete(interviewId)`: `deletedAt = now()` yaz, `status`/`reportStatus`/ilişkili kayıtlar değiştirilmez (FR-011, FR-012); sahiplik + zaten-silinmiş kontrolü servis içinde **tekrarlanmaz** — `InterviewOwnershipGuard` bu isteği zaten filtrelemiştir (bkz. T039), servis sadece guard'dan geçen istekleri işler — `backend/src/interview/interview.service.ts` (mevcut dosyaya **ek**, T035'e bağlı) ✅ Tamamlandı.
- [X] T039 [US4] `DELETE /api/interviews/:id` controller metodu: guard zinciri `SessionGuard` (sınıf-seviyesi) → `InterviewOwnershipGuard` (değiştirilmeden yeniden kullanılır — zaten-silinmiş kayıt için doğal olarak `404` üretir, T035 bulgusu), `204` yanıtı — `backend/src/interview/interview.controller.ts` (mevcut dosyaya **ek**, T038'e bağlı) ✅ Tamamlandı.
- [X] T040 [P] [US4] `deleteInterview(id)` fetch sarmalayıcısını `interview-client.ts`'e ekle (T007 ile aynı görev — Faz 2'de erken yapılmadıysa burada tamamlanır) — `frontend/src/lib/interview-client.ts` ✅ Tamamlandı (T007'de yapıldı).
- [X] T041 [P] [US4] `delete-confirm-dialog.tsx` bileşeni (shadcn/ui `AlertDialog`): geri dönüşü olmayan işlem uyarısı + onay/iptal butonları (FR-010) — `frontend/src/components/interview/delete-confirm-dialog.tsx` ✅ Tamamlandı.
- [X] T042 [US4] `interview-card.tsx`'e (T015) "Sil" aksiyonu ekle: `delete-confirm-dialog.tsx` (T041) açar, onayda `deleteInterview()` (T040) çağırır, başarılı yanıtta listeden anında kaldırır (iyimser/optimistic güncelleme, `list.tsx`'teki state'i günceller) — `frontend/src/components/interview/interview-card.tsx`, `frontend/src/pages/interview/list.tsx` ✅ Tamamlandı (kart artık `<div>` köke alındı, `<Link>` yalnızca içerikte — Sil butonu geçersiz nested-interactive HTML'den kaçınır).
- [X] T043 [US4] Silinmiş görüşmenin eski "Devam Et"/"Detay" bağlantısına erişimde uygun hata ekranı gösterildiğini doğrula (mevcut `GET` uç noktalarının soft-delete filtresi zaten uygular — bu görev yalnızca frontend hata ekranı entegrasyonunu teyit eder, T025) (FR-011 edge case) ✅ Doğrulandı: backend testi (history-delete.spec.ts son senaryo) silme sonrası GET'in 404 döndüğünü kanıtlıyor; frontend `ErrorRetry` bu mesajı zaten gösteriyor (T025).

**Checkpoint**: User Story 1, 2, 3 VE 4 birlikte bağımsız çalışır durumda.

---

## Faz 7: User Story 5 - Rapor dışa aktarımı ve skor trendi (Priority: P4)

**Hedef**: Kullanıcı Görüşme Detayı ekranından raporunu PDF olarak indirebilir; "Interview
History" sekmesinde aynı pozisyon için tamamlanmış/raporlu birden fazla görüşmesi varsa
skorların zaman içindeki değişimini gösteren bir trend grafiği görüntüleyebilir.

**Bağımsız Test Kriteri**: Tamamlanmış birden fazla raporlu görüşme kaydıyla PDF dışa
aktarımının çalıştığı ve trend grafiğinin doğru skorları çizdiği ayrı ayrı doğrulanarak
test edilebilir; diğer hikâyelerden bağımsız (ayrı bir dal olarak) geliştirilebilir
(spec.md Hikâye 5).

### Araştırma/Karar Görevi (implementasyon öncesi)

- [X] T044 [US5] PDF kütüphane seçimi: istemci tarafı üretim seçeneklerini (`jspdf`, `jspdf` + `html2canvas`, `react-to-print`) değerlendir; mimari etki yok (yeni backend uç noktası/tablo gerektirmez, research.md §6), tek kriter mevcut rapor verisinin (skorlar + metinsel geri bildirim) doğru biçimlendirilmesi; kısa bir karar notu yaz ve gerekirse `docs/DECISIONS.md`'ye küçük bir ADR taslağı ekle — `specs/004-history/research-pdf-karar.md` (+ `docs/DECISIONS.md` güncellemesi, gerekirse) ✅ Tamamlandı: `jspdf` (tek başına) seçildi, ayrı ADR gerekmedi (gerekçe belgede).

### Testler için User Story 5 ⚠️ ÖNCE YAZ, ÖNCE KIRMIZI GÖR (T044 sonrası)

- [X] T045 [P] [US5] Vitest+RTL: "PDF olarak indir" butonu seçilen kütüphaneyle (T044) dosya indirme tetikler, rapor skorları + metinsel geri bildirim içerir (FR-016) — `frontend/test/pdf-export-button.test.tsx` ✅ Tamamlandı.
- [X] T046 [P] [US5] Vitest+RTL: aynı `position` için birden fazla tamamlanmış/raporlu kayıt varken `ScoreTrendChart` doğru veri noktalarını (skor × tarih) çizer; tek kayıt/pozisyon eşleşmesi yokken grafik gizlenir (FR-017) — `frontend/test/score-trend-chart.test.tsx` ✅ Tamamlandı (`findTrendCandidates`/`computeScoreTrend` saf fonksiyon testleri + bileşen render testi).
- [ ] T047 [P] [US5] Playwright e2e: S5 senaryosu (PDF indirme, trend grafiği görüntüleme) — `frontend/test/e2e/interview-history-export-trend.spec.ts` — henüz yazılmadı (gerçek tarayıcı/dev-server gerektirir)

### Implementasyon for User Story 5

- [X] T048 [P] [US5] `pdf-export-button.tsx` bileşeni: T044'te seçilen kütüphaneyle rapor içeriğinden (skorlar + metinsel geri bildirim) istemci tarafında PDF üretir, yeni backend uç noktası gerektirmez (FR-016) — `frontend/src/components/interview/pdf-export-button.tsx` ✅ Tamamlandı.
- [X] T049 [P] [US5] `computeScoreTrend` yardımcı fonksiyonu: **revize edilen kaynak** — `listInterviews()` yanıtı skor İÇERMEZ (yalnızca özet alanlar, contracts/interview-api.md §2, implementasyon sırasında bulundu); `findTrendCandidates()` liste yanıtından aday pozisyon grubunu (≥2 tamamlanmış+raporlu) bulur, ardından **her aday için `getInterview()` ile detay çekilip** skorlar elde edilir, `computeScoreTrend()` saf fonksiyonu tarihe göre sıralı Recharts veri şekline dönüştürür — `frontend/src/lib/score-trend.ts`
- [X] T050 [P] [US5] `score-trend-chart.tsx` bileşeni: Recharts (ADR-0011, `report.tsx`'te zaten kullanımda, yeni bağımlılık yok) ile `computeScoreTrend` (T049) çıktısını çizgi grafik olarak render eder — `frontend/src/components/interview/score-trend-chart.tsx` ✅ Tamamlandı.
- [X] T051 [US5] `pdf-export-button.tsx`'i (T048) `report.tsx`'e (T032) entegre et — `frontend/src/pages/interview/report.tsx` ✅ Tamamlandı.
- [X] T052 [US5] `score-trend-chart.tsx`'i (T050) `list.tsx`'e (T017) entegre et (aynı pozisyon için ≥2 tamamlanmış/raporlu kayıt olduğunda gösterilir) — `frontend/src/pages/interview/list.tsx` ✅ Tamamlandı (`findTrendCandidates` + paralel `getInterview` çağrılarıyla).

**Checkpoint**: Tüm 5 kullanıcı hikâyesi bağımsız olarak işlevsel — MVP kapsamı tamamlandı.

---

## Faz 8: Cilalama & Çapraz Kesişen Konular

**Amaç**: Tüm hikâyeleri etkileyen son iyileştirmeler.

- [X] T053 [P] Erişilebilirlik geçişi: `AlertDialog` odak tuzağı (focus trap), durum rozeti/kart aksiyon butonlarında `aria-label` kontrolü — `frontend/src/components/interview/` ✅ Tamamlandı: `AlertDialog` (Radix) odak tuzağını yerleşik sağlıyor; `DeleteConfirmDialog`'a `itemLabel` eklendi — "Sil" butonlarının erişilebilir adı artık pozisyona özgü ("X görüşmesini sil"), listede aynı-metinli birden fazla buton ekran okuyucuda ayırt edilebilir.
- [X] T054 [P] `docs/API_CONVENTIONS.md` §4.3'ün `DELETE /api/interviews/:id` sahipliğini (bu dilim) doğru yansıttığını doğrula (salt-okunur kontrol; sapma varsa yalnızca not, bu dilim dokümanı değiştirmez çünkü ortak sözleşme dosyasıdır — değişiklik gerekiyorsa ayrı bir küçük PR/onay ile yapılır) ✅ Doğrulandı, sapma yok — dosya değiştirilmedi.
- [ ] T055 `quickstart.md` S1-S5 tüm senaryolarının uçtan uca manuel doğrulaması (checklist tamamlama) — henüz yapılmadı (gerçek tarayıcı/dev-server gerektirir)
- [X] T056 [P] `case-study/AI_DEVLOG.md` güncellemesi: `004-history` tasks fazı çıktısı (İlke I) ✅ Tamamlandı — 2026-08-03 12:20 kaydı eklendi.
- [X] T057 Backend `DELETE` uç noktası eklemesinin (T038-T039) `002-interview` ekibiyle koordine edilmiş ayrı bir PR olarak açılması ve o dilimin PR'ı merge olduktan sonra rebase edilmesi (plan.md "Proje Yapısı" koordinasyon kararı) — kapsam değişti: `002-interview` bu oturumdan önce zaten `main`'e merge olmuştu (`005-interview-dikeyi-implementasyon`), koordinasyon/rebase ihtiyacı ortadan kalktı; `DELETE` doğrudan mevcut `interview.controller.ts`/`interview.service.ts`'e eklendi.

---

## Bağımlılıklar & Yürütme Sırası

### Faz Bağımlılıkları

- **Kurulum (Faz 1)**: Bağımlılık yok — hemen başlayabilir.
- **Foundational (Faz 2)**: Faz 1 tamamlanmasına bağlı — TÜM kullanıcı hikâyelerini BLOKLAR.
- **Kullanıcı Hikâyeleri (Faz 3-7)**: Tümü Foundational (Faz 2) tamamlanmasına bağlı.
  - US1 (Faz 3): Bağımsız, hemen başlayabilir.
  - US2 (Faz 4): US1'in ürettiği `InterviewCard` (T015) bileşenine aksiyon ekler — US1 sonrası (veya paralel, `InterviewCard` iskeleti T015 hazırsa).
  - US3 (Faz 5): US1'in `InterviewCard` (T015) bileşenine aksiyon ekler — US1 sonrası (veya paralel).
  - US4 (Faz 6): US1'in `InterviewCard` (T015) bileşenine aksiyon ekler ve backend'e yeni uç nokta ekler — US1 sonrası; backend kısmı (T038-T039) diğer story'lerden bağımsız paralel ilerleyebilir.
  - US5 (Faz 7): US3'ün detay sayfasına (T032) ve US1'in liste sayfasına (T017) entegre olur — US1 VE US3 sonrası.
- **Cilalama (Faz 8)**: Tüm istenen kullanıcı hikâyelerinin tamamlanmasına bağlı.

### Kullanıcı Hikâyesi Bağımlılıkları

- **US1 (P1)**: Foundational sonrası başlayabilir — diğer hikâyelere bağımlılık yok.
- **US2 (P2)**: Foundational sonrası başlayabilir; `InterviewCard` (T015, US1) üzerine aksiyon ekler — bağımsız test edilebilir kalır (kendi testleri US1'in varlığını varsaymaz, yalnızca bileşen entegrasyonu paylaşılır).
- **US3 (P2)**: Foundational sonrası başlayabilir; `InterviewCard` (T015, US1) üzerine aksiyon ekler — bağımsız test edilebilir kalır.
- **US4 (P3)**: Foundational sonrası başlayabilir; backend kısmı (T038-T039) tamamen bağımsız paralel ilerleyebilir; frontend kısmı `InterviewCard` (T015) üzerine aksiyon ekler.
- **US5 (P4)**: US1 (liste, T017) VE US3 (detay, T032) sayfalarının var olmasına bağımlı — bu ikisi tamamlanmadan entegre edilemez, ancak bileşenleri (T048-T050) paralel geliştirilebilir.

### Her Kullanıcı Hikâyesi İçinde

- Testler (Vitest/RTL, Playwright, Jest/Supertest) **İLK** yazılır ve **KIRMIZI** görülür (İlke III, ATDD).
- Bileşenler servislerden/hook'lardan önce değil, birlikte modelle uyumlu sırada gelişir.
- Story tamamlanmadan bir sonraki önceliğe geçilmez (MVP artımlı teslim stratejisi).

### Paralel Fırsatlar

- Faz 1'deki tüm `[P]` görevler (T002-T005) paralel çalışabilir.
- Faz 2'deki `[P]` görevler (T007, T008, T009, T011) paralel çalışabilir.
- Her hikâyenin test görevleri (`[P]` işaretli) paralel yazılabilir.
- US1 tamamlandıktan sonra US2, US3, US4 (backend kısmı) paralel ekiplerce çalışılabilir.
- US5'in bileşen görevleri (T048, T049, T050) paralel geliştirilebilir; yalnızca sayfa entegrasyonu (T051, T052) sıralı ve US1/US3'e bağımlıdır.

---

## Paralel Örnek: User Story 1

```bash
# User Story 1 testlerini birlikte başlat:
Task: "Vitest+RTL: kart listesi doğru pozisyon/tarih/level rozeti render eder — frontend/test/interview-list.test.tsx"
Task: "Vitest+RTL: boş durum mesajı + CTA render edilir — frontend/test/interview-list.test.tsx"
Task: "Playwright e2e: S1 senaryosu — frontend/test/e2e/interview-history-list.spec.ts"

# User Story 1 bileşenlerini birlikte başlat (mevcut dosyalara ek):
Task: "interview-card.tsx'e level rozeti — frontend/src/components/interview/interview-card.tsx"
Task: "list.tsx boş durum netliği — frontend/src/pages/interview/list.tsx"
```

## Paralel Örnek: User Story 4 (backend + frontend eşzamanlı)

```bash
# Backend (koordinasyonlu ayrı PR) ve frontend paralel:
Task: "Jest+Supertest DELETE /api/interviews/:id entegrasyon testi — backend/test/integration/history-delete.spec.ts"
Task: "Vitest+RTL DeleteConfirmDialog onay/iptal testi — frontend/test/delete-confirm-dialog.test.tsx"
Task: "delete-confirm-dialog.tsx bileşeni — frontend/src/components/interview/delete-confirm-dialog.tsx"
```

---

## Implementasyon Stratejisi

### MVP Önce (User Story 1 Tek Başına)

1. Faz 1: Kurulum & Devralma Doğrulaması tamamla.
2. Faz 2: Foundational tamamla (KRİTİK — tüm hikâyeleri bloklar).
3. Faz 3: User Story 1 tamamla.
4. **DUR ve DOĞRULA**: User Story 1'i bağımsız test et (quickstart.md S1).
5. Hazırsa demo/deploy et.

### Artımlı Teslimat

1. Kurulum + Foundational tamamla → Temel hazır.
2. User Story 1 ekle → Bağımsız test et → Deploy/Demo (MVP kart listeleme!).
3. User Story 2 ekle (resume) → Bağımsız test et → Deploy/Demo.
4. User Story 3 ekle (detay) → Bağımsız test et → Deploy/Demo.
5. User Story 4 ekle (silme, backend PR koordinasyonlu) → Bağımsız test et → Deploy/Demo.
6. User Story 5 ekle (PDF/trend) → Bağımsız test et → Deploy/Demo.
7. Her hikâye, öncekini bozmadan değer ekler.

### Paralel Ekip Stratejisi

Birden fazla geliştiriciyle:

1. Ekip birlikte Kurulum + Foundational'ı tamamlar.
2. Foundational bitince:
   - Geliştirici A: User Story 1 (liste) — MVP kritik yol.
   - Geliştirici B: User Story 4 backend kısmı (T038-T039, `002-interview` ekibiyle koordineli ayrı PR) — frontend'den bağımsız ilerleyebilir.
   - Geliştirici C: User Story 5 araştırma (T044) ve bileşen iskeleti (T048-T050) — US1/US3 sayfa entegrasyonunu bekler ama bileşenler paralel yazılabilir.
3. US1 tamamlanınca US2/US3/US4-frontend paralel devam edebilir.

---

## Notlar

- `[P]` görevler = farklı dosyalar, tamamlanmamış göreve bağımlılık yok.
- `[Hikâye]` etiketi görevi ilgili kullanıcı hikâyesine izlenebilir kılar.
- Her kullanıcı hikâyesi bağımsız tamamlanabilir ve test edilebilir olmalıdır.
- Testlerin **önce kırmızı** göründüğünü doğrula (İlke III, ATDD — pazarlık edilemez).
- Her görev veya mantıksal grup sonrası commit at (`docs`/`feat`/`test` Conventional Commit, Türkçe, ASCII-only).
- Herhangi bir checkpoint'te durup hikâyeyi bağımsız doğrula.
- Kaçınılması gerekenler: belirsiz görevler, aynı dosyada çakışan `[P]` görevler, bağımsızlığı bozan story-arası çapraz bağımlılıklar, `specs/002-interview/**`/`specs/003-pre-assessment/**` dosyalarına dokunmak.
