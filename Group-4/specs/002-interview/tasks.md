---

description: "Görüşme (Interview) dikey dilimi için görev listesi"
---

# Görevler: Görüşme (Interview)

**Girdi**: `specs/002-interview/` tasarım dokümanları

**Ön Koşullar**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) — hata zarfı (§2), `404` kuralı (§1), LLM çağrı sözleşmesi/timeout/hız sınırı (§3), `TokenUsage`/dil/soft-delete (§4).

**Testler**: **ZORUNLU** — Anayasa İlke III (Test-Öncelikli/ATDD, PAZARLIK EDİLEMEZ). Testler ilgili üretim kodundan ÖNCE yazılır; kırmızı olduğu doğrulanır.

**Organizasyon**: Görevler kullanıcı hikâyesine göre gruplanmıştır; her hikâye bağımsız uygulanabilir ve test edilebilir.

---

## ⚠️ BLOKLAYICI ÖN KOŞUL — `001-auth-rol` merge edilmeden başlama

Bu dilim `backend/prisma/schema.prisma`, `backend/src/app.module.ts` ve `backend/package.json` dosyalarında auth dilimiyle kesişir. Auth dilimi **başka bir geliştirici tarafından** implemente ediliyor. **Faz 1'e başlamadan önce `001-auth-rol` main'e merge edilmiş olmalıdır.**

Bu dilim `backend/src/auth/**` dosyalarına **dokunmaz**; `SessionGuard`/`RolesGuard`/`OwnershipGuard`'ı yalnızca içe aktarır.

---

## 🏗️ Bu dilim cross-cutting altyapıyı İNŞA EDER

Implementasyon sırası **Auth → Interview → Pre-assessment** olduğundan projedeki **ilk LLM entegrasyonu bu dilimdir**. Aşağıdaki bileşenleri bu dilim kurar; `003-pre-assessment` **devralır** (yeniden yazmaz):

| Bileşen | Dosya | Tasarım sahibi |
|---------|-------|----------------|
| `LlmModule` + `generateStructured()` | `backend/src/llm/**` | `API_CONVENTIONS.md` §3 + `003-pre-assessment/contracts/llm-contract.md` |
| `TokenUsage` tablosu + `LlmOperation` enum | `backend/prisma/schema.prisma` | `003-pre-assessment/data-model.md` (§4.1) |
| Dil çözümleyici + `ReportLanguage` | `backend/src/common/language.ts` | `API_CONVENTIONS.md` §4.2 |
| LLM hız sınırı guard'ı | `backend/src/common/guards/llm-rate-limit.guard.ts` | `API_CONVENTIONS.md` §3.5 |
| Ortak hata zarfı filtresi | `backend/src/common/http-exception.filter.ts` | `API_CONVENTIONS.md` §2 |
| `ExperienceLevel` enum | `backend/prisma/schema.prisma` | `003-pre-assessment/data-model.md` |
| Paylaşılan LLM test fake'i | `backend/test/fakes/fake-llm.provider.ts` | research.md §1 |

⚠️ **Tasarım sahipliği bu dilimde değil.** Bu görevler o sözleşmeleri **uygular**; sapma gerekiyorsa önce `docs/API_CONVENTIONS.md` güncellenir.

⚠️ **`LlmUsageLog` YOKTUR.** Tek maliyet tablosu `TokenUsage`'dır; `Interview` üzerinde `totalTokens`/`totalCostUsd` **denormalize alanları yoktur** (§4.1).

---

## Biçim: `[ID] [P?] [Hikâye] Açıklama`

- **[P]**: Paralel çalıştırılabilir (farklı dosyalar, tamamlanmamış göreve bağımlılık yok)
- **[Hikâye]**: Görevin ait olduğu kullanıcı hikâyesi (US1…US5 → spec.md Hikâye 1…5)
- Açıklamalarda kesin dosya yolları belirtilir

## Yol Kuralları (plan.md — Web uygulaması yapısı, 001-auth-rol ile aynı proje kökü)

- Backend: `backend/src/llm/`, `backend/src/common/`, `backend/src/interview/`, `backend/src/pdf/`, `backend/prisma/`, `backend/test/`
- Frontend: `frontend/src/pages/interview/`, `frontend/src/components/interview/`, `frontend/src/lib/`, `frontend/test/`
- Ortak sırlar: kök `.env.example`

## Kilitli Teknoloji Yığını

NestJS + PostgreSQL 16 + Prisma 6.19.3 (backend, 001-auth-rol ile **aynı** veritabanı); React 19 + Vite + Tailwind 4 + shadcn/ui (frontend). Testler: Jest + Supertest (backend), Vitest + RTL + Playwright (frontend) — ADR-0001…0005.

**LLM**: Groq (birincil) + DeepSeek (yedek), tek `openai` npm SDK — **ADR-0007**.
**Sözlü mod**: tarayıcı Web Speech API, istemci tarafı, yeni bağımlılık yok — **ADR-0010**.

**Grafik**: Recharts, shadcn/ui `Chart` bileşenleri üzerinden — **ADR-0011** ✅.

**Kalan açık kararlar**: PDF kütüphanesi (**ADR-0009** — bloklamaz, arayüz arkasında geçici kütüphane) · `LLM_MODEL` (spike, T001).

## Kullanıcı Hikâyesi ↔ Faz Eşlemesi (öncelik sırasıyla)

| Faz | Hikâye | Başlık | Öncelik |
|-----|--------|--------|---------|
| 3 | US1 | İş İlanı Girme ve Soru Üretimi | P1 🎯 MVP |
| 4 | US2 | Soru-Cevap Akışı (Sıralı, Kilit Kuralı) | P1 |
| 5 | US5 | Tüm Cevaplar Sonrası Değerlendirme Raporu Üretimi | P1 |
| 6 | US3 | Görüşmeyi Yarıda Bırakıp Devam Etme (Resume) | P2 |
| 7 | US4 | Adaptif Soru Akışı (Bonus) | P3 |

> **Sıralama gerekçesi:** US5 (rapor) US2'nin ürettiği `status="completed"` geçişine bağımlıdır. US4 (adaptif, bonus) US2'nin cevap uç noktasını genişlettiği için en sona bırakıldı — sabit akış tek başına eksiksiz MVP oluşturur.

---

## Faz 1: Kurulum

**Amaç**: Sağlayıcı yapılandırması, bağımlılıklar ve klasör iskeleti. 001-auth-rol'ün monorepo iskeleti hazır kabul edilir.

- [X] T001 **SPIKE — LLM model seçimi** ✅ **TAMAMLANDI (2026-07-31)**: **`LLM_MODEL = openai/gpt-oss-120b`**. (a) Groq'ta `strict: true` yalnızca `openai/gpt-oss-20b` + `openai/gpt-oss-120b`'de; şema kısıtları (`.optional()` YASAK, `.nullable()` kullan) `docs/API_CONVENTIONS.md` §3.3'e işlendi. (b) Türkçe kalite Groq Console'da **manuel** doğrulandı — otomatik ölçüm yapılmadı, script gerektiğinde koşulabilir. İkincil aday `openai/gpt-oss-20b` (ADR-0007 / R4, R5) — `specs/002-interview/spike-model-secimi.md`
- [X] T002 [P] Backend bağımlılıklarını kur: `openai`, `zod-to-json-schema`; `zod` ve `@nestjs/throttler`'ın auth diliminden geldiğini doğrula — `backend/package.json` (ADR-0007: iki sağlayıcı da OpenAI-uyumlu, **ikinci SDK gerekmez**)
- [X] T003 [P] PDF metin çıkarma için geçici hafif kütüphaneyi kur (ADR-0009 netleşene kadar; **native derleme bağımlılığı olmayan** bir seçenek — research.md §3) — `backend/package.json`
- [X] T004 [P] PDF yükleme (`multipart/form-data`) için NestJS/Multer desteğini doğrula/kur — `backend/package.json`
- [X] T005 [P] `.env.example`'ı genişlet: `LLM_PROVIDER` (`groq`|`deepseek`), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (T001 çıktısı), `LLM_REQUEST_TIMEOUT_MS` (varsayılan `30000`), `PDF_MAX_SIZE_MB` (varsayılan `10`). **`VOICE_*` EKLEME** — Web Speech tarayıcıda çalışır (ADR-0010) — kök `.env.example`
- [X] T006 [P] Env doğrulama şemasına `LLM_*` ve `PDF_MAX_SIZE_MB` değişkenlerini ekle; eksikse uygulama **açılışta** hata versin — `backend/src/config/env.validation.ts`
- [X] T007 [P] Backend klasör iskeletini oluştur: `backend/src/llm/` (+ `providers/`), `backend/src/common/` (+ `guards/`), `backend/src/interview/` (+ `llm/`, `dto/`, `ownership/`), `backend/src/pdf/`, `backend/test/fakes/`
- [X] T008 [P] Frontend klasör iskeletini oluştur: `frontend/src/pages/interview/`, `frontend/src/components/interview/`
- [X] T009 ~~ADR-0011 kararı — grafik kütüphanesi~~ **TAMAMLANDI (2026-07-31)**: **Recharts**, shadcn/ui `Chart` bileşenleri üzerinden (`npx shadcn add chart`). Belirleyici eksen: shadcn/ui kilitli ve chart'ları Recharts üzerine kurulu; radar chart yerleşik. **Faz 5 blokajı kalktı.** — `docs/DECISIONS.md` ADR-0011, `docs/TECH_STACK.md`

---

## Faz 2: Temel Altyapı (Bloklayıcı Ön Koşullar)

**Amaç**: Tüm kullanıcı hikâyelerinden ÖNCE tamamlanması ZORUNLU çekirdek altyapı — bu dilimin veri katmanı **ve** cross-cutting LLM altyapısı.

**⚠️ KRİTİK**: Bu faz tamamlanmadan hiçbir kullanıcı hikâyesi işine başlanamaz.

### 2a. Veri Katmanı

