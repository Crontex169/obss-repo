---

description: "Ön Yetkinlik Değerlendirmesi (Pre-assessment) dikey dilimi için görev listesi"
---

# Görevler: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Girdi**: `specs/003-pre-assessment/` tasarım dokümanları

**Ön Koşullar**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) — hata zarfı (§2), `404` kuralı (§1), LLM çağrı sözleşmesi/timeout/hız sınırı (§3), `TokenUsage`/dil (§4).

**Testler**: **ZORUNLU** — Anayasa İlke III (Test-Öncelikli/ATDD, PAZARLIK EDİLEMEZ).

**Organizasyon**: Görevler kullanıcı hikâyesine göre gruplanmıştır.

---

## ⚠️ BLOKLAYICI ÖN KOŞUL — İKİ dikey merge edilmeden başlama

Bu dilim **üçüncü** dikey dilimdir. Implementasyon sırası: **`001-auth-rol` → `002-interview` → `003-pre-assessment`**.

**Faz 1'e başlamadan önce `001-auth-rol` VE `002-interview` main'e merge edilmiş olmalıdır.**

Bu dilim şu dosyalara **DOKUNMAZ**: `backend/src/auth/**`, `backend/src/llm/**`, `backend/src/common/**`, `backend/src/interview/**`. Hepsinden yalnızca içe aktarım yapar.

---

## 📥 Bu dilim cross-cutting altyapıyı DEVRALIR (yeniden kurmaz)

Aşağıdaki bileşenlerin **tasarım sahibi bu dilimdir** (`contracts/llm-contract.md`, `data-model.md`), ancak implementasyon sırası gereği **`002-interview` onları inşa etmiştir**. Bu dilim yalnızca kullanır:

| Devralınan | Dosya | Bu dilimde ne yapılır |
|-----------|-------|------------------------|
| `LlmModule` + `generateStructured()` | `backend/src/llm/llm.service.ts` | `imports` edilir; kendi prompt + Zod şeması verilir |
| `LlmProvider` port + OpenAI-uyumlu adapter | `backend/src/llm/providers/**` | Değiştirilmez (ADR-0007) |
| Hata sınıfları | `backend/src/llm/llm.errors.ts` | Yakalanır → kullanıcıya zarif hata (FR-008) |
| Katman-1 şema üreticisi | `backend/src/llm/schema-to-provider.ts` | Değiştirilmez |
| `TokenUsageService` + `TokenUsage` tablosu | `backend/src/llm/token-usage.service.ts` | `operation: pre_assessment` + `preAssessmentId` ile yazılır (FR-010) |
| Dil çözümleyici | `backend/src/common/language.ts` | `Accept-Language` → `tr`\|`en` (FR-017) |
| LLM hız sınırı guard'ı | `backend/src/common/guards/llm-rate-limit.guard.ts` | **5/saat** yapılandırmasıyla kullanılır (FR-013) |
| Ortak hata zarfı filtresi | `backend/src/common/http-exception.filter.ts` | Değiştirilmez (§2) |
| `openai`, `zod-to-json-schema`, `LLM_*` env, `LLM_MODEL` spike | `backend/package.json`, `.env` | Kurulu/belirlenmiş gelir |

⚠️ **Devralınan bir bileşen sözleşmeden sapmışsa bu dilim onu YENİDEN YAZMAZ** — düzeltme `002-interview` kapsamında yapılır ve `docs/API_CONVENTIONS.md` güncellenir (T001).

**Bu dilime ÖZGÜ olan**: `PreAssessment` + `CompetencyReport` modelleri, **partial unique index**, `pre-assessment/` modülü, frontend Pre-assessment sekmesi, opsiyonel `skillSelections` (FR-002a, bkz. Faz 11).

---

## Biçim: `[ID] [P?] [Hikâye] Açıklama`

- **[P]**: Paralel çalıştırılabilir (farklı dosyalar, tamamlanmamış göreve bağımlılık yok)
- **[Hikâye]**: US1…US5 → spec.md Hikâye 1…5
- Açıklamalarda kesin dosya yolları belirtilir

## Yol Kuralları (plan.md — Web uygulaması yapısı)

- Backend: `backend/src/pre-assessment/`, `backend/prisma/`, `backend/test/`
- Frontend: `frontend/src/pages/`, `frontend/src/components/pre-assessment/`, `frontend/src/lib/api/`
- Ortak sırlar: kök `.env.example`

## Kilitli Teknoloji Yığını (ADR-0001…0005, ADR-0007)

NestJS + PostgreSQL 16 + Prisma 6.19.3 (backend); React 19 + Vite + Tailwind 4 + shadcn/ui (frontend). LLM: **Groq (birincil) + DeepSeek (yedek)**, tek `openai` SDK (ADR-0007). Şema: `zod` + `zod-to-json-schema`. Testler: Jest + Supertest (backend), Vitest + RTL (frontend).

**Bu dilimin eklediği yeni backend bağımlılığı: 0** — hepsi `002-interview`'den devralınır.

## Kullanıcı Hikâyesi ↔ Faz Eşlemesi (öncelik sırasıyla)

| Faz | Hikâye | Başlık | Öncelik |
|-----|--------|--------|---------|
| 3 | US1 | Form Doldurma ve Rapor Alma | P1 🎯 MVP |
| 4 | US3 | LLM Hatasında Zarif Davranış | P1 |
| 5 | US2 | Görüntüleme, Yeniden Değerlendirme, Arşiv | P1 |
| 6 | US4 | Erişim Denetimi ve Sahiplik | P1 |
| 7 | US5 | Token ve Maliyet Kaydı | P2 |

> **Sıralama gerekçesi:** US3 (hata yolları) US1 ile **aynı uç noktayı** paylaşır; mutlu yolun hemen ardından gelir. US4 (erişim denetimi) US2'den sonradır çünkü sahiplik/`404` kuralları `GET /:id` uç noktası olmadan test edilemez — temel oturum kontrolü (`401`) US1'de baştan uygulanır.

---

## Faz 1: Kurulum & Devralma Doğrulaması

**Amaç**: Devralınan altyapının sözleşmeye uygun olduğunu doğrulamak ve bu dilime özgü iskeleti kurmak. **Yeni LLM altyapısı YAZILMAZ.**