- [X] T010 Prisma enum'larını tanımla — bu dilime özgü: `InterviewMode` (`written`|`voice`), `QuestionType` (`multiple_choice`|`open_ended`), `InterviewStatus` (`in_progress`|`completed`), `ReportStatus` (`not_applicable`|`pending`|`ready`|`failed`); **cross-cutting** (şema sahibi `003-pre-assessment/data-model.md`): `LlmOperation` (`pre_assessment`|`question_generation`|`adaptive_evaluation`|`interview_report`), `ReportLanguage` (`tr`|`en`), `ExperienceLevel` (`intern`|`junior`|`senior`) — `backend/prisma/schema.prisma`
- [X] T011 Prisma modellerini ekle: `Interview` (`position String?`, `level ExperienceLevel`, `language ReportLanguage`, `completedAt DateTime?`, `deletedAt DateTime?` dahil — **`totalTokens`/`totalCostUsd` EKLEME**), `Question`, `Answer`, `Report`; `User` modeline yalnızca `interviews` ilişki satırını ekle (auth alanlarına dokunma) — `backend/prisma/schema.prisma` (data-model.md)
- [X] T012 **Cross-cutting** `TokenUsage` modelini ekle (`userId`, `operation`, `preAssessmentId String?`, `interviewId String?`, `provider`, `model`, `inputTokens`, `outputTokens`, `estimatedCostUsd Decimal(10,6)`, `succeeded`) + `@@index([userId, createdAt])`, `@@index([operation, createdAt])`, `@@index([interviewId])`; `User`'a `tokenUsages` ilişki satırı. **Şema sahibi `003-pre-assessment/data-model.md` — birebir uygula** — `backend/prisma/schema.prisma`
- [X] T013 Migration üret ve uygula (`npx prisma migrate dev`) — `backend/prisma/migrations/` (T010, T011, T012'ye bağlı)
- [X] T014 Şema kısıt testi: `Interview` üzerinde `position`/`level`/`language`/`completedAt`/`deletedAt` **mevcut**, `totalTokens`/`totalCostUsd` **yok**; `(interviewId, order)` benzersiz; `Answer.questionId` benzersiz; `Report.interviewId` benzersiz; `TokenUsage` üç index'i mevcut — `backend/test/integration/schema-constraints.spec.ts`

### 2b. Cross-cutting Yardımcılar — Testler ÖNCE ⚠️

- [X] T015 [P] Dil çözümleme birim testi (ÖNCE yaz): `tr-TR`→`tr`, `tr`→`tr`, `en-US`→`en`, `de-DE`→`en`, başlık yok→`en` (FR-020, §4.2) — `backend/test/unit/language.spec.ts`
- [X] T016 [P] Hız sınırı guard birim testi (ÖNCE yaz): kullanıcı başına sayaç; **başarılı + başarısız birlikte** sayılır; sınır aşımında `429` + `details.retryAfterSeconds`; farklı kullanıcılar birbirini etkilemez (FR-022, §3.5) — `backend/test/unit/llm-rate-limit.spec.ts`
- [X] T017 [P] Ortak hata zarfı testi (ÖNCE yaz): yanıt gövdesi `{ statusCode, error, message, details? }`; **iç hata metni / stack trace / sağlayıcı yanıtı sızmaz** (§2) — `backend/test/unit/http-exception-filter.spec.ts`

### 2c. Cross-cutting Yardımcılar — Implementasyon

- [X] T018 Dil çözümleyiciyi uygula (`Accept-Language` → `tr` | `en`; TR dışı her değer `en`). **`003-pre-assessment` bunu devralacak** — `backend/src/common/language.ts`
- [X] T019 LLM hız sınırı guard'ını uygula (kullanıcı-anahtarlı, `@nestjs/throttler` üzerine; limit **yapılandırma parametresi** olarak alınır — 3/5/60 değerleri uç noktada verilir). **`003-pre-assessment` bunu 5/saat ile devralacak** — `backend/src/common/guards/llm-rate-limit.guard.ts`
- [X] T020 Ortak hata zarfı exception filter'ını uygula ve global kaydet — `backend/src/common/http-exception.filter.ts`, `backend/src/main.ts`

### 2d. LLM Altyapısı — Testler ÖNCE ⚠️

- [X] T021 [P] **Katman-1 şema regresyon testi**: Zod'dan üretilen sağlayıcı şemasının `minLength`/`minItems`/`maxItems` anahtar sözcüklerini **İÇERMEDİĞİNİ** ve `additionalProperties: false` **İÇERDİĞİNİ** doğrula (§3.3, `003/contracts/llm-contract.md` §4) — `backend/test/unit/llm-schema-layer1.spec.ts`
- [X] T022 [P] Timeout testi: varsayılan `30000` ms aşılırsa `LlmTimeoutError`; **çağrı başına `timeoutMs: 60000` override edildiğinde 45 sn süren çağrı BAŞARILI olur** (§3.2, SC-005) — `backend/test/unit/llm-timeout.spec.ts`
- [X] T023 [P] Hata sınıfı eşleme testleri: sağlayıcı 500 → `LlmProviderError`; boş/geçersiz JSON → `LlmSchemaError`; şema uyumsuzluğu → `LlmSchemaError`; ağ hatası → `LlmProviderError` (§3.4) — `backend/test/unit/llm-errors.spec.ts`
- [X] T024 [P] **Çift sağlayıcı adapter testi**: `groq` yapılandırmasında `response_format: json_schema` + `strict: true`; `deepseek` yapılandırmasında `json_object` + prompt'a gömülü şema gönderildiğini doğrula (ADR-0007, §3.3) — `backend/test/unit/llm-provider-config.spec.ts`
- [X] T025 [P] Otomatik yeniden deneme **kapalı** testi: SDK `maxRetries: 0`; başarısız çağrıda **tek** istek yapıldığı doğrulanır (§3.4) — `backend/test/unit/llm-no-retry.spec.ts`
- [X] T026 [P] `TokenUsage` yazım testi: başarılı çağrıda satır yazılır (`operation`, `userId`, `interviewId`, `provider`, `model`, in/out token); **başarısız çağrıda da yazılır** (`succeeded: false`); token bilgisi dönmezse `0` yazılır; yazım hatası kullanıcı akışını **bozmaz** (loglanır, sessizce yutulmaz) — FR-016, §4.1 — `backend/test/unit/token-usage.spec.ts`

### 2e. LLM Altyapısı — Implementasyon (sağlayıcı-agnostik, domain bilmez)

- [X] T027 [P] Hata sınıflarını tanımla: `LlmTimeoutError`, `LlmSchemaError`, `LlmProviderError` — `backend/src/llm/llm.errors.ts`
- [X] T028 [P] `LlmProvider` port arayüzünü tanımla (sağlayıcı-bağımsız; test fake'i bu sınırdan takılır) — `backend/src/llm/llm.provider.ts`
- [X] T029 Sağlayıcı yapılandırmasını tanımla: `groq` / `deepseek` için `baseURL`, model ve **şema iletim biçimi** (`json_schema+strict` ↔ `json_object`+prompt'a gömme) — `backend/src/llm/providers/provider.config.ts`
- [X] T030 **Tek** OpenAI-uyumlu adapter'ı uygula (`openai` SDK, `baseURL` yapılandırmadan, `maxRetries: 0`) — `backend/src/llm/providers/openai-compatible.provider.ts` (T028, T029'a bağlı)
- [X] T031 Katman-1 şema üreticisini uygula: Zod → JSON Schema; desteklenmeyen anahtar sözcükleri **çıkarır**, `additionalProperties: false` ekler — `backend/src/llm/schema-to-provider.ts`
- [X] T032 `TokenUsageService`: `TokenUsage` satırı yazar (başarısızlar dahil); `provider`/`model` kaydeder; **maliyet hesabı**: `groq` ücretsiz katmanda `estimatedCostUsd = 0` (token sayıları yine kaydedilir — ADR-0007 / R1), `deepseek` için ADR-0007'deki birim fiyatlar (ayrı `pricing.ts` dosyası **gerekmez** — iki sağlayıcı, iki sabit); sağlayıcı usage döndürmezse token `0`; yazım hatası yakalanır ve loglanır, çağıran akış bozulmaz (sessiz yutma yok) — `backend/src/llm/token-usage.service.ts` (T012'ye bağlı)
- [X] T033 `LlmService.generateStructured({ schema, systemPrompt, userData, timeoutMs?, operation, userId, interviewId? })`: **veri izolasyonu** (sistem talimatı ve kullanıcı verisi ayrı mesaj rollerinde — §5), çağrı başına timeout (varsayılan env'den), sağlayıcı çağrısı, **katman-2 Zod doğrulaması**, hata sınıfı eşlemesi, `TokenUsage` yazımı — `backend/src/llm/llm.service.ts` (T027-T032'ye bağlı)
- [X] T034 `LlmModule`'ü oluştur ve `app.module.ts`'ye kaydet (dışa yalnızca `LlmService` açılır) — `backend/src/llm/llm.module.ts`, `backend/src/app.module.ts`
- [X] T035 [P] **Paylaşılan** LLM test fake'ini yaz (port sınırında; yanıt/hata/gecikme senaryoları yapılandırılabilir). **`003-pre-assessment` bunu devralacak** — `backend/test/fakes/fake-llm.provider.ts`

### 2f. Dilim İskeleti

- [X] T036 [P] `PdfExtractionService` arayüzü + geçici implementasyon (`extractText(buffer): Promise<string>`, azami `PDF_MAX_SIZE_MB`, yalnızca `application/pdf`; çıkarılamazsa tanımlı hata — ADR-0009 bekleniyor) — `backend/src/pdf/pdf-extraction.service.ts`
- [X] T037 [P] Frontend `voice-client.ts`: Web Speech API sarmalayıcı (`SpeechRecognition` + `SpeechSynthesis`) + **yetenek tespiti** (`isSupported()`); desteklenmiyorsa çağıranın devre dışı bırakabilmesi için açık sinyal (ADR-0010, FR-025) — `frontend/src/lib/voice-client.ts`
- [X] T038 `InterviewModule` iskeletini oluştur ve `AppModule`'e bağla (controller + service + Prisma/Llm/Pdf sağlayıcıları) — `backend/src/interview/interview.module.ts`, `backend/src/app.module.ts` (T013, T034, T036'ya bağlı)
- [X] T039 `InterviewOwnershipGuard`: 001-auth-rol `OwnershipGuard`'ını `Interview.userId === request.user.id` kuralına bağla; **sahip değilse `404`** (asla `403` — §1), admin okuma baypası (FR-017, research.md §7) — `backend/src/interview/ownership/interview-ownership.guard.ts`
- [X] T040 Duman testi (smoke): oturumsuz istek `401`; yabancı kaynak **`404`** ve "yok" ile **ayırt edilemez**; hata gövdesi ortak zarf biçiminde — `backend/test/integration/interview-smoke.spec.ts`