- [x] T001 **Devralma doğrulaması (İLK GÖREV)**: Şunların mevcut ve `docs/API_CONVENTIONS.md` §3-§4'e uygun olduğunu doğrula — `LlmService.generateStructured()` imzası (`schema`, `systemPrompt`, `userData`, `timeoutMs?`, `operation`, `userId`, `preAssessmentId?`), `llm.errors.ts` üç sınıfı, `schema-to-provider.ts` katman-1 davranışı, `token-usage.service.ts`, `common/language.ts`, `common/guards/llm-rate-limit.guard.ts`, `common/http-exception.filter.ts`, `TokenUsage` tablosu + `LlmOperation.pre_assessment` + `ReportLanguage` + `ExperienceLevel` enum'ları, `backend/test/fakes/fake-llm.provider.ts`. **Sapma varsa bu dilimde düzeltme YAPMA** — bulguları not et, düzeltme `002-interview` kapsamındadır — `specs/003-pre-assessment/devralma-dogrulama.md`
- [x] T002 [P] `.env` doğrulaması: `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (spike sonucu **dolu**), `LLM_REQUEST_TIMEOUT_MS` mevcut; eksikse `002-interview`'in `.env.example`'ından tamamla — kök `.env.example`, `backend/src/config/env.validation.ts`
- [ ] T003 [P] Frontend veri çekme bağımlılığını doğrula/kur: TanStack Query (yoksa bu dilimin **tek** yeni bağımlılığıdır) — `frontend/package.json`
- [ ] T004 [P] Klasör iskeletini oluştur: `backend/src/pre-assessment/` (+ `dto/`, `schemas/`, `prompts/`, `guards/`), `frontend/src/components/pre-assessment/`

---

## Faz 2: Temel Altyapı (Bloklayıcı Ön Koşullar)

**Amaç**: Bu dilime **özgü** veri katmanı ve hız sınırı yapılandırması.

**⚠️ KRİTİK**: Bu faz tamamlanmadan hiçbir kullanıcı hikâyesi işine başlanamaz.

### 2a. Veri Katmanı (bu dilime özgü)

- [ ] T005 Bu dilime özgü Prisma enum'larını tanımla: `InterestArea` (`frontend`|`backend`|`ml`), `PreAssessmentStatus` (`generating`|`completed`|`failed`), `ConfidenceLevel` (`dusuk`|`orta`|`yuksek`). **`ExperienceLevel`, `ReportLanguage`, `LlmOperation` mevcuttur** (002-interview kurdu) — yalnızca `LlmOperation.pre_assessment` değerinin varlığını doğrula, yeniden tanımlama — `backend/prisma/schema.prisma` (data-model.md)
- [ ] T006 Prisma modellerini ekle: `PreAssessment`, `CompetencyReport`; `User` modeline **yalnızca** `preAssessments` ilişki satırını ekle. `TokenUsage.preAssessmentId` alanı **zaten var** — yalnızca ters ilişkiyi (`tokenUsages PreAssessment[]` tarafı) bağla; auth ve interview bloklarına **dokunma** — `backend/prisma/schema.prisma`
- [x] T007 Migration üret ve uygula (`npx prisma migrate dev`) — `backend/prisma/migrations/` (T005, T006'ya bağlı)
- [x] T008 **⚠️ PARTIAL UNIQUE INDEX'i migration SQL'ine ELLE ekle** — Prisma DSL bunu üretemez, bu satır olmadan **FR-004 / SC-007 karşılanmaz**: `CREATE UNIQUE INDEX "pre_assessment_one_active_per_user" ON "PreAssessment" ("userId") WHERE "isActive" = true;` — `backend/prisma/migrations/<timestamp>_pre_assessment/migration.sql`
- [x] T009 Index'in veritabanında gerçekten oluştuğunu doğrulayan kontrol testi (`\d+ "PreAssessment"` çıktısında `pre_assessment_one_active_per_user` aranır) — `backend/test/integration/schema-constraints.spec.ts`

### 2b. Hız Sınırı Yapılandırması (yeni guard YAZILMAZ)

- [x] T010 Devralınan `LlmRateLimitGuard`'ı bu dilimin `POST` uç noktası için **5/saat/kullanıcı** olarak yapılandır — controller metodunda `@UseGuards(LlmRateLimitGuard)` + `@Throttle(llmQuota(5))` (interview deseni, `interview.controller.ts` §1/§4/§6'ya bkz.). Guard'ın kendisi `backend/src/common/guards/` altındadır ve **değiştirilmez**; bu dilime özgü sarmalayıcı guard dosyası **yazılmaz** — yapılandırma T023 ile aynı dosyada, `backend/src/pre-assessment/pre-assessment.controller.ts` (FR-013, §3.5)

### 2c. Modül İskeleti

- [x] T011 `PreAssessmentModule` iskeletini oluştur ve `app.module.ts`'ye kaydet (`LlmModule` zaten kayıtlı — yeniden kaydetme) — `backend/src/pre-assessment/pre-assessment.module.ts`, `backend/src/app.module.ts` (T007, T010'a bağlı)

**Kontrol Noktası**: Veri katmanı + hız sınırı hazır; devralınan LLM motoru doğrulanmış — hikâye implementasyonu başlayabilir.

---

## Faz 3: US1 - Form Doldurma ve Rapor Alma (Öncelik: P1) 🎯 MVP

**Amaç**: Oturum açmış kullanıcı ilgi alanı + seviye seçip yapılandırılmış, **skorsuz** bir yetkinlik raporu alır.

**Bağımsız Test**: Geçerli seçimlerle form gönderildiğinde rapor üretilir, kaydedilir ve ekranda gösterilir (quickstart.md — Hikâye 1 tablosu).

### US1 Testleri (ÖNCE yaz, başarısız olduklarını doğrula) ⚠️

- [x] T012 [P] [US1] Mutlu yol entegrasyon testi: `POST /api/pre-assessments` → `201`, rapor DB'ye yazılır, `isActive=true`, `status=completed` (H1-1) — `backend/test/integration/us1-create-happy.spec.ts`
- [x] T013 [P] [US1] Doğrulama hatası testleri: boş `interestAreas` / eksik `experienceLevel` → `400` (H1-2) — `backend/test/integration/us1-validation.spec.ts`
- [x] T014 [P] [US1] **Enum dışı değer → `400` ve LLM ÇAĞRILMAZ** (fake LLM çağrı sayacıyla doğrulanır) (H1-4, FR-003, SC-008) — `backend/test/integration/us1-enum-guard.spec.ts`
- [ ] T015 [P] [US1] Çoklu ilgi alanı: iki alan seçilirse `alanlar` dizisinde **tam olarak iki** eleman (H1-3) — `backend/test/integration/us1-multi-area.spec.ts`
- [ ] T016 [P] [US1] Katman-2 `superRefine` testi: `alanlar` kümesi ≠ `interestAreas` kümesi → `LlmSchemaError`, rapor kaydedilmez (FR-006) — `backend/test/unit/us1-report-schema.spec.ts`
- [x] T017 [P] [US1] **Skor alanı reddi** testi: LLM yanıtı fazladan `skor` alanı içerirse doğrulama başarısız olur (FR-006b, SC-010) — `backend/test/unit/us1-no-score.spec.ts`
- [ ] T018 [P] [US1] Frontend form testi: çoklu ilgi alanı + tekli seviye seçimi, boş gönderimde alan hatası (Vitest + RTL) — `frontend/test/assessment-form.spec.tsx`

### US1 Implementasyonu

- [ ] T019 [US1] Rapor Zod şemasını yaz (**katman 2**: `genelOzet` min 50 karakter, `alanlar` 1–3, alt listeler 1–6, `guvenSeviyesi` enum, `superRefine` ile alan kümesi eşitliği + tekrarsızlık). **Skor alanı YOK, `yolHaritasi` alanı YOK** (FR-006, 2026-08-03 clarify — bkz. T080). Nicelik kısıtlarının sağlayıcı şemasından çıkarıldığını, dolayısıyla **tek garantinin bu katman olduğunu** unutma (§3.3) — `backend/src/pre-assessment/llm/competency-report.schema.ts`
- [ ] T020 [P] [US1] İstek DTO'sunu yaz (zod: `interestAreas` en az 1 enum, `experienceLevel` tekli enum) — `backend/src/pre-assessment/dto/create-pre-assessment.dto.ts`
- [ ] T021 [US1] Prompt'u yaz: sabit sistem talimatı + kullanıcı verisinin `<aday_verisi>` bloğunda **izolasyonu** + `<dil>` parametresi (FR-012, İlke V, §5) — `backend/src/pre-assessment/llm/competency-report.prompt.ts`
- [x] T022 [US1] `PreAssessmentService.create()`: enum doğrulama → dil çözümleme (devralınan `common/language.ts`) → `generating` kaydı → `LlmService.generateStructured({ operation: 'pre_assessment', userId, preAssessmentId, ... })` → doğrulanmış raporu kaydet → `isActive=true` (FR-005) — `backend/src/pre-assessment/pre-assessment.service.ts` (T019, T021'e bağlı)
- [x] T023 [US1] `POST /api/pre-assessments` uç noktası; guard zinciri `SessionGuard` (sınıf-seviyesi) → `RolesGuard('user')` → `LlmRateLimitGuard(5/saat)` via `@UseGuards(LlmRateLimitGuard)` + `@Throttle(llmQuota(5))` (oturumsuz `401`) — `backend/src/pre-assessment/pre-assessment.controller.ts`
- [ ] T024 [P] [US1] Frontend API istemcisi (tipli; şema tipi backend Zod şemasından türetilir) — `frontend/src/lib/pre-assessment-client.ts`
- [ ] T025 [P] [US1] Form bileşeni: çoklu ilgi alanı (checkbox grubu) + tekli seviye (radio), gönderim sırasında kilitli — `frontend/src/components/pre-assessment/assessment-form.tsx`
- [x] T026 [P] [US1] İlerleme göstergesi bileşeni (FR-015, H1-5) — `frontend/src/components/pre-assessment/generation-state.tsx`
- [ ] T027 [P] [US1] Rapor görünümü: genel özet, alan başına güçlü/gelişim konuları, **AI rozeti + güven seviyesi** (FR-014). **Sayısal skor, grafik ve yol haritası bölümü YOK** (FR-006b, FR-006 — 2026-08-03 clarify, bkz. T082) — `frontend/src/components/pre-assessment/report-view.tsx`
- [x] T028 [US1] Pre-assessment form sayfası + navbar bağlantısı + route kaydı (`pages/interview/*` deseniyle aynı — sekme değil, gerçek route): form gönderiminden sonra aynı sayfada `generation-state` → `report-view` akışı — `frontend/src/pages/pre-assessment/new.tsx`, `frontend/src/App.tsx` (route: `/pre-assessment/new`)

**Kontrol noktası**: quickstart.md Hikâye 1 tablosu (1.1–1.10) uçtan uca geçmeli. MVP burada demo edilebilir.

---

## Faz 4: US3 - LLM Hatasında Zarif Davranış (Öncelik: P1)

**Amaç**: LLM hata verdiğinde kullanıcı ne olduğunu anlar ve tekrar deneyebilir; sistem sessizce başarısız olmaz, bozuk rapor kaydetmez.

**Bağımsız Test**: LLM yanıtı hata/boş/şema-dışı olacak şekilde fake'lendiğinde anlaşılır hata + "tekrar dene" sunulur; rapor kaydedilmez (quickstart.md — Hikâye 3 tablosu).

### US3 Testleri (ÖNCE yaz) ⚠️

- [x] T029 [P] [US3] Sağlayıcı hatası → `502`, `details.retryable: true`, `CompetencyReport` yazılmaz, `status=failed` (H3-1, §3.4) — `backend/test/integration/us3-provider-error.spec.ts`
- [x] T030 [P] [US3] Boş yanıt ve şema uyumsuzluğu → `502`; rapor kaydedilmez (H3-2) — `backend/test/integration/us3-schema-error.spec.ts`
- [x] T031 [P] [US3] Timeout → `504`; kullanıcı süresiz bekletilmez (H3-3, FR-008a, §3.2 — bu dilim varsayılan **30 sn** kullanır, override etmez) — `backend/test/integration/us3-timeout.spec.ts`
- [ ] T032 [P] [US3] **DeepSeek yapılandırmasıyla** şema-dışı yanıt: sağlayıcı garantisi olmadığı hâlde **katman 2 reddeder** (ADR-0007 / R2) — `backend/test/integration/us3-deepseek-schema-guard.spec.ts`
- [x] T033 [P] [US3] Ham sağlayıcı hata metni kullanıcıya **sızmaz**; yanıt zarfında stack trace / sağlayıcı yanıtı yok (§2) — `backend/test/integration/us3-error-leak.spec.ts`
- [ ] T034 [P] [US3] Frontend hata durumu testi: hata mesajı + "Tekrar dene" düğmesi görünür, **otomatik yeniden deneme tetiklenmez** (FR-008b) — `frontend/test/generation-error.spec.tsx`

### US3 Implementasyonu

- [x] T035 [US3] Hata eşlemesi: `LlmTimeoutError`→`504`, `LlmSchemaError`/`LlmProviderError`→`502` (§3.4); `failureReason` (`timeout`/`schema`/`provider`) kaydedilir; kullanıcıya anlaşılır mesaj (ortak zarf, §2) — `backend/src/pre-assessment/pre-assessment.service.ts`, `backend/src/pre-assessment/pre-assessment.controller.ts`
- [x] T036 [US3] Başarısızlık akışı: `status=failed`, `isActive=false`, `CompetencyReport` yazılmaz, **mevcut aktif rapor değiştirilmez** (FR-009) — `backend/src/pre-assessment/pre-assessment.service.ts`
- [x] T037 [US3] Frontend hata durumu + "Tekrar dene" düğmesi (yalnızca kullanıcı tetikli) — `frontend/src/components/pre-assessment/generation-state.tsx`

---

## Faz 5: US2 - Görüntüleme, Yeniden Değerlendirme, Arşiv (Öncelik: P1)

**Amaç**: Kullanıcı güncel raporunu tekrar görebilir, yeniden değerlendirme yapabilir; eski rapor silinmeden arşivlenir.

**Bağımsız Test**: Sekmeye tekrar girildiğinde LLM çağrısı yapılmadan rapor gelir; yeniden değerlendirmede yeni rapor aktif olur, eski geçmişte kalır (quickstart.md — Hikâye 2 tablosu).

### US2 Testleri (ÖNCE yaz) ⚠️

- [x] T038 [P] [US2] `GET /active` → `200` ve **LLM çağrılmaz** (fake çağrı sayacı 0) (H2-1) — `backend/test/integration/us2-get-active.spec.ts`
- [x] T039 [P] [US2] Yeniden değerlendirme: yeni kayıt `isActive=true`, eski kayıt **silinmez** `isActive=false` (H2-2, SC-009) — `backend/test/integration/us2-reassess-archive.spec.ts`
- [x] T040 [P] [US2] Geçmiş listesi tarihe göre azalan; `status=failed` kayıtlar **listede görünmez** (H2-3) — `backend/test/integration/us2-history.spec.ts`
- [x] T041 [P] [US2] Hiç değerlendirme yoksa `GET /active` → `204` (boş durum) (H2-4) — `backend/test/integration/us2-empty-state.spec.ts`
- [x] T042 [P] [US2] Başarısız yeniden değerlendirme **mevcut aktif raporu bozmaz** (H2-5) — `backend/test/integration/us2-failed-reassess.spec.ts`
- [ ] T043 [P] [US2] **⚠️ EŞZAMANLILIK testi**: aynı kullanıcıyla paralel iki `POST` → biri `201`, diğeri `409`; `isActive=true` satır sayısı **tam 1** (FR-004, SC-007 — **T008 index'ini doğrular**) — `backend/test/integration/us2-concurrency.spec.ts`
- [x] T044 [P] [US2] Arşivlenmiş rapor **üretildiği dilde** döner; kullanıcının güncel dil tercihi uygulanmaz (FR-019, §4.2) — `backend/test/integration/us2-archive-language.spec.ts`
- [ ] T045 [P] [US2] Frontend geçmiş listesi testi: sıralı liste, satır tıklanınca detay — `frontend/test/report-history.spec.tsx`

### US2 Implementasyonu

- [x] T046 [US2] Okuma uç noktaları: `GET /active` (`200`/`204`), `GET /` (cursor sayfalama, `failed` hariç), `GET /:id` — `backend/src/pre-assessment/pre-assessment.controller.ts`
- [x] T047 [US2] Yeniden değerlendirme akışı **tek transaction**: eski aktif kayıt `isActive=false` + yeni kayıt `isActive=true` (FR-009a) — `backend/src/pre-assessment/pre-assessment.service.ts`
- [x] T048 [US2] Prisma `P2002` (unique violation) → `409 Conflict` eşlemesi (ortak hata zarfıyla) — `backend/src/pre-assessment/pre-assessment.service.ts`
- [x] T049 [P] [US2] Frontend geçmiş listesi bileşeni + `list.tsx`/`report.tsx` route sayfaları (`report-history.tsx`'i `list.tsx` içinde kullan; satır tıklamasında `GET /:id` ile `report.tsx`'e git; `App.tsx`'e `/pre-assessments` ve `/pre-assessment/:id` route'larını ekle) — `frontend/src/components/pre-assessment/report-history.tsx`, `frontend/src/pages/pre-assessment/list.tsx`, `frontend/src/pages/pre-assessment/report.tsx`, `frontend/src/App.tsx`
- [ ] T050 [P] [US2] Frontend durum mesajları: `204` boş durum (hiç değerlendirme yok) `list.tsx`'te, `409` / `429` (eşzamanlı/hız sınırı) `new.tsx`'te (form kilidi + tekrar dene ile birlikte) — `frontend/src/pages/pre-assessment/list.tsx`, `frontend/src/pages/pre-assessment/new.tsx`

---

## Faz 6: US4 - Erişim Denetimi ve Sahiplik (Öncelik: P1)

**Amaç**: Yalnızca oturum açmış kullanıcılar erişir; kullanıcı yalnızca kendi raporunu görür; admin tümünü **salt okunur** görür.

**Bağımsız Test**: Oturumsuz istek reddedilir, B kullanıcısı A'nın kaydına erişemez, admin erişir ama yazamaz (quickstart.md — Hikâye 4 tablosu).

### US4 Testleri (ÖNCE yaz) ⚠️

- [x] T051 [P] [US4] Oturumsuz istek → tüm uç noktalarda `401` (H4-1) — `backend/test/integration/us4-unauthenticated.spec.ts`
- [x] T052 [P] [US4] **Sızıntı önleme**: B kullanıcısı A'nın `id`'siyle `GET /:id` → **`404`** (`403` DEĞİL); yanıt "kayıt yok" durumundan **ayırt edilemez** (H4-2, §1) — `backend/test/integration/us4-ownership-404.spec.ts`
- [x] T053 [P] [US4] Kendi kaydı `200`; admin başkasının kaydını `200` içerikle okur (H4-3, H4-4) — `backend/test/integration/us4-read-access.spec.ts`
- [x] T054 [P] [US4] **Admin salt okunur**: admin `POST /api/pre-assessments` → `403` (H4-5, FR-011a, §1) — `backend/test/integration/us4-admin-readonly.spec.ts`
- [ ] T055 [P] [US4] İstemci kontrolü atlatılarak doğrudan istek → sunucu reddeder (H4-6, İlke V) — `backend/test/integration/us4-server-side-authz.spec.ts`

### US4 Implementasyonu

- [x] T056 [US4] Sahiplik kontrolü: kayıt başkasına aitse **`NotFoundException`** fırlat (`ForbiddenException` değil — §1) — `backend/src/pre-assessment/pre-assessment.service.ts`
- [x] T057 [US4] `POST` uç noktasına `@Roles('user')` uygula; admin `403` alır — `backend/src/pre-assessment/pre-assessment.controller.ts`
- [x] T058 [US4] Admin `?userId=` sorgu parametresi: yalnızca `role=admin` için geçerli; `role=user` gönderirse **yok sayılır** — `backend/src/pre-assessment/pre-assessment.controller.ts`

---

## Faz 7: US5 - Token ve Maliyet Kaydı (Öncelik: P2)

**Amaç**: Bu dilimin LLM çağrılarının token ve maliyeti **devralınan** `TokenUsageService` üzerinden doğru `operation` ve `preAssessmentId` ile kaydedilir (İlke VI). **Servisin kendisi `002-interview`'de yazıldı** — burada yalnızca bu dilime özgü entegrasyon ve doğrulama var.

**Bağımsız Test**: Başarılı ve başarısız üretimlerin ardından `operation='pre_assessment'` ve doğru `preAssessmentId` ile `TokenUsage` kaydı oluşur (quickstart.md — Hikâye 5 tablosu).

### US5 Testleri (ÖNCE yaz) ⚠️

- [x] T059 [P] [US5] Başarılı üretim → `TokenUsage` yazılır: `operation='pre_assessment'`, `preAssessmentId` dolu, `userId` doğru, `succeeded=true`, token sayıları > 0 (H5-1, SC-006, FR-010) — `backend/test/integration/us5-token-success.spec.ts`
- [x] T060 [P] [US5] Başarısız üretim → kayıt **yine oluşur**, `succeeded=false`; sağlayıcı usage döndürmediyse token `0` (H5-2) — `backend/test/integration/us5-token-failure.spec.ts`
- [ ] T061 [P] [US5] `TokenUsage` yazımı hata verirse **kullanıcı akışı bozulmaz** ama hata loglanır (sessiz yutma yok) (H5-3) — `backend/test/integration/us5-token-write-failure.spec.ts`
- [x] T062 [P] [US5] Kullanıcıya dönen `201` gövdesinde **token/maliyet alanı yok** (sözleşme — maliyet yalnızca admin dilimine açıktır) — `backend/test/integration/us5-no-cost-leak.spec.ts`
- [x] T063 [P] [US5] **Groq ücretsiz katman** doğrulaması: `provider='groq'` iken `estimatedCostUsd = 0` ama `inputTokens`/`outputTokens` **kaydedilir** (ADR-0007 / R1) — `backend/test/integration/us5-groq-zero-cost.spec.ts`

### US5 Implementasyonu

- [x] T064 [US5] `PreAssessmentService`'in `generateStructured()` çağrısına `operation: 'pre_assessment'`, `userId` ve `preAssessmentId`'yi geçirdiğini doğrula/tamamla — kayıt yazımı **motorun içinde** olur, bu dilim ayrı yazma kodu **eklemez** (§3.1, §4.1) — `backend/src/pre-assessment/pre-assessment.service.ts`
- [x] T065 [US5] Maliyet hesabı doğrulaması: devralınan fiyatlandırma `groq` için `0`, `deepseek` için ADR-0007'deki birim fiyatları uyguluyor mu — eksikse **`002-interview` kapsamında** düzelt ve T001 bulgularına ekle — `specs/003-pre-assessment/devralma-dogrulama.md`

---

## Faz 8: Cila & Kesişen Konular

**Amaç**: Hız sınırı doğrulaması, dil doğrulaması, doküman senkronizasyonu ve devlog

### Hız Sınırı (FR-013, SC-012)

- [x] T066 [P] Hız sınırı testi: aynı kullanıcıyla 6 ardışık `POST` → 6. istek `429` + `details.retryAfterSeconds` (SC-012, §3.5) — `backend/test/integration/rate-limit.spec.ts`
- [x] T067 [P] Hız sınırı **okuma uç noktalarını etkilemez**: `429` alındıktan sonra `GET /active` hâlâ `200` (FR-013) — `backend/test/integration/rate-limit-reads.spec.ts`
- [x] T068 [P] Hız sınırı **dikeyler arası izolasyon** testi: bu dilimin 5/saat sayacı `002-interview`'in sayaçlarından bağımsızdır (aynı guard, farklı yapılandırma — §3.5) — `backend/test/integration/rate-limit-isolation.spec.ts`

### Dil Doğrulaması (FR-017/018/019)

- [x] T069 [P] E2E dil testi: `Accept-Language: de-DE` → `language: "en"` ve İngilizce içerik (FR-017) — `backend/test/e2e/language.e2e-spec.ts`
- [x] T070 [P] **Alan adları çevrilmez** doğrulaması: `tr` ve `en` yanıtlarında şema alan adları ve `guvenSeviyesi` enum değeri aynı (FR-018, SC-011) — `backend/test/e2e/language-schema-stability.e2e-spec.ts`

### Doğrulama ve Doküman Senkronizasyonu

- [ ] T071 quickstart.md manuel doğrulama turunu baştan sona çalıştır ve sonuçları işaretle — `specs/003-pre-assessment/quickstart.md`
- [x] T072 [P] `docs/API_CONVENTIONS.md`'yi bu dilimin gerçek davranışıyla karşılaştır: `pre_assessment` operation kaydı, 5/saat sınırı, `404` sahiplik kuralı, hata zarfı, dil çözümlemesi — sapma varsa belgeyi güncelle — `docs/API_CONVENTIONS.md`
- [x] T073 [P] `002-interview` için **geri bildirim notu**: T001/T065'te bulunan devralma sapmaları (varsa) ve `LlmModule` yüzeyinde bu dilimin ihtiyaç duyduğu ama eksik kalan davranışlar — `specs/003-pre-assessment/devralma-dogrulama.md`
- [x] T074 `case-study/AI_DEVLOG.md`'yi bu dilim için güncelle: kullanılan AI aracı/model, iterasyonlar, ADR-0006→ADR-0007 değişimi, dikeyler arası çapraz analiz sonrası devralma modeline geçiş, zorluklar ve çözümleri, kullanılan skill'ler (Anayasa İlke I) — `case-study/AI_DEVLOG.md`
- [ ] T075 Güvenlik gözden geçirmesi: kullanıcı girdisinin `<aday_verisi>` bloğunda **veri olarak izole** edildiği (İlke V, §5), sırların yalnızca `.env`'den geldiği, hata zarfının sağlayıcı yanıtı sızdırmadığı (§2), yabancı kayıtta **daima `404`** (§1) — `backend/src/pre-assessment/`

> **Not:** Önceki sürümdeki `docs/APP_FLOW.md` ("tek seferlik" ifadesi, "yetkinlik skorları" ifadesi) ve `docs/PLAN.md` düzeltme görevleri, dikeyler arası çapraz analiz sırasında **tamamlandı** — bu listeden kaldırıldılar.

---

## Bağımlılıklar & Yürütme Sırası

### Faz Bağımlılıkları

```text
[001-auth-rol main'e merge] + [002-interview main'e merge] ← ZORUNLU ÖN KOŞUL
        ↓
Faz 1 (Kurulum & Devralma Doğrulaması) — T001 diğer her şeyden önce
        ↓
Faz 2 (Temel Altyapı) — ⚠️ TÜM hikâyeleri bloklar
        ↓
Faz 3 (US1) 🎯 MVP
        ↓
Faz 4 (US3) — US1 ile aynı uç noktayı paylaşır
        ↓
Faz 5 (US2) — GET uç noktalarını ekler
        ↓
Faz 6 (US4) — GET /:id var olmadan test edilemez
        ↓
Faz 7 (US5) — P2
        ↓
Faz 8 (Cila)
```

### Faz İçi Kritik Zincirler

- **T007 → T008 → T009 → T043**: Migration → partial index → index doğrulama → eşzamanlılık testi. **T008 atlanırsa T043 kesin başarısız olur ve FR-004 karşılanmaz.**
- **T001 → Faz 2 ve sonrası**: Devralma doğrulanmadan LLM kullanan hiçbir görev güvenilir değildir.
- **T019 → T022**: Rapor şeması olmadan servis akışı yazılamaz.
- **T021 → T022**: Prompt olmadan servis çağrısı tamamlanamaz.
- **T010 → T023**: Hız sınırı yapılandırması olmadan `POST` guard zinciri kurulamaz.

### Hikâyeler Arası Bağımlılıklar

- **US1** bağımsızdır (Faz 2 sonrası).
- **US3**, US1'in `POST` akışına bağlıdır — aynı servis metodu.
- **US2**, US1'in veri modeline bağlıdır; okuma uç noktalarını ekler.
- **US4**, US2'nin `GET /:id` uç noktasına bağlıdır.
- **US5**, devralınan `LlmService`/`TokenUsageService`'e bağlıdır; US1 sonrası bağımsız doğrulanabilir.

### Paralel Fırsatlar

- **Faz 1**: T002, T003, T004 birlikte (T001 önce bitmeli).
- **Faz 3**: T012–T018 test görevlerinin tamamı paralel; T024–T027 frontend görevleri paralel.
- **Her hikâye içinde**: `[P]` işaretli test görevleri tek seferde yazılır (farklı dosyalar), sonra hepsinin **Kırmızı** olduğu doğrulanır.
- **Frontend/backend**: T024–T027 (frontend) T022–T023 (backend) ile paralel yürüyebilir — sözleşme `contracts/pre-assessment-api.md`'de sabit.
- **Faz 8**: T066–T070 ve T072–T073 paralel.

---

## Paralel Örnek: US1

```bash
# US1 tüm testlerini birlikte başlat (önce yaz, başarısız olduklarını gör):
Task: "Mutlu yol — backend/test/integration/us1-create-happy.spec.ts"           # T012
Task: "Doğrulama hataları — backend/test/integration/us1-validation.spec.ts"    # T013
Task: "Enum guard + LLM çağrılmaz — backend/test/integration/us1-enum-guard.spec.ts"  # T014
Task: "Çoklu ilgi alanı — backend/test/integration/us1-multi-area.spec.ts"      # T015
Task: "Şema superRefine — backend/test/unit/us1-report-schema.spec.ts"          # T016
Task: "Skor alanı reddi — backend/test/unit/us1-no-score.spec.ts"               # T017

# US1 frontend görevlerini birlikte başlat:
Task: "API istemcisi — frontend/src/lib/pre-assessment-client.ts"               # T024
Task: "Form bileşeni — frontend/src/components/pre-assessment/assessment-form.tsx"  # T025
Task: "İlerleme göstergesi — frontend/src/components/pre-assessment/generation-state.tsx"  # T026
Task: "Rapor görünümü — frontend/src/components/pre-assessment/report-view.tsx" # T027
```

---

## Uygulama Stratejisi

### Önce MVP (Yalnızca US1)

1. `001-auth-rol` **ve** `002-interview` merge edildiğini doğrula
2. Faz 1: Kurulum & **Devralma Doğrulaması** (T001)
3. Faz 2: Temel Altyapı (KRİTİK — **T008 partial index'i atlama**)
4. Faz 3: US1 (form + rapor üretimi)
5. **DUR ve DOĞRULA**: quickstart.md Hikâye 1 tablosunu bağımsız test et
6. Hazırsa demo

### Artımlı Teslimat (öncelik sırası)

1. Kurulum + Temel Altyapı → devralınan LLM katmanı doğrulanmış, veri katmanı hazır
2. US1 → rapor üretimi → Demo (MVP!)
3. US3 → hata yolları → Demo (İlke VI kapısı)
4. US2 → görüntüleme + arşiv → Demo
5. US4 → erişim denetimi → Demo (İlke V kapısı)
6. US5 → token/maliyet doğrulaması → Demo (`005-admin` diliminin ön koşulu)
7. Cila → hız sınırı, dil, dokümanlar, devlog

### Not

- `[P]` = farklı dosyalar, bağımlılık yok
- `[Hikâye]` etiketi görevi izlenebilirlik için hikâyeye bağlar
- **Devralınan dosyalara dokunulmaz**: `backend/src/llm/**`, `backend/src/common/**` — sözleşme değişikliği önce `docs/API_CONVENTIONS.md`'de yapılır, kod düzeltmesi `002-interview` kapsamındadır
- Bu dilim **yeni backend bağımlılığı eklemez**; kuyruk, cache, ayrı LLM servisi, retry kütüphanesi ve state machine **eklenmez**

---

## Faz 10: İnceleme Bulguları (2026-07-31)

- [x] T076 [P] `checklists/requirements.md:44-47` bayat maddeleri temizle: `docs/APP_FLOW.md` maddeleri yapıldı; "dili iş ilanı metninden algılayarak" ifadesi de bayat (Bonus'a alındı) (bulgu I7)

### Not

Bu dilime dokunan diğer üç bulgunun sahibi `002-interview`, çünkü paylaşılan sözleşmeyi o dilim kuruyor
(`docs/API_CONVENTIONS.md`'ye yazılır, buradaki dosyalar ona göre düzeltilir):

- **I2** — `429` yükü: `contracts/pre-assessment-api.md:77,182`, `quickstart.md:170`, `research.md:147` `Retry-After` başlığı yazıyor; esas olan `details.retryAfterSeconds` → `002` **T104**
- **I8** — `details.retryable` yalnız bu dilimde tanımlı → `002` **T112**
- **I9** — rapor şeması alan adları Türkçe (`genelOzet`) ↔ `002` İngilizce (`overallImpression`) → `002` **T113**

---

## Faz 11: Clarify Bulguları (2026-08-03)

2026-08-03 clarify oturumunda (bkz. `spec.md` § Netleştirmeler) 3 karar alındı: (1) `FR-002a`
opsiyonel teknoloji/araç + Likert girdisi, (2) `FR-006`'dan öğrenme yol haritası kaldırıldı,
(3) `FR-016` tersine çevrildi (rapor içeriği artık `002-interview`'e context olarak veriliyor).
Aşağıdaki görevler mevcut Faz 2/3 görevlerini **günceller** (renumbered değil — Faz 10
deseniyle tutarlı, eskiler yerinde kalır, buradakiler onları değiştirir).

- [ ] T077 [P] [US1] `PreAssessment.skillSelections` (`Json?`, opsiyonel) Prisma alanını ekle
      + ilgi alanı başına kapalı teknoloji/araç listesini tanımlayan config dosyasını oluştur
      (ayrı tablo değil — bu ölçekte config yeterli) (FR-002a) — **T006'yı günceller** —
      `backend/prisma/schema.prisma`, `backend/src/pre-assessment/constants/skill-options.ts`
- [ ] T078 [US1] `create-pre-assessment.dto.ts`'ye opsiyonel `skillSelections[]` doğrulamasını
      ekle: her elemanın `interestArea`'sı seçili `interestAreas` kümesinde, `technology`'si
      o alana özgü kapalı listede, `selfRating`'i `1`-`5` tam sayı olmalı; herhangi biri
      ihlal edilirse `400` ve **LLM çağrılmaz** (FR-002a, FR-003 ile aynı disiplin) —
      **T020'yi günceller** — `backend/src/pre-assessment/dto/create-pre-assessment.dto.ts`
- [ ] T079 [US1] `competency-report.prompt.ts`'ye opsiyonel `teknoloji_ozdegerlendirmesi`
      bloğunu ekle — kullanıcı `skillSelections` girmediyse blok **tamamen atlanır** (boş
      dizi olarak da yazılmaz) (FR-002a, `llm-contract.md` §3) — **T021'i günceller** —
      `backend/src/pre-assessment/llm/competency-report.prompt.ts`
- [ ] T080 [US1] `competency-report.schema.ts`'den `yolHaritasi` alanını **KALDIR** (katman 1
      ve katman 2, `required` listesi dahil); zorunlu alanlar artık yalnızca `genelOzet`,
      `alanlar`, `guvenSeviyesi` (FR-006, 2026-08-03 clarify) — **T019'u günceller** —
      `backend/src/pre-assessment/llm/competency-report.schema.ts`
- [ ] T081 [P] [US1] Form bileşenine opsiyonel teknoloji/araç checklist (ilgi alanına göre
      filtrelenmiş) + 1-5 Likert alanlarını ekle; boş bırakılabilir olmalı (FR-002a) —
      **T025'i günceller** — `frontend/src/components/pre-assessment/assessment-form.tsx`
- [ ] T082 [US1] Rapor görünümünden **yol haritası bölümünü kaldır** (FR-006) —
      **T027'yi günceller** — `frontend/src/components/pre-assessment/report-view.tsx`
- [ ] T083 [P] [US1] Yeni test: `skillSelections` hiç gönderilmeden yapılan istek başarıyla
      tamamlanır, akış hiç etkilenmez (FR-002a opsiyonellik) —
      `backend/test/integration/us1-skill-selections-optional.spec.ts`
- [ ] T084 [P] [US1] Yeni test: geçersiz `selfRating` (1-5 dışı) veya kapalı liste dışı
      `technology` → `400`, **LLM çağrılmaz** (FR-002a, FR-003) —
      `backend/test/integration/us1-skill-selections-invalid.spec.ts`
- [ ] T085 [P] [US1] Şema regresyon testini güncelle: üretilen katman 1 JSON Schema'sının
      `yolHaritasi` alanını **içermediğini** doğrula (aksi hâlde sözleşme ile kod arasında
      sessiz kayma olur) — **T016/T017'yi günceller** — `backend/test/unit/us1-report-schema.spec.ts`

### Not — FR-016 (İnterview context transferi) bu dilimde yeni görev gerektirmiyor

`CompetencyReport` zaten Faz 2'de (`002-interview` tarafından okunabilir şekilde)
sorgulanabilir durumdadır — bu dilim context'i **üretmez**, yalnızca **okunabilir veri**
sağlar. Context'i okuyup soru üretim prompt'una ekleyen kod `002-interview` kapsamındadır
(bkz. `plan.md` § İleriye Dönük Bağımlılık, `contracts/llm-contract.md` §7) ve o dilimin
kendi `tasks.md`'sine — henüz yapılmamış bir clarify/tasks güncellemesiyle — ayrı görev
olarak eklenmelidir.

---

## Faz 12: Meslek-Bağımsızlık Kapsam Kararı (2026-08-04)

Uygulamanın tüm meslek gruplarına hitap etmesi gerektiği kararıyla (bkz. `spec.md`
§ Netleştirmeler → Oturum 2026-08-04, anayasa v1.2.0) ön değerlendirme girdisi ve rapor
şeması **baştan yeniden tasarlandı**. Bu faz, Faz 3 ve Faz 11'deki görevlerin bir kısmını
**geçersiz kılar** (renumbered değil — Faz 10/11 deseniyle tutarlı, eskiler yerinde kalır).

> ⛔ **Geçersiz kılınan görevler**: T077, T078, T079, T081, T083, T084 (hepsi
> `skillSelections` / `InterestArea` üzerineydi). Bu görevlerin ürettiği kod ve testler
> Faz 12'de kaldırılmıştır; tarihsel kayıt olarak listede bırakılmışlardır.

- [x] T086 [US1] Prisma: `InterestArea` enum'unu, `PreAssessment.interestAreas` ve
      `skillSelections` alanlarını **KALDIR**; yeni meslek-bağımsız enum'ları ekle
      (`ExperienceYears`, `WorkStatus`, `EducationLevel`, `WorkPreference`,
      `TeamPreference`, `LearningStyle`, `ProblemApproach`) + `selfRatings` (Json),
      `skills` (String[]), `openAnswers` (Json?), türetilmiş `experienceLevel`.
      `CompetencyReport`: `alanlar` → `gucluYonler`/`gelisimAlanlari`/`calismaTarziOzeti`
      (FR-002…FR-002d, FR-006) — **T005/T006/T077'yi geçersiz kılar** —
      `backend/prisma/schema.prisma` + yeni migration
- [x] T087 [P] [US1] `constants/skill-options.ts`'i **SİL**; yerine `self-rating-items.ts`
      (8 meslek-bağımsız ölçek maddesi, sunucu tarafı sabit) ve `skill-suggestions.ts`
      (yetenek **öneri** listesi — doğrulama listesi DEĞİL) ekle (FR-002a, FR-002b) —
      `backend/src/pre-assessment/constants/`
- [x] T088 [US1] `create-pre-assessment.dto.ts`'i yeniden yaz: yeni zorunlu enum alanları,
      `selfRatings` tam-8-madde + 1-5 doğrulaması, `skills` **serbest metin** (maks 15
      etiket × 40 karakter, tekilleştirme, boş etiket reddi), `openAnswers` (300'er
      karakter). `experienceLevel` istemciden gelirse **yok sayılır** (FR-002d) —
      **T020/T078'i geçersiz kılar** — `backend/src/pre-assessment/dto/create-pre-assessment.dto.ts`
- [ ] T089 [US1] **Serbest metin sanitizasyonu**: kontrol karakterlerini ve sınırlayıcı
      taklidi dizileri (`</aday_verisi>` vb.) temizleyen yardımcı; DTO doğrulamasından
      sonra, prompt'a girmeden önce uygulanır (FR-012, `llm-contract.md` §3) —
      `backend/src/pre-assessment/llm/sanitize.ts`
- [x] T090 [US1] `competency-report.prompt.ts`'i yeniden yaz: yeni sistem talimatı
      (meslek-bağımsızlık + injection sertleştirmesi kuralları) + yeni `<aday_verisi>`
      blok şekli; opsiyonel alanlar girilmemişse satırları **tamamen atlanır** —
      **T021/T079'u geçersiz kılar** — `backend/src/pre-assessment/llm/competency-report.prompt.ts`
- [x] T091 [US1] `competency-report.schema.ts`'i yeniden yaz: `alanlar` + `superRefine`
      kaldırılır; `gucluYonler`/`gelisimAlanlari` (2-6), `calismaTarziOzeti` (min 30),
      `genelOzet` (min 50), `guvenSeviyesi`. `.strict()` korunur (FR-006, FR-006b) —
      **T019/T080'i geçersiz kılar** — `backend/src/pre-assessment/llm/competency-report.schema.ts`
- [x] T092 [US1] `PreAssessmentService.create()`: `experienceLevel` türetimi
      (`experienceYears` → intern/junior/senior) + yeni alanların kaydı + yeni rapor
      alanlarının yazımı — **T022'yi günceller** — `backend/src/pre-assessment/pre-assessment.service.ts`
- [ ] T093 [P] [US1] Frontend istemci tipleri yeni istek/yanıt şekline göre —
      **T024'ü günceller** — `frontend/src/lib/pre-assessment-client.ts`,
      `frontend/src/lib/skill-suggestions.ts` (eski `skill-options.ts` silinir)
- [x] T094 [US1] `assessment-form.tsx`'i **tamamen yeniden yaz**: 6 çoktan seçmeli + 8
      maddelik 1-5 ölçek + **etiket girişi** (öneri listesinden seçim ve serbest yazım,
      istemci tarafı sınır göstergesi) + 3 açık uçlu alan — **T025/T081'i geçersiz kılar** —
      `frontend/src/components/pre-assessment/assessment-form.tsx`
- [x] T095 [P] [US1] `report-view.tsx`: `alanlar` bölümü yerine güçlü yönler / gelişim
      alanları / çalışma tarzı özeti — **T027/T082'yi günceller** —
      `frontend/src/components/pre-assessment/report-view.tsx`
- [x] T096 [P] [US1] Mevcut tüm `pa-*` testlerini yeni istek/yanıt şekline göre güncelle;
      `pa-us1-skill-selections-*.spec.ts` dosyalarını **sil** (T083/T084 geçersiz) —
      `backend/test/integration/`, `backend/test/unit/`, `frontend/test/`
- [x] T097 [P] [US1] **Yeni test — serbest metin izolasyonu**: yetenek etiketine/açık uçlu
      cevaba talimat benzeri metin ve sınırlayıcı taklidi (`</aday_verisi>`) yerleştirildiğinde
      rapor şemaya uygun kalır, blok yapısı bozulmaz (FR-012, SC-008a, H1-7) —
      `backend/test/integration/pa-us1-prompt-injection.spec.ts`
- [x] T098 [P] [US1] **Yeni test — sınır doğrulaması**: 16 etiket / 41 karakterlik etiket /
      301 karakterlik açık uçlu cevap → `400`, **LLM çağrılmaz** (FR-003, SC-008, H1-8) —
      `backend/test/integration/pa-us1-input-limits.spec.ts`
- [x] T099 [P] [US1] **Yeni test — `experienceLevel` türetimi**: her `experienceYears`
      değeri doğru seviyeye eşlenir; istemciden gelen `experienceLevel` **yok sayılır**
      (FR-002d) — `backend/test/unit/pa-us1-experience-level.spec.ts`

### Not — `002-interview` context bloğu da güncellenmeli

`contracts/llm-contract.md` §7'deki `<on_degerlendirme_raporu>` bloğunun şekli değişti
(`alanlar` → `guclu_yonler`/`gelisim_alanlari`/`calisma_tarzi_ozeti`; `teknoloji_ozdegerlendirmesi`
→ `oz_degerlendirme` + `yetenekler`). Ayrıca **`yetenekler` alanı artık kullanıcının yazdığı
serbest metindir** — `002-interview` bu bloğu kendi tarafında da veri olarak izole etmek
zorundadır ("kaynağı kendi veritabanımız" varsayımı geçersizdir). Bu, o dilimin kendi
clarify/tasks oturumunda ele alınacaktır.