**Kontrol Noktası**: Temel altyapı + cross-cutting LLM motoru hazır — kullanıcı hikâyesi implementasyonu başlayabilir.

---

## Faz 3: US1 - İş İlanı Girme ve Soru Üretimi (Öncelik: P1) 🎯 MVP

**Hedef**: Oturum açmış kullanıcı iş ilanını (metin veya PDF) girer, N (5-20), mod, **seviye** ve adaptif seçimini yapar; sistem LLM ile tam olarak N soru üretir, pozisyonu aynı yanıttan çıkarır ve görüşmeyi "devam ediyor" durumunda oluşturur.

**Bağımsız Test**: quickstart.md S1 + S6 — metin ilan + N=8 + `mode=written` + `level=junior` ile `POST /api/interviews` → `201`, tam **8** soru, `status="in_progress"`, `position` dolu, `language` çözümlenmiş; N aralık dışı → `400`; boş metin/okunamayan PDF → `400`/`422`; iş ilanı olmayan metin → `422` + `details.reason="not_a_job_posting"` ve **hiçbir** kayıt oluşmaz; LLM hatası → **hiçbir** kayıt oluşmaz; 4. istek/saat → `429`.

### US1 Testleri (ÖNCE yaz, başarısız olduklarını doğrula) ⚠️

- [X] T041 [P] [US1] Oluşturma mutlu yol testi: serbest metin + N=8 + `mode=written` + `level=junior` → `201`, tam N `Question`, `status="in_progress"`, `reportStatus="not_applicable"`, `currentQuestionOrder=1`; **istek süresi ölçülür ve 30 sn altında kalır** (Hikâye 1 kriter 1, **SC-001**) — `backend/test/integration/us1-create-happy.spec.ts`
- [X] T042 [P] [US1] PDF ile oluşturma testi: `jobPostingSource="pdf"` yüklenir, sunucu metni çıkarır, aynı akış çalışır (Hikâye 1 kriter 2) — `backend/test/integration/us1-create-pdf.spec.ts`
- [X] T043 [P] [US1] Doğrulama hataları testi: `questionCount` 5-20 dışı → `400`; boş/boşluk metin → `400`; `level` eksik veya enum dışı → `400`; desteklenmeyen dosya türü / 10 MB üstü → `400`; metin çıkarılamayan PDF → `422` (Hikâye 1 kriter 3,4; FR-003) — `backend/test/integration/us1-create-validation.spec.ts`
- [X] T044 [P] [US1] LLM hata/zaman aşımı testi (fake ile simüle): → `Interview` **oluşturulmaz**, `502`/`504`, tekrar deneme mesajı (Hikâye 1 kriter 5, FR-019) — `backend/test/integration/us1-create-llm-failure.spec.ts`
- [X] T045 [P] [US1] **Soru sayısı garantisi testi**: fake N-1 soru döndürür → `LlmSchemaError` → `502` ve **hiçbir** kayıt oluşmaz (katman-2 doğrulaması; §3.3, SC-002) — `backend/test/integration/us1-question-count-mismatch.spec.ts`
- [X] T046 [P] [US1] Sözlü mod soru tipi testi: `mode="voice"` isteğinde üretilen tüm soruların `open_ended` olduğu; fake `multiple_choice` döndürürse `LlmSchemaError` (FR-004, Netleştirmeler) — `backend/test/integration/us1-voice-open-ended.spec.ts`
- [X] T047 [P] [US1] Dil testi: `Accept-Language: tr-TR` → `language="tr"`; `de-DE` ve başlık yok → `language="en"`; kayıt sonradan farklı başlıkla okunduğunda dil **değişmez** (FR-020, SC-009) — `backend/test/integration/us1-language.spec.ts`
- [X] T048 [P] [US1] Pozisyon çıkarımı testi: pozisyon içeren ilan → `position` dolu ve **ek LLM çağrısı yapılmamış** (fake çağrı sayacı = 1); pozisyon içermeyen ilan → `position=null` ama `201` (FR-023, SC-011) — `backend/test/integration/us1-position.spec.ts`
- [X] T049 [P] [US1] Hız sınırı testi: aynı kullanıcı saat içinde 4. görüşmeyi başlatır → `429` + `details.retryAfterSeconds`; mevcut görüşmeler etkilenmez (FR-022, SC-010) — `backend/test/integration/us1-rate-limit.spec.ts`

### US1 Implementasyonu

- [X] T050 [US1] Soru üretimi domain katmanı: Zod şeması (`questions[]` + `position: string|null`) + prompt (girdiler: iş ilanı **veri olarak izole**, `questionCount`, `mode`, `level`, `language`; kullanıcının aktif ön değerlendirme raporu için **boş bırakılabilir opsiyonel bağlam slotu** — `003-pre-assessment` dolduracak) — `backend/src/interview/llm/question-generation.ts` (contracts/interview-flow-rules.md §4.1)
- [X] T051 [US1] `CreateInterviewDto` (zod: `jobPostingSource`, `jobPostingText`, `questionCount` 5-20, `mode`, **`level`**, `adaptiveEnabled`) + `POST /api/interviews` controller (`multipart/form-data` + `application/json` çift destek); guard zinciri `SessionGuard` → `LlmRateLimitGuard(3/saat)` — `backend/src/interview/dto/create-interview.dto.ts`, `backend/src/interview/interview.controller.ts`
- [X] T052 [US1] `InterviewService.create`: doğrulamalar, PDF ise `PdfExtractionService.extractText`, dil çözümlemesi (`common/language.ts`), `LlmService.generateStructured({ operation: 'question_generation', ... })`, **katman-2 sonrası N eşitliği kontrolü**, `position`/`language`/`level` yazımı, `Question` kayıtlarının `order` 1..N ile oluşturulması (FR-001, FR-002, FR-003, FR-004, FR-005, FR-020, FR-021, FR-023) — `backend/src/interview/interview.service.ts` (T038, T050'ye bağlı)
- [X] T053 [US1] LLM hatası/şema uyuşmazlığında **yarım kayıt bırakmama** garantisi: `Interview` + `Question` yazımı tek transaction; LLM çağrısı transaction'dan **önce** tamamlanır (FR-019) — `backend/src/interview/interview.service.ts`
- [X] T054 [P] [US1] Frontend yeni görüşme formu: serbest metin/PDF, N (5-20), mod, **seviye seçimi** (`intern`/`junior`/`senior`), adaptif; seviye alanı için **ön-doldurma kancası** (aktif ön değerlendirme varsa doldurulur — `003-pre-assessment` bağlayacak; yoksa boş/varsayılan, akış bozulmaz — FR-021, SC-013) — `frontend/src/pages/interview/new.tsx`
- [X] T055 [P] [US1] Frontend PDF yükleme bileşeni (10 MB / dosya türü doğrulaması — yalnızca UX, sunucu tekrar doğrular) — `frontend/src/components/interview/pdf-upload.tsx`
- [X] T056 [P] [US1] Frontend sözlü mod yetenek tespiti: `voice-client.isSupported()` false ise mod seçeneği **devre dışı** + kullanıcı yazılı moda yönlendirilir; sessiz başarısızlık yok (FR-025, ADR-0010 / R1) — `frontend/src/components/interview/mode-selector.tsx`

**Kontrol Noktası**: US1 bağımsız çalışır — soru üretimi MVP hazır.

---

## Faz 4: US2 - Soru-Cevap Akışı (Sıralı, Kilit Kuralı) (Öncelik: P1)

**Hedef**: Kullanıcı soruları sırayla cevaplar; soru `i` kaydedilmeden soru `i+1` gösterilmez/kabul edilmez; cevaplar değiştirilemez; son cevapta görüşme tamamlanır ve tamamlanma zamanı yazılır.

**Bağımsız Test**: quickstart.md S2 — sırayla cevaplama → her cevaptan sonra bir sonraki soru; sıra dışı/tekrar cevap → `409`; geçersiz çoktan seçmeli → `400`; son cevap → `status="completed"` + `completedAt` yazılı.

### US2 Testleri (ÖNCE yaz) ⚠️

- [X] T057 [P] [US2] Sıralı akış mutlu yol testi: soru `i` cevaplanır → `200`, yanıt soru `i+1`'i döner ve soru `i+1` bu ana kadar hiç dönmemiştir; `currentQuestionOrder` ilerler (Hikâye 2 kriter 1, SC-003) — `backend/test/integration/us2-sequential-flow.spec.ts`
- [X] T058 [P] [US2] Tamamlanma testi: son soru (N) cevaplanır → `status="completed"`, **`completedAt` yazılı** (süre hesaplanabilir), `reportStatus="pending"` (Hikâye 2 kriter 2, FR-012, FR-024, SC-012) — `backend/test/integration/us2-completion.spec.ts`
  - ⚠️ **Faz 5 düzeltmesi**: `reportStatus="pending"` beklentisi **geçersiz kaldı**. Rapor üretimi sözleşme gereği (contracts/interview-api.md §4) **eşzamanlı** tetiklendiğinden `pending` istemcinin gördüğü yanıtta hiç görünmeyen geçici bir durumdur; test `"ready"` bekleyecek şekilde güncellendi.
- [X] T059 [P] [US2] Değişmezlik testi: zaten cevaplanmış soruya tekrar cevap → `409`; mevcut cevap **değişmez** (Hikâye 2 kriter 3, FR-007) — `backend/test/integration/us2-answer-immutable.spec.ts`
- [X] T060 [P] [US2] Sıra kilidi testi: sırası gelmemiş soruya doğrudan cevap → `409` (istemci baypası; Hikâye 2 kriter 4, FR-006, SC-003) — `backend/test/integration/us2-order-lock.spec.ts`
- [X] T061 [P] [US2] Çoktan seçmeli doğrulama testi: `options` listesinde olmayan değer → `400` (Hikâye 2 kriter 5, FR-008) — `backend/test/integration/us2-mc-validation.spec.ts`
- [X] T062 [P] [US2] Cevap hız sınırı testi: saat içinde 61. cevap → `429` (FR-022, §3.5) — `backend/test/integration/us2-answer-rate-limit.spec.ts`

### US2 Implementasyonu

- [X] T063 [US2] `SubmitAnswerDto` (zod: `questionOrder`, `content`) + `POST /api/interviews/:id/answers` controller; guard zinciri `SessionGuard` → `InterviewOwnershipGuard` → `LlmRateLimitGuard(60/saat)` — `backend/src/interview/dto/submit-answer.dto.ts`, `backend/src/interview/interview.controller.ts`
- [X] T064 [US2] `InterviewService.submitAnswer`: `questionOrder === currentQuestionOrder` sıralı kilidi (`409`), çoktan seçmeli seçenek doğrulaması (`400`), `Answer` oluşturma (immutable), `currentQuestionOrder` ilerletme, `Answer.sourceMode` yazımı (FR-006, FR-007, FR-008) — `backend/src/interview/interview.service.ts`
- [X] T065 [US2] Tamamlanma geçişi: son cevapta `status="completed"` + **`completedAt=now()`** + `reportStatus="pending"` **aynı transaction'da** (FR-012, FR-024) — `backend/src/interview/interview.service.ts`
- [X] T066 [P] [US2] Frontend soru-cevap ekranı (chat tarzı balonlar, ilerleme göstergesi "Soru i/N", çoktan seçmeli dikey tıklanabilir liste, aktif soru cevaplanmadan sonraki balon görünmez) — `frontend/src/pages/interview/[id]/session.tsx`, `frontend/src/components/interview/question-card.tsx`
- [X] T067 [P] [US2] Frontend sözlü mod etkileşimi: soru metni ekranda **ve** TTS ile okunur; cevap STT ile alınır; **metne dökülmüş cevap gönderim öncesi kullanıcıya gösterilir ve düzeltilebilir**; mikrofon izni reddedilirse yazılı moda düşülür (ADR-0010 / R2, R3; FR-008, FR-025) — `frontend/src/components/interview/voice-controls.tsx`

**Kontrol Noktası**: US1 + US2 bağımsız çalışır — uçtan uca soru-cevap akışı hazır.

---

## Faz 5: US5 - Değerlendirme Raporu Üretimi (Öncelik: P1)

**Hedef**: Tüm cevaplar sonrası LLM ile rapor (Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar, Teknik/Davranışsal/Genel 3 eksende 0-100 skor) üretilir, kalıcı saklanır ve tekrar görüntülemede yeniden LLM çağrısı yapılmaz.

**✅ ÖN KOŞUL KARŞILANDI**: T009 (ADR-0011) tamamlandı — grafik kütüphanesi **Recharts** (shadcn/ui Charts). T078 uygulanabilir.

**Bağımsız Test**: quickstart.md S5 — son cevap → rapor otomatik üretilir (`reportStatus="ready"`); tekrar `GET .../report` → aynı rapor, **yeni LLM çağrısı yok**; hata → `failed`, cevaplar korunur, `retry` ile üretilir; yabancı erişim → `404`.

### US5 Testleri (ÖNCE yaz) ⚠️

- [X] T068 [P] [US5] Rapor üretimi mutlu yol testi: son cevap sonrası rapor otomatik üretilir; 3 eksen skor **0-100** aralığında; `reportStatus="ready"` (Hikâye 5 kriter 1, FR-013) — `backend/test/integration/us5-report-happy.spec.ts`
- [X] T069 [P] [US5] Yeniden görüntüleme testi: `GET /api/interviews/:id/report` iki kez çağrılır → aynı içerik ve fake LLM çağrı sayacı **artmaz** (Hikâye 5 kriter 3, FR-014, SC-007) — `backend/test/integration/us5-report-cached.spec.ts`
- [X] T070 [P] [US5] Rapor hatası testi: LLM hata/zaman aşımı → `reportStatus="failed"`, `Report` yazılmaz, **cevaplanmış soru/cevaplar korunur**, `409` + retry talimatı (Hikâye 5 kriter 2, FR-015, SC-008) — `backend/test/integration/us5-report-failure.spec.ts`
- [X] T071 [P] [US5] Retry testi: `POST /api/interviews/:id/report/retry` → `ready`; `failed` olmayan durumda çağrı → `409` (Hikâye 5 kriter 4) — `backend/test/integration/us5-report-retry.spec.ts`
- [X] T072 [P] [US5] Yetkisiz erişim testi: başka kullanıcının raporuna `id` bilerek erişim → **`404`**, içerik sızmaz; "yok" yanıtından ayırt edilemez (Hikâye 5 kriter 5, FR-017, SC-006, §1) — `backend/test/integration/us5-report-unauthorized.spec.ts`
- [X] T073 [P] [US5] **Rapor timeout override testi**: rapor çağrısı `timeoutMs: 60000` ile yapılır — 45 sn süren fake çağrı **başarılı** olur (varsayılan 30 sn onu keserdi; SC-005, §3.2) — `backend/test/integration/us5-report-timeout.spec.ts`
- [X] T074 [P] [US5] Retry hız sınırı testi: saat içinde 6. retry → `429` (FR-022, §3.5) — `backend/test/integration/us5-retry-rate-limit.spec.ts`

### US5 Implementasyonu

- [X] T075 [US5] Rapor domain katmanı: Zod şeması (`overallImpression`, `strengths[]`, `improvementAreas[]`, `scores{technical,behavioral,general}` 0-100, `additionalNotes: string[] | null` — `.nullable()`, **`.optional()` değil**, §3.3) + prompt (tüm soru-cevap çiftleri **veri olarak izole**, `language`, `level`); çağrı **`timeoutMs: 60_000`** ve `operation: 'interview_report'` ile yapılır — `backend/src/interview/llm/report.ts` (contracts/interview-flow-rules.md §4.3)
- [X] T076 [US5] Rapor orkestrasyonu: `reportStatus` geçişleri (`not_applicable`→`pending`→`ready`|`failed`), `Report` kaydı, `ready` sonrası **değişmezlik** (FR-013, FR-014, FR-015) — `backend/src/interview/interview.service.ts` (T075'e bağlı)
- [X] T077 [US5] `GET /api/interviews/:id/report` (`200`/`202`/`409`/`404`) + `POST /api/interviews/:id/report/retry` uç noktaları; retry guard zinciri `SessionGuard` → `InterviewOwnershipGuard` → `LlmRateLimitGuard(5/saat)` — `backend/src/interview/interview.controller.ts`
- [X] T078 [P] [US5] Frontend rapor ekranı: üstte genel skor, 3 eksen **`RadarChart`** (shadcn `ChartContainer` + `ChartConfig`, `accessibilityLayer` **açık**), altta metinsel bloklar; skorlar grafiğin yanında **metin olarak da** gösterilir (grafik tek bilgi kaynağı olmaz — İlke VII, ADR-0011/R2); **AI şeffaflık rozeti** — `frontend/src/pages/interview/[id]/report.tsx`
- [X] T079 [P] [US5] Frontend rapor hata/bekleme durumları: `pending` göstergesi, `failed` + **tekrar dene** butonu, `429` durumunda ne zaman denenebileceği mesajı (FR-015, İlke VII) — `frontend/src/components/interview/report-state.tsx`

**Kontrol Noktası**: US1 + US2 + US5 → **eksiksiz MVP** (ilan → sorular → cevaplar → rapor).

---

## Faz 6: US3 - Görüşmeyi Yarıda Bırakıp Devam Etme (Resume) (Öncelik: P2)

**Hedef**: "Devam ediyor" bir görüşme kaldığı sorudan devam eder; önceki soru/cevaplar değişmeden korunur; liste uç noktası History ekranının veri temelini ve soft-delete görünürlük kuralını sağlar.

**Bağımsız Test**: quickstart.md S3 — 3 soru cevaplanmış görüşmeye dönülür → aktif soru = 4, önceki cevaplar değişmemiş; birden fazla "devam ediyor" bağımsız; yabancı erişim → `404`.

### US3 Testleri (ÖNCE yaz) ⚠️

- [X] T080 [P] [US3] Resume testi: `GET /api/interviews/:id` → önceki soru-cevap çiftleri **değişmeden**, aktif soru = `currentQuestionOrder`, **sonraki sorular döndürülmez** (Hikâye 3 kriter 1, FR-009, SC-004) — `backend/test/integration/us3-resume.spec.ts`
- [X] T081 [P] [US3] Çoklu eşzamanlı görüşme testi: aynı kullanıcının iki "devam ediyor" görüşmesinden biri ilerletilir → yalnızca o değişir (Hikâye 3 kriter 2, FR-018) — `backend/test/integration/us3-multiple-active.spec.ts`
- [X] T082 [P] [US3] Yetkisiz resume testi: başka kullanıcının görüşmesine `id` ile erişim → **`404`**, içerik sızmaz (Hikâye 3 kriter 3, FR-017, §1) — `backend/test/integration/us3-resume-unauthorized.spec.ts`
- [X] T083 [P] [US3] **Soft-delete görünürlük testi**: `deletedAt != null` kayıt `role=user` listesinde **yok** ve detayda `404`; `role=admin` listesinde **var** ve `deletedAt` alanı döner (§4.3) — `backend/test/integration/us3-soft-delete-visibility.spec.ts`

### US3 Implementasyonu

- [X] T084 [US3] `GET /api/interviews/:id`: `in_progress` için önceki çiftler + aktif soru (sonrakiler hariç), `completed` için tüm çiftler + rapor durumu (FR-009) — `backend/src/interview/interview.controller.ts`, `backend/src/interview/interview.service.ts`
- [X] T085 [US3] `GET /api/interviews` liste: özet alanlar (`position`, `status`, `reportStatus`, `mode`, `level`, `language`, `questionCount`, `createdAt`, `completedAt`; admin için ek `deletedAt`, `userId`) + **soft-delete filtresi** + admin okuma baypası (FR-017, §4.3) — `backend/src/interview/interview.service.ts`
- [X] T086 [P] [US3] Frontend görüşme listesi (kart görünümü: **pozisyon başlığı**, tarih, durum rozeti) ve devam etme akışı — `frontend/src/components/interview/interview-card.tsx`, `frontend/src/pages/interview/[id]/session.tsx`

**Kontrol Noktası**: Resume + liste veri temeli hazır — `004-history` dilimi bunun üzerine kurulabilir.

---

## Faz 7: US4 - Adaptif Soru Akışı (Bonus) (Öncelik: P3)

**Hedef**: `adaptiveEnabled=true` görüşmelerde her cevaptan sonra LLM cevabı değerlendirir ve **henüz gösterilmemiş** sıradaki sorunun zorluğunu/odağını uyarlar; hata durumunda baseline soru değişmeden kullanılır; toplam soru sayısı N sabit kalır.

**Bağımsız Test**: quickstart.md S4 — güçlü cevap → zorluk artar (`isBaseline=false`); zayıf cevap → temel seviye; LLM hatası → akış **kesilmez**, baseline sunulur; `adaptiveEnabled=false` → sorular hiç değişmez.

### US4 Testleri (ÖNCE yaz) ⚠️

- [X] T087 [P] [US4] Uyarlama testi: güçlü cevap → sıradaki soru içeriği değişir, `isBaseline=false`, `adaptedFromAnswerId` dolu (Hikâye 4 kriter 1, FR-010) — `backend/test/integration/us4-adaptive-uplevel.spec.ts`
- [X] T088 [P] [US4] Zayıf cevap + N sabitliği testi: sıradaki soru daha temel seviyede; toplam soru sayısı **N** değişmez (Hikâye 4 kriter 2, FR-010) — `backend/test/integration/us4-adaptive-downlevel.spec.ts`
- [X] T089 [P] [US4] Uyarlama hatası testi: adaptif LLM çağrısı hata/zaman aşımı → akış **kesilmez**, sıradaki soru `isBaseline=true` haliyle sunulur (Hikâye 4 kriter 3, FR-011) — `backend/test/integration/us4-adaptive-fallback.spec.ts`
- [X] T090 [P] [US4] Adaptif kapalı testi: `adaptiveEnabled=false` → sorular üretim anındaki içerikle sunulur, hiç LLM uyarlama çağrısı yapılmaz (Hikâye 4 kriter 4) — `backend/test/integration/us4-adaptive-disabled.spec.ts`
- [X] T091 [P] [US4] **Cevaplanmış soru donması testi**: `Answer`'ı olan bir `Question`'ın `text`/`options`/`type` alanları uyarlama ile **değiştirilemez** (data-model.md doğrulama kuralı, research.md §4) — `backend/test/integration/us4-answered-question-frozen.spec.ts`

### US4 Implementasyonu

- [X] T092 [US4] Adaptif domain katmanı: Zod şeması (`evaluationSummary` — dahili, kullanıcıya gösterilmez; `nextQuestion`) + prompt (soru, cevap, `level`, `language` — cevap **veri olarak izole**); çağrı `operation: 'adaptive_evaluation'` — `backend/src/interview/llm/adaptive.ts` (contracts/interview-flow-rules.md §4.2)
- [X] T093 [US4] Adaptif akış uygulaması: yalnızca **henüz gösterilmemiş/cevaplanmamış** `order` güncellenir; hata/zaman aşımında baseline korunur (sessiz başarısızlık değil — loglanır); `isBaseline`/`adaptedFromAnswerId` yazımı (FR-010, FR-011) — `backend/src/interview/interview.service.ts` (T092'ye bağlı)

**Kontrol Noktası**: Tüm hikâyeler bağımsız çalışır.

---

## Faz 8: Cila & Kesişen Konular

- [X] T094 [P] quickstart.md S1-S6 senaryolarının uçtan uca Playwright doğrulaması (fake LLM/PDF, Web Speech stub ile) — `frontend/test/e2e/interview-flows.spec.ts`
- [X] T095 [P] Frontend birim testleri (Vitest + RTL: yeni görüşme formu doğrulama UX, chat akışı sıra kilidi görünümü, sözlü mod yetenek tespiti ve zarif bozulma) — `frontend/test/interview-form.test.tsx`, `frontend/test/voice-client.test.ts`
- [X] T096 [P] **ADR-0009 kararını yaz** ✅ **TAMAMLANDI (2026-07-31, planlanandan erken — Faz 3 PDF entegrasyonu sırasında)**: seçilen kütüphane **unpdf** (native derleme bağımlılığı yok, Mozilla PDF.js motoru); alternatifler (pdf-parse, pdfjs-dist doğrudan) ve bulgular (Jest/ESM test kısıtı) kaydedildi — `docs/DECISIONS.md`, `docs/TECH_STACK.md`
- [X] T097 [P] `docs/API_CONVENTIONS.md`'yi inşa edilen altyapıyla karşılaştır: `generateStructured` imzası, timeout override, hata sınıfı→HTTP eşlemesi, `TokenUsage` alanları, hız sınırı değerleri, `404` kuralı **birebir** uyuyor mu — sapma varsa belgeyi güncelle (dikey spec'i değiştirme) — `docs/API_CONVENTIONS.md`
- [X] T098 [P] `case-study/AI_DEVLOG.md`'yi bu dilimin AI destekli çalışmasıyla güncelle: kullanılan araç/model, iterasyon sayısı, zorluklar ve çözümleri, MCP/skill'ler (Anayasa İlke I) — `case-study/AI_DEVLOG.md`
- [X] T099 Güvenlik gözden geçirmesi: (a) iş ilanı/cevap metinlerinin LLM'e **daima veri olarak** ayrı mesaj rolünde gittiği ve sistem talimatıyla birleştirilmediği (İlke V, §5); (b) sırların yalnızca `.env`'den geldiği; (c) hata zarfının iç detay/sağlayıcı yanıtı sızdırmadığı (§2); (d) yabancı kaynakta **daima `404`** (§1); (e) tüm sıralı kilit/sahiplik kontrollerinin sunucu tarafında olduğu — `backend/src/`
  - **T099 sonucu (2026-08-01):** (b) sirlar, (c) hata zarfi, (d) `404` kurali,
    (e) sunucu tarafi kontroller **temiz**. (a) maddesinde sapma bulundu:
    `askedQuestion` / `nextQuestionBaseline` / `position` sistem talimatindaydi —
    bunlar LLM uretimi olsa da kokenleri kullanici girdisi. Veri tarafina tasindi,
    davranis DEGISMEDI (US4/US5 18 entegrasyon testi geciyor). Kural
    `docs/API_CONVENTIONS.md` §5.1 olarak yazildi; regresyon korumasi
    `backend/test/unit/prompt-isolation.spec.ts`. **Kanitlanmis istismar degil** —
    manuel denemede tetiklenmedi; sozlesme uyumu icin duzeltildi.
- [X] T100 quickstart.md doğrulama koşusu: S1-S6'nın tamamı manuel/otomatik geçer — `specs/002-interview/quickstart.md`
- [X] T101 Kod temizliği ve refactor (Kırmızı→Yeşil→**Refactor** son adımı): guard/servis tekrarlarını sadeleştir, `interview/llm/` içindeki üç prompt dosyasındaki ortak parçaları çıkar — `backend/src/`
- [X] T102 **Devir notu — `003-pre-assessment` için**: `LlmService` yüzeyinin, ortak guard'ın, `common/language.ts`'in, `TokenUsage` tablosunun ve paylaşılan fake'in devralınmaya hazır olduğunu doğrula ve bilinen sapmaları not et — `specs/002-interview/devir-notu.md`

---

## Bağımlılıklar & Yürütme Sırası

### Faz Bağımlılıkları

- **Faz 1 (Kurulum)**: `001-auth-rol` merge'ine bağlı. T001 (spike) **ilk**; T002-T008 paralel; T009 (ADR-0011) Faz 5'ten önce bitmeli.
- **Faz 2 (Temel Altyapı)**: Faz 1'e bağlı — **TÜM kullanıcı hikâyelerini BLOKLAR**.
  - 2a (veri) → 2b/2c (cross-cutting yardımcılar) → 2d/2e (LLM motoru) → 2f (dilim iskeleti)
  - T012 (TokenUsage) T032'yi bloklar; T027-T031 T033'ü bloklar; T033-T034 tüm LLM kullanan görevleri bloklar.
- **Faz 3-7 (Hikâyeler)**: Hepsi Faz 2'ye bağlı.
  - US1 → US2 → US5 **zincirlidir** (US2 US1'in ürettiği sorulara, US5 US2'nin `completed` geçişine bağlı).
  - US3 (resume) US1+US2'den sonra bağımsız çalışabilir.
  - US4 (adaptif) US2'nin cevap uç noktasını genişletir — US2'den sonra.
- **Faz 8 (Cila)**: İstenen tüm hikâyeler tamamlandıktan sonra.

### Kullanıcı Hikâyesi Bağımlılıkları

- **US1 (P1)**: Faz 2 sonrası başlar — başka hikâyeye bağımlı değil. 🎯 MVP çekirdeği.
- **US2 (P1)**: US1'in ürettiği `Question` kayıtlarına bağlı.
- **US5 (P1)**: US2'nin `status="completed"` + `reportStatus="pending"` geçişine bağlı. **T009 (ADR-0011) ön koşulu var.**
- **US3 (P2)**: US1+US2 sonrası bağımsız test edilebilir.
- **US4 (P3, bonus)**: US2 sonrası; kapalıyken sistem eksiksiz çalışır.

### Her Hikâye İçinde

- Testler **koddan ÖNCE** yazılır ve kırmızı olduğu doğrulanır (Anayasa İlke III).
- Domain şema/prompt → servis → controller → frontend.
- Kritik akışlar (soru üretimi, rapor) test kapsamı olmadan **merge edilemez**.

### Paralel Fırsatlar

- Faz 1: T002-T008 birlikte (T001 spike'ı beklemeden başlanabilir; yalnızca T005'in `LLM_MODEL` satırı T001 çıktısını bekler).
- Faz 2: T015-T017 birlikte; T021-T026 birlikte; T027, T028, T035 birlikte; T036, T037 birlikte.
- Her hikâyenin test görevleri (`[P]` işaretli) birlikte yazılabilir.
- Frontend görevleri (T054-T056, T066-T067, T078-T079, T086) backend implementasyonuyla paralel yürütülebilir (sözleşmeler `contracts/` ile sabit).

---

## Paralel Örnek: US1

```bash
# 1) US1 testlerini birlikte yaz (hepsi farklı dosya):
Task: "us1-create-happy.spec.ts"          # T041
Task: "us1-create-pdf.spec.ts"            # T042
Task: "us1-create-validation.spec.ts"     # T043
Task: "us1-create-llm-failure.spec.ts"    # T044
Task: "us1-question-count-mismatch.spec.ts" # T045
Task: "us1-voice-open-ended.spec.ts"      # T046
Task: "us1-language.spec.ts"              # T047
Task: "us1-position.spec.ts"              # T048
Task: "us1-rate-limit.spec.ts"            # T049
Task: "us1-invalid-job-posting.spec.ts"   # T049a

# 2) Kırmızı olduklarını doğrula, sonra implementasyon:
#    T050 → T051 → T052 → T053 (aynı dosyalara dokunur, SIRALI)

# 3) Frontend paralel (farklı dosyalar):
Task: "interview/new.tsx"        # T054
Task: "pdf-upload.tsx"           # T055
Task: "mode-selector.tsx"        # T056
```

---

## Uygulama Stratejisi

### MVP Önce (US1 + US2 + US5)

Bu dilimde MVP tek hikâye değildir: "ilan → sorular" tek başına gösterilebilir ama ürün değeri **rapora** kadar tamamlanır.

1. Faz 1: Kurulum (**T001 spike ilk**, T009 ADR-0011 Faz 5'ten önce)
2. Faz 2: Temel Altyapı (**KRİTİK** — cross-cutting LLM motoru dahil)
3. Faz 3: US1 → **DUR ve DOĞRULA** (quickstart S1 + S6)
4. Faz 4: US2 → **DUR ve DOĞRULA** (quickstart S2)
5. Faz 5: US5 → **DUR ve DOĞRULA** (quickstart S5) → **MVP demo hazır**

### Artımlı Teslim

1. Kurulum + Temel Altyapı → zemin hazır (ve `003-pre-assessment`'ın devralacağı altyapı hazır)
2. US1 → soru üretimi gösterilebilir
3. US2 → uçtan uca soru-cevap
4. US5 → **MVP tamam** (rapor)
5. US3 → resume + liste (History diliminin zemini)
6. US4 → adaptif akış (bonus)

### Notlar

- `[P]` görevleri farklı dosyalara dokunur, bağımlılığı yoktur.
- Her görev veya mantıksal grup sonrası commit at.
- **Sessiz başarısızlık yasak** (İlke VI): her LLM hata yolu ya kullanıcıya zarif bir mesaj ya da loglanmış bir fallback üretir.
- Bu dilimin kurduğu cross-cutting dosyalara (`llm/`, `common/`) sonraki dikeyler **dokunmaz**; sözleşme değişikliği önce `docs/API_CONVENTIONS.md`'de yapılır.

---

## Faz 9: Convergence

> `/speckit.converge` tarafından üretildi. Faz 8'de daha önce açılmış ama hâlâ işaretlenmemiş görevlerin (T094, T095, T097, T098, T100, T101, T102) kodda **doğrulanmış** karşılığı bulunmadı — kod tabanında ilgili dosyalar/kayıtlar hâlâ eksik. Aşağıdaki görevler bu eksikleri iz sürülebilir biçimde yeniden teyit eder; mevcut T094-T102 görevleri **değiştirilmedi/silinmedi**.

- [X] T103 [P] CRITICAL `case-study/AI_DEVLOG.md`'ye `002-interview` dilimi için Anayasa İlke I gereği eşzamanlı bir devlog kaydı ekle (kullanılan AI aracı/model, iterasyon sayısı, karşılaşılan zorluklar/çözümler, kullanılan MCP/skill'ler) — dosyada şu an bu dilime dair hiçbir kayıt yok (contradicts, Constitution I; kaynak: T098) — `case-study/AI_DEVLOG.md`
- [X] T104 [P] HIGH `frontend/test/e2e/interview-flows.spec.ts` dosyasını oluşturup quickstart.md S1-S6 senaryolarının Playwright ile uçtan uca doğrulamasını yaz (fake LLM/PDF, Web Speech stub) — dosya kod tabanında mevcut değil (missing; kaynak: T094, Anayasa İlke III) — `frontend/test/e2e/interview-flows.spec.ts`
- [X] T105 [P] HIGH `frontend/test/interview-form.test.tsx` ve `frontend/test/voice-client.test.ts` dosyalarını oluşturup yeni görüşme formu doğrulama UX'i, chat akışı sıra kilidi görünümü, sözlü mod yetenek tespiti ve zarif bozulmayı test et — `frontend/test/` içinde bu dilime ait hiçbir birim testi yok (missing; kaynak: T095, Anayasa İlke III) — `frontend/test/interview-form.test.tsx`, `frontend/test/voice-client.test.ts`
- [X] T106 [P] MEDIUM `docs/API_CONVENTIONS.md` §3.1'i gerçek `LlmService.generateStructured` imzasıyla senkronize et: dokümanda eksik olan zorunlu `schemaName: string` alanını ekle; timeout override, hata sınıfı→HTTP eşlemesi, `TokenUsage` alanları, hız sınırı değerleri ve `404` kuralının kodla birebir uyduğunu doğrula (partial; kaynak: T097, plan: LLM sözleşmesi dokümantasyonu) — `docs/API_CONVENTIONS.md`
- [X] T107 MEDIUM `specs/002-interview/quickstart.md` S1-S6 senaryolarının tamamını (manuel veya T104'teki otomasyon üzerinden) çalıştırıp doğrulama sonucunu kaydet (partial; kaynak: T100) — `specs/002-interview/quickstart.md`
- [X] T108 MEDIUM `specs/002-interview/devir-notu.md` dosyasını oluştur: `LlmService` yüzeyinin, ortak guard'ın, `common/language.ts`'in, `TokenUsage` tablosunun ve paylaşılan LLM fake'inin `003-pre-assessment` tarafından devralınmaya hazır olduğunu doğrula ve bilinen sapmaları not et — dosya kod tabanında mevcut değil (missing; kaynak: T102) — `specs/002-interview/devir-notu.md`
- [X] T109 [P] LOW `backend/src/interview/llm/` altındaki `question-generation.ts`, `adaptive.ts`, `report.ts` dosyalarındaki ortak prompt/şema kalıplarını (dil çözümleme, kullanıcı verisi izolasyon sarmalayıcısı, hata işleme) paylaşılan bir yardımcıya çıkararak tekrarı azalt (partial; kaynak: T101, Kırmızı→Yeşil→Refactor) — `backend/src/interview/llm/`

---

## Faz 11: İnceleme Bulguları (2026-07-31)

2026-07-31 çapraz analizinde bu dilime düşen açık maddeler. Kök neden tek bir örüntü:
`docs/API_CONVENTIONS.md §6` "bu dosyadaki bir kural değişirse ona referans veren dikey
spec'leri **aynı commit'te** güncellenir" diyor — fiilen uygulanmıyor. Kod yazmadan önce
kapatılmalı, çünkü bu dilim `003`'ün devralacağı sözleşmeyi kuruyor.

> **Not (merge sırasında yeniden numaralandırıldı):** Bu görevler orijinalde T103-T113
> olarak açılmıştı; Faz 9 (yukarıda) aynı numara aralığını farklı görevler için zaten
> kullandığı için `006-auth` ile birleştirilirken T110-T120'ye kaydırıldı. İçerik
> değiştirilmedi.

- [X] T110 Groq `strict` şema kuralını (`.optional()` **yasak**, `T | null` zorunlu) dikey sözleşmelere yay per `docs/API_CONVENTIONS.md §3.3` (bulgu I1, **öncelikli**) — güncellenmemiş yerler: `contracts/interview-flow-rules.md:103` (`options` koşullu), `:142` (`additionalNotes`), `tasks.md:180` (T050), `:239` (T075), `data-model.md:158`. Doğrusu `options: string[] | null`, `additionalNotes: string[] | null`. Bugünkü sözleşmeye göre yazılan şemayı Groq **reddeder**
- [X] T111 `429` yükünü tekleştir: `details.retryAfterSeconds` esas alınır (`docs/API_CONVENTIONS.md:160`), `Retry-After` başlığı yazan yerler düzeltilir — `specs/003-pre-assessment/contracts/pre-assessment-api.md:77,182`, `003/quickstart.md:170`, `003/research.md:147` (bulgu I2) — guard **tek ve paylaşılan**, iki sözleşmeye birden uyamaz
- [X] T112 [P] ~~`plan.md:116` "19 fonksiyonel gereksinim" → **25**~~ — **TAMAMLANDI (2026-08-04)**: sayı **28** yazıldı (bulgunun yazıldığı gün 25'ti; sonradan FR-026/027 upstream'de, FR-028 merge sırasında eklendi). Aynı geçişte `plan.md`'deki diğer bayat ifadeler de düzeltildi: `VoiceService` çıkarıldı (ADR-0010 — sunucuda ses işleme yok), PDF `NEEDS CLARIFICATION` → unpdf (ADR-0009 ✅), açık ADR listesi kapatıldı (bulgu I3)
- [X] T113 [P] `docs/APP_FLOW.md:31,93` "tek seferlik" ifadelerini düzelt — `003` FR-009a (arşivli yeniden değerlendirme) ile çelişiyor; §5 düzeltilmiş, diyagram etiketi ve §93 cümlesi kalmış (bulgu I4)
- [X] T114 [P] FR-003'e `level` alanının **zorunlu** olduğunu yaz — spec "seçmesine izin VERMELİdir" diyor, zorunluluk yalnız `contracts/interview-api.md:50`, `quickstart S6.7` ve T043'te (`400`) (bulgu U1)
- [X] T115 [P] SC-001 (<30 sn) ile varsayılan LLM timeout'unun (30 sn) birebir aynı olmasından doğan sınır davranışını tanımla — timeout'u düşür veya SC-001'i yükselt (bulgu U2)
- [X] T116 [P] `TokenUsage.preAssessmentId` FK'sinin hangi migration'da geldiğini yaz: `tasks.md:111` düz kolon, `003/data-model.md:298` `@relation` — sıra yazılı değil (bulgu U3)
- [X] T117 [P] `docs/PLAN.md:44` "Başlamadan özet onay ekranı (meslek, N, tahmini süre)" **MVP** işlevini karara bağla: bu dilime FR + görev olarak ekle **veya** Bonus'a al — hiçbir spec'te FR'si, hiçbir `tasks.md`'de görevi yok (bulgu C1)
- [X] T118 [P] `checklists/requirements.md:37` "ADR-0011 rapor UI'ını bloklar" maddesini kaldır — ADR-0011 kapandı (T009 `[X]`), madde bayat (bulgu I6)
- [X] T119 [P] `details.retryable` alanını bu dilimin hata sözleşmesine de ekle veya `003`'ten kaldır — şu an yalnız `003`'te tanımlı, aynı hatalar `002`'de alanı taşımıyor (bulgu I8) — **çözüm 2026-08-05'te tamamlandı:** o gün yalnızca `contracts/interview-api.md` güncellenmiş, kod güncellenmemişti; bayrak artık `LlmError` base sınıfında üretiliyor, `003`'ün `toRetryableError()` sarmalaması kaldırıldı, regresyon testi `backend/test/unit/llm-errors.spec.ts`
- [X] T120 [P] Rapor şeması alan adlarının dilini tekleştir: `002` İngilizce (`overallImpression`) ↔ `003` Türkçe (`genelOzet`). Enum değerleri için gerekçe yazılı, **alan adları için değil** — birini seç ve `docs/API_CONVENTIONS.md`'ye yaz (bulgu I9)

### Not

- ~~**B1 (Groq Türkçe kalite spike'ı koşulmadı)**~~ — **kapandı (2026-08-04)**: T001 `[X]`, `LLM_MODEL = openai/gpt-oss-120b`, `docs/TECH_STACK.md` dolduruldu, ADR-0007 riski R4 kapandı. Spike koşuldu; ölçüm `spike-model-secimi.md` "Otomatik ölçüm (2026-08-04)" bölümünde (120b 7/7 şema, yanlış ret 0, kaçan ret 0). Koşumdan çıkan iki yeni bulgu **T125** (`max_tokens` tanımsız) ve **T126** (Groq 8000 TPM tavanı) olarak açıldı. Artık bloklayıcı değil.
- **A3 (`OwnershipGuard` oturumsuzda `403`)** bu dilimin **T039**'unu ilgilendirir: guard `404`'e çevrilirken oturumsuz dal da `401`'e çevrilmeli (`001` T076 ile aynı bulgu)

---

## Faz 12: FR-028 — İş İlanı Geçerlilik Kontrolü (Merge sonrası eklendi, 2026-08-04)

**Neden ayrı faz:** FR-028 (iş ilanı olmayan metni reddetme) tasarımı `main`'e merge edilmeden kaldı; T050/T052/T054 `[X]` işaretlendiğinde bu davranış **kodda yoktu**. Tamamlanmış görevler geriye dönük düzenlenmedi, iş buraya yeni görev olarak alındı.

**Kanıt:** T001 spike koşumu (2026-08-04) bu tasarımı ölçtü — `openai/gpt-oss-120b` ile 4 vakada **yanlış ret 0, kaçan ret 0**; talimat enjeksiyonu vakası da reddedildi (Anayasa İlke V). Ölçüm `spike-model-secimi.md`'de.

- [X] T121 [P] [US1] **Geçersiz iş ilanı testi (ÖNCE yaz)**: fake `rejection="not_a_job_posting"` + boş `questions` → `422` + `details.reason="not_a_job_posting"`, **hiçbir** `Interview`/`Question` kaydı oluşmaz, `TokenUsage` satırı **yazılır** (`interviewId=null`); yanıt gövdesinde model üretimi serbest metin **bulunmaz**. Kontrol grubu: fake `rejection=null` + N soru → `201` (dar ret eşiğinin gerçek ilanı bloklamadığı). Tutarsız çıktı (`rejection` dolu ama `questions` dolu) → `LlmSchemaError` → `502` (FR-028, SC-016, §4.1) — `backend/test/integration/us1-invalid-job-posting.spec.ts`
- [X] T122 [US1] Soru üretimi domain katmanını FR-028 ile genişlet: Zod şemasına `rejection: 'not_a_job_posting'|null` **ilk alan** olarak eklenir (alan sırası bağlayıcı — model kararı sorulardan önce yazmalı); `superRefine`: `rejection!==null` ise `questions` boş **ve** `position` null olmalı, aksi halde `LlmSchemaError`; `InvalidJobPostingError` sınıfı burada tanımlanır; prompt'a `GEÇERLİLİK KONTROLÜ` bölümü (dar ret eşiği — kuşkuda üret; gömülü talimat cümleleri ret sebebi değil) — `backend/src/interview/llm/question-generation.ts` (contracts/interview-flow-rules.md §4.1)
- [X] T123 [US1] `InterviewService.create`: `rejection` doluysa `InvalidJobPostingError` → `422` (`details.reason`, kullanıcı mesajı **sunucudan** üretilir, model metni gösterilmez); hiçbir kayıt oluşturulmaz, `TokenUsage` yine yazılır (FR-028) — `backend/src/interview/interview.service.ts` (T122'ye bağlı)
- [X] T124 [P] [US1] Frontend: `422` + `details.reason="not_a_job_posting"` durumunda form girilen metni **KAYBETMEDEN** kalır ve "girilen metin iş ilanı olarak anlaşılamadı" mesajı gösterilir — kullanıcı düzeltip tekrar deneyebilir (FR-028, Anayasa İlke VII) — `frontend/src/pages/interview/new.tsx`

---

## Faz 13: T001 Spike Ölçüm Bulguları (2026-08-04)

**Kaynak:** `model-spike.mjs` iki bağımsız koşumu — `spike-model-secimi.md` "Otomatik ölçüm (2026-08-04)". T001 kararı (`openai/gpt-oss-120b`) doğrulandı; aşağıdaki ikisi ölçüm sırasında ortaya çıktı.

- [X] T125 **`max_tokens` sözleşmede tanımsız (SC-002 riski)**: `docs/` ve `specs/` genelinde `max_tokens`/`max_completion_tokens` hiç geçmiyor. Ölçümde N=6 için 1682 output token görüldü; N=20'de ~5600 beklenir ve varsayılan tavan altında çağrı **komple `400`** döner (`strict` altında yarım JSON kısmi sonuç değildir) — bu SC-002'yi (%100 N eşleşmesi) düşürür. Yapılacak: `generateStructured` imzasına ve OpenAI-uyumlu adapter'a açık `max_tokens` ekle, `questionCount`'a göre ölçekle, `docs/API_CONVENTIONS.md` §3'e yaz — `backend/src/llm/llm.service.ts`, `backend/src/llm/providers/openai-compatible.provider.ts`, `docs/API_CONVENTIONS.md`
- [X] T126 **Sağlayıcı TPM tavanı FR-022 ile korunmuyor**: Groq ücretsiz katman **8000 token/dakika, organizasyon geneli** (ölçümde `rate_limit_exceeded` ile doğrulandı). Sistem prompt'u ~1450 input token, bir N=6 üretimi ~3000-5000 token → dakikada ~2 görüşme başlatma, **tüm uygulama için**. FR-022'nin kullanıcı-başına saatlik sınırı bu paylaşılan tavanı korumaz; eşzamanlı iki kullanıcı sağlayıcıdan `429` alır. Yapılacak: uygulama genelinde TPM-farkındalıklı kuyruk/geri çekilme kararı ver ve `docs/API_CONVENTIONS.md` §3.5'e yaz (ya da ücretli katman kararını ADR'ye bağla) — `docs/API_CONVENTIONS.md`, `docs/DECISIONS.md`

---

## Faz 14: FR-026 Genel Puan + FR-027 Soru Süre Sınırı (kapsama boşluğu, 2026-08-04)

**Neden ayrı faz:** Her iki gereksinim de `spec.md`'ye eklendi ama **hiç görev almadı** — analiz taramasında `tasks.md`, `backend/src`, `frontend/src` ve `schema.prisma`'da karşılığı bulunamadı (kapsama %92,9 FR / %87,5 SC). Sözleşme tarafı hazır: `contracts/interview-flow-rules.md` §4.3 ikisini de tanımlıyor.

**Zaten yapılmış olan:** `submit-answer.dto.ts` boş `content`'i kabul ediyor (`z.string()`, FR-027 yorumu düşülmüş) — sunucu tarafı hazır, eksik olan istemci ve rapor prompt'u.

### FR-026 — Rapor genel puanı

- [X] T127 [P] [US5] **Genel puan testi (ÖNCE yaz)**: rapor `ready` olduğunda `overallScore == round((technical+behavioral+general)/3)`; rapor tekrar açıldığında **aynı** değer döner (yeni LLM çağrısı yok); LLM yanıtında genel puan alanı gelirse **yok sayılır** (eksenlerle çelişen puan üretilemez); `ready` sonrası değer değişmez (FR-026, SC-014, FR-014) — `backend/test/integration/us5-report-overall-score.spec.ts`
- [X] T128 [US5] `Report` modeline `overallScore Int` ekle + migration üret/uygula; `data-model.md` Report tablosunu ve `Report` alan listesini güncelle — `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `specs/002-interview/data-model.md`
- [X] T129 [US5] Genel puanı **sunucuda** hesapla ve `Report` ile birlikte yaz: katman-2 Zod doğrulaması geçtikten **sonra** `Math.round((technical+behavioral+general)/3)`; LLM yanıtındaki muhtemel genel puan alanı yok sayılır (contracts/interview-flow-rules.md §4.3) — `backend/src/interview/interview.service.ts` (`prisma.report.create`, ~satır 337; T128'e bağlı)
- [X] T130 [P] [US5] Frontend rapor ekranında genel puanı göster; radar grafiğinin yanında **metin olarak da** verilir — grafik tek bilgi kaynağı olmaz (Anayasa İlke VII, ADR-0011/R2) — `frontend/src/pages/interview/report.tsx`

### FR-027 — Soru başına 90 sn süre sınırı

- [X] T131 [US2] Süre değerini **tek bir yapılandırma sabitinden** oku (`QUESTION_TIME_LIMIT_SECONDS = 90`), sonradan ayarlanabilir olsun. **Sunucuda zorlanmaz** — FR-027 açıkça "bilgilendiricidir, eleyici kısıt değildir" diyor; bu yüzden sabit istemci tarafında durur, ikinci bir kaynak açılmaz. Kararı `contracts/interview-flow-rules.md`'ye tek satır olarak yaz — `frontend/src/lib/interview-config.ts`, `specs/002-interview/contracts/interview-flow-rules.md`
- [X] T132 [US2] Frontend geri sayım + otomatik gönderim: her soru için 90 sn geri sayım gösterilir; süre dolunca o ana kadarki girdi (yazılmış metin **veya** işaretlenmiş seçenek) otomatik gönderilir, hiç girdi yoksa **boş string** gönderilir; akış kesintisiz sıradaki soruya geçer ve görüşme "devam ediyor"da takılı kalmaz (FR-027, SC-015) — `frontend/src/pages/interview/session.tsx`, `frontend/src/components/interview/question-card.tsx` (T131'e bağlı)
- [X] T133 [P] [US2] Frontend birim testi (sahte zamanlayıcı): süre dolumunda yazılmış metin varsa **o** gönderilir; hiç girdi yoksa boş cevap gönderilir; her iki durumda da sonraki soruya geçilir ve cevap kaybı olmaz (SC-015) — `frontend/test/question-timer.test.tsx`
- [X] T134 [US5] Rapor prompt'unda boş `content`'li cevapları **"cevap verilmedi"** olarak işaretle — atlanmaz, eksik cevap da değerlendirmenin girdisidir (FR-027, contracts/interview-flow-rules.md §4.3) — `backend/src/interview/llm/report.ts`
- [X] T135 [P] [US5] Boş cevaplı rapor testi: içinde boş cevap bulunan görüşmede rapor üretilir; LLM'e giden soru-cevap bloğunda o cevap **"cevap verilmedi"** olarak yer alır ve **atlanmamıştır** (FR-027) — `backend/test/integration/us5-report-unanswered.spec.ts`
- [X] T136 [P] **N aralığı sapması (1-20 → 5-20)**: FR-003 ve kod (`create-interview.dto.ts:10` → `.min(5).max(20)`) **5-20** diyor; `spec.md`, `data-model.md`, `contracts/interview-api.md` hizalı. Hâlâ **1-20** yazan yerler: `plan.md:16`, `quickstart.md:79`, `contracts/interview-flow-rules.md:217`, `tasks.md:162` (Faz 3 hedefi), `tasks.md:170` (T043), `tasks.md:181` (T051), `tasks.md:184` (T054). Tamamlanmış görev metinleri de bayat — düzeltilmeli, aksi halde ATDD zinciri yanlış aralığı gösteriyor

## Faz 15: FR-029 (meslek-bağımsız beceri dağılımı) + FR-030 (ön değerlendirme bağlamı) (2026-08-04)

> `003-pre-assessment`'ın meslek-bağımsızlık pivotu sonrası: (1) adaptif uyarlama artık yalnızca
> zorluk değil, adayın cevabındaki somut içeriğe de bağlanıyor; (2) soru üretimi ilandaki farklı
> beceri/soft-skill başlıklarını N soru arasında dağıtmaya çalışıyor ve yazılım-merkezli terim
> varsaymıyor; (3) aktif ön değerlendirme raporu artık gerçekten prompt'a bağlanıyor — daha önce
> `question-generation.ts`'te tanımlı ama hiç doldurulmayan ve **izole edilmemiş** (system prompt'a
> ham enterpolasyon) bir slot vardı, bu güvenlik açığı da bu turda kapatıldı.

- [X] T137 [US4] `adaptive.ts`: sistem talimatına taslak sorunun konusunu/odağını koruma + adayın cevabındaki somut içeriğe (proje/araç/olay) atıfla soru kurma kuralı eklendi; meslek-bağımsız ifade — `backend/src/interview/llm/adaptive.ts`
- [X] T138 [US1] `question-generation.ts`: sistem talimatına meslek-bağımsızlık + ilandaki farklı hard/soft beceri başlıklarını N soru arasında dağıtma kuralı eklendi — `backend/src/interview/llm/question-generation.ts`
- [X] T139 [US1] `preAssessmentContext?: string` (güvensiz, ham enterpolasyon) slotu kaldırıldı; yerine `hasPreAssessmentContext: boolean` (sistem talimatı) + `wrapPreAssessmentContextAsData()` (izole veri bloğu, `userData`'ya job posting ile birlikte eklenir) geldi (FR-030, `003-pre-assessment` FR-016 karşılığı) — `backend/src/interview/llm/question-generation.ts`, `backend/src/interview/interview.service.ts`
- [X] T140 [US1] `InterviewService.create`: aktif+tamamlanmış `PreAssessment` + `CompetencyReport` kaydı sorgulanır, varsa context bloğu oluşturulup LLM çağrısına eklenir; kayıt yoksa akış değişmeden devam eder (zorunlu bağımlılık değil) — `backend/src/interview/interview.service.ts`
- [X] T141 **Sanitizasyon paylaşılan hale getirildi**: `sanitizeFreeText` artık `interview/llm/prompt-shared.ts`'te (eskiden `pre-assessment/llm/sanitize.ts`) — iki dilim de aynı serbest metni farklı etiket adlarıyla sarmaladığından, etiket taklidi tespiti isme-özel bir liste yerine **jenerik** tag deseniyle yapılıyor. `pre-assessment/llm/sanitize.ts` silindi, 3 import sitesi güncellendi — `backend/src/interview/llm/prompt-shared.ts`, `backend/src/pre-assessment/dto/create-pre-assessment.dto.ts`, `backend/src/pre-assessment/llm/competency-report.prompt.ts`, `backend/test/unit/pa-us1-experience-level.spec.ts`
- [X] T142 [P] Test: `hasPreAssessmentContext=true` olsa da gerçek içerik sistem talimatına girmiyor; `wrapPreAssessmentContextAsData` çıktısı kendi etiketinde izole, etiket taklidi enjeksiyon dizisi etkisizleştiriliyor, boş `skills` satırı bloktan tamamen çıkıyor; adaptif sistem talimatı "konusunu koru + somut içeriğe bağlan" kuralını içeriyor — `backend/test/unit/prompt-isolation.spec.ts`

## Faz 16: FR-031..FR-034 (İpucu & Rehberlik Paneli, bonus, GitHub issue #48) (2026-08-05)

> Soru ekranına soru bazlı bir "İpucu & Rehberlik" paneli eklenir: `tip` (cevap rehberliği)
> ve `rationale` (soru-ilan gerekçesi), soru üretimiyle **aynı LLM çağrısında** üretilir —
> ayrı çağrı yok. Panel varsayılan kapalı, kullanıcı açar; açma olayı yalnızca log olarak
> tutulur, rapor/skor etkilenmez (Hikâye 6, `contracts/interview-flow-rules.md` §4.1/§4.4,
> `contracts/interview-api.md` §7).

- [X] T143 [P] [US6] `Question` modeline `tip String?` ve `rationale String?` ekle + migration üret/uygula — `backend/prisma/schema.prisma`, `backend/prisma/migrations/`
- [X] T144 [US6] `question-generation.ts`: `questionSchema`'ya `tip`/`rationale` (`z.string().nullable()`) ekle; sistem talimatına bu alanları üretme kuralını (cevabı vermeyen kısa rehberlik + ilanla ilişkilendirilmiş kısa gerekçe, ikisi de `{language}` dilinde, üretilemezse `null`) ekle — `backend/src/interview/llm/question-generation.ts`
- [X] T145 [US6] `adaptive.ts`: `buildAdaptiveSchema`'nın `nextQuestion`'ına `tip`/`rationale` ekle; sistem talimatına uyarlanan soru için bu alanları da yeniden üretme kuralı ekle — `backend/src/interview/llm/adaptive.ts`
- [X] T146 [US6] `InterviewService.create`: `tx.question.createMany`'a `tip`/`rationale` (sanitize edilmiş) ekle; `adaptNextQuestion`: `tx.question.update`'e `tip`/`rationale` ekle; `QUESTION_SELECT`, `findOne` (`currentQuestion`, `answeredPairs`) çıktılarına alanları ekle — `backend/src/interview/interview.service.ts`
- [X] T147 [US6] Depolamadan önce `tip`/`rationale`'ı `sanitizeFreeText` ile temizle (İlke V, FR-033) — `backend/src/interview/interview.service.ts` (veya `llm/question-generation.ts` çıktısını normalize eden yardımcı)
- [X] T148 [US6] Panel açma olayı için `POST /api/interviews/:id/panel-events` uç noktası: DTO (`questionOrder` pozitif tam sayı, `tab` enum `hint|rationale`), guard zinciri `SessionGuard`+`InterviewOwnershipGuard`, `Logger.log` ile yapılandırılmış log satırı, `204` — `backend/src/interview/dto/panel-event.dto.ts`, `backend/src/interview/interview.controller.ts`, `backend/src/interview/interview.service.ts`
- [X] T149 [P] [US6] Backend testi: soru üretimi `tip`/`rationale` `null` döndürse de görüşme başarıyla oluşur (zorunlu değil); adaptif uyarlama bu alanları günceller, başarısız olursa mevcut değerler korunur — `backend/test/integration/us6-hint-panel-fields.spec.ts`
- [X] T150 [P] [US6] Backend testi: `panel-events` uç noktası geçerli gövdede `204` döner, geçersiz `tab`'da `400`, yabancı görüşmede `404`; bu çağrı `TokenUsage`/rapor içeriğini hiç etkilemez — `backend/test/integration/us6-panel-events.spec.ts`
- [X] T151 [US6] `Question`/`AnsweredPair` frontend tiplerine `tip`/`rationale` ekle; `logPanelEvent()` istemci fonksiyonu ekle (fire-and-forget, hata UI'ı bloklamaz) — `frontend/src/lib/interview-client.ts`
- [X] T152 [US6] `HintGuidancePanel` bileşeni: varsayılan kapalı collapsible + "İpucu"/"Neden bu soru?" iki sekme (radix-ui `Collapsible`+`Tabs`); açılışta `logPanelEvent` çağrısı (sekme başına en fazla bir kez); her iki alan da `null` ise panel gizlenir — `frontend/src/components/interview/hint-guidance-panel.tsx`
- [X] T153 [US6] Soru ekranına (yazılı VE sözlü mod) paneli entegre et — soru kartının yanına/altına yerleştir, soru değiştiğinde panel kapanışa döner — `frontend/src/pages/interview/session.tsx`
- [X] T154 [P] Çeviri anahtarları (`hintPanel.*`: "İpucu Göster", "İpucu", "Neden bu soru?", boş durum metni) — `frontend/src/lib/i18n/locales/tr/interview.json`, `frontend/src/lib/i18n/locales/en/interview.json`
- [X] T155 [P] [US6] Frontend testi: panel varsayılan kapalı render olur; açılınca sekmeler arası geçiş doğru içeriği gösterir; `tip`/`rationale` her ikisi de yoksa panel hiç render olmaz; açılışta `logPanelEvent` bir kez tetiklenir — `frontend/test/hint-guidance-panel.test.tsx`
