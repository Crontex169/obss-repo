# Hızlı Başlangıç & Doğrulama: Görüşme (Interview)

**Dilim**: `002-interview` | **Tarih**: 2026-07-30

Bu belge, Görüşme diliminin **uçtan uca çalıştığını kanıtlayan** doğrulama
senaryolarını tanımlar. Uygulama ayrıntıları (kod, migration gövdeleri) burada
tekrarlanmaz; bkz. [plan.md](./plan.md), [data-model.md](./data-model.md),
[contracts/](./contracts/). Senaryolar spec'teki Türkçe Gherkin kabul kriterlerine
bağlıdır (ATDD, İlke III). Bu dilim, **001-auth-rol** diliminin çalışır durumda
olduğunu (kayıtlı/oturum açmış kullanıcı) önkoşul kabul eder.

---

## Ön Koşullar

- 001-auth-rol dilimi kurulu ve çalışır durumda (bkz.
  [001-auth-rol/quickstart.md](../001-auth-rol/quickstart.md)); test için oturum
  açmış en az bir `user` rolündeki hesap.
- Node.js 20 LTS, npm/pnpm, Docker (local PostgreSQL).
- `.env` dosyası `.env.example`'dan türetilmiş; 001-auth-rol değişkenlerine ek olarak
  bu dilime özgü değişkenler (research.md §9) tanımlı.
- LLM sağlayıcı API anahtarı: **Groq** (birincil) veya **DeepSeek** (yedek) — ADR-0007.
  Testlerde gerçek sağlayıcıya **istek atılmaz**; `LlmProvider` port sınırındaki paylaşılan
  fake (`backend/test/fakes/fake-llm.provider.ts`) kullanılır.

### Ortam değişkenleri (`.env.example` → `.env`, bu dilime özgü ekler)

`LLM_PROVIDER` (`groq` | `deepseek`), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`,
`LLM_REQUEST_TIMEOUT_MS` (varsayılan `30000`; rapor çağrısı kod içinde `60000` ile
override eder — `docs/API_CONVENTIONS.md` §3.2), `PDF_MAX_SIZE_MB`.

**`VOICE_*` değişkeni YOKTUR** — sözlü mod tarayıcı Web Speech API ile çalışır (ADR-0010);
sunucu tarafında ses işleme ve sağlayıcı anahtarı gerekmez.

`LLM_MODEL` değeri Faz 1 spike'ının çıktısıdır (ADR-0007 / R4, R5).
Tam liste: [research.md §9](./research.md).

---

## Kurulum

```bash
# 1) PostgreSQL zaten çalışıyor olmalı (001-auth-rol kurulumu)

# 2) Backend
cd backend
npm install
npx prisma migrate dev          # Interview/Question/Answer/Report + TokenUsage tabloları
npm run start:dev               # NestJS — InterviewModule /api/interviews/*

# 3) Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

**Sağlayıcı durumu:** LLM sağlayıcı **ADR-0007** (Groq + DeepSeek, tek `openai` SDK) ve
sözlü mod **ADR-0010** (tarayıcı Web Speech API) karara bağlandı. PDF kütüphanesi
(**ADR-0009**) hâlâ açık — `PdfExtractionService` arayüzü arkasında geçici hafif bir
kütüphaneyle ilerlenir. Testlerde LLM daima **fake** ile çalışır (maliyet + belirsizlik);
gerçek sağlayıcıya istek atan test **yazılmaz**.

**Grafik:** Recharts, shadcn/ui `Chart` bileşenleri üzerinden (**ADR-0011** ✅) — kurulum
`npx shadcn add chart`. Bloklayan açık karar **kalmadı**.

---

## Doğrulama Senaryoları

Her senaryo bir kabul kriterine eşlenir. ✅ = beklenen sonuç.

### S1 — İş ilanı girme ve soru üretimi *(Hikâye 1)*
1. Oturum açmış kullanıcı, serbest metin iş ilanı + `questionCount=8` + `mode=written`
   ile `POST /api/interviews` gönderir.
   ✅ `201`; `Interview(status="in_progress")` oluşur, tam olarak **8** `Question` üretilir,
   yanıt ilk soruyu içerir.
2. Aynı istek PDF dosyası ile (`jobPostingSource=pdf`) gönderilir.
   ✅ Sunucu PDF'ten metni çıkarır, aynı soru üretim akışı çalışır.
3. `questionCount=25` gönderilir (aralık dışı, 5-20).
   ✅ `400`, geçerli aralığı belirten doğrulama hatası.
4. Boş metin veya taranmış/bozuk PDF gönderilir.
   ✅ `400`/`422`, "iş ilanı içeriği okunamadı/eksik" mesajı.
5. LLM soru üretimi hata/zaman aşımı verir (fake LLM ile simüle edilir).
   ✅ `502/504`; **hiçbir** `Interview` kaydı oluşmaz; tekrar deneme mesajı.

### S2 — Sıralı soru-cevap akışı *(Hikâye 2)*
1. Soru 1 cevaplanır (`POST /api/interviews/:id/answers`, `questionOrder=1`).
   ✅ `200`; cevap kaydedilir, yanıt soru 2'yi döner; soru 2 bu ana kadar hiç dönmemiştir.
2. Son soru (N) cevaplanır.
   ✅ `Interview.status="completed"`, `reportStatus="pending"` → rapor üretimi tetiklenir.
3. Zaten cevaplanmış soru 1'e tekrar cevap gönderilir.
   ✅ `409`, "zaten cevaplanmış".
4. Sırası gelmemiş soru 5'e (soru 2 aktifken) doğrudan cevap gönderilir.
   ✅ `409`, "sıradaki soru bu değil".
5. Çoktan seçmeli bir soruya listede olmayan bir değer gönderilir.
   ✅ `400`, geçerli seçenek uyarısı.

### S3 — Yarıda bırakma ve devam etme (Resume) *(Hikâye 3)*
1. 3 soru cevaplanmış "devam ediyor" bir görüşmeye `GET /api/interviews/:id` ile
   yeniden dönülür.
   ✅ `200`; önceki 3 soru-cevap değişmeden görünür, aktif soru = soru 4.
2. Aynı kullanıcının birden fazla "devam ediyor" görüşmesi var; biri ilerletilir.
   ✅ Yalnızca seçilen görüşme değişir; diğerleri "devam ediyor" kalır (edge).
3. Kullanıcı B, kullanıcı A'nın görüşmesini `id` bilerek açmaya çalışır.
   ✅ `404`, içerik sızmaz.
4. Günlerdir cevaplanmamış bir görüşmeye dönülür.
   ✅ Hâlâ "devam ediyor" kabul edilir, otomatik iptal yok (edge).

### S4 — Adaptif soru akışı (bonus) *(Hikâye 4)*
1. `adaptiveEnabled=true`; güçlü bir cevap verilir (fake LLM ile simüle edilir).
   ✅ Bir sonraki soru, zorluğu artırılmış/derinleştirilmiş içerikle döner
   (`Question.isBaseline=false`).
2. Zayıf bir cevap verilir.
   ✅ Bir sonraki soru daha temel seviyede döner; toplam soru sayısı **N** sabit kalır.
3. Uyarlama LLM çağrısı hata/zaman aşımı verir (fake LLM ile simüle edilir).
   ✅ Akış **kesilmez**; sıradaki soru baseline haliyle (`isBaseline=true`) sunulur.
4. `adaptiveEnabled=false` bir görüşmede sorular cevaplanır.
   ✅ Sorular hiç değişmeden, üretim anındaki sabit sırayla sunulur.

### S5 — Değerlendirme raporu üretimi *(Hikâye 5)*
1. Son soru cevaplanır.
   ✅ Sistem otomatik olarak tüm soru-cevapları LLM'e gönderir; rapor (Genel İzlenim,
   Güçlü Yönler, Geliştirilmesi Gereken Alanlar, 3 eksen 0-100 skor) üretilir;
   `reportStatus="ready"`.
2. `GET /api/interviews/:id/report` tekrar çağrılır.
   ✅ Kaydedilmiş aynı rapor döner; **yeni bir LLM çağrısı yapılmaz** (SC-007).
3. Rapor üretimi hata/zaman aşımı verir (fake LLM ile simüle edilir).
   ✅ `reportStatus="failed"`; cevaplanmış sorular/cevaplar **kaybolmaz**;
   `POST /api/interviews/:id/report/retry` ile yeniden denenebilir.
4. Kullanıcı B, kullanıcı A'nın tamamlanmış görüşme raporuna `id` bilerek erişmeye
   çalışır.
   ✅ `404`, rapor içeriği sızmaz.

### S6 — Cross-cutting davranışlar *(çapraz analiz sonrası eklenen gereksinimler)*

1. `Accept-Language: tr-TR` ile görüşme başlatılır.
   ✅ `Interview.language="tr"`; sorular ve rapor Türkçe. Aynı görüşme
   `Accept-Language: en-US` ile açılır → içerik dili **değişmez** (FR-020, SC-009).
2. `Accept-Language: de-DE` (veya başlık yok) ile başlatılır.
   ✅ `Interview.language="en"` (TR dışı her değer `en`'e düşer).
3. Pozisyon adı içeren bir ilanla görüşme başlatılır.
   ✅ `Interview.position` dolu döner ve **ek LLM çağrısı yapılmamıştır** (aynı yanıt);
   pozisyon içermeyen ilanda `position=null` ama görüşme yine `201` (FR-023, SC-011).
4. Aynı kullanıcı bir saat içinde 4. görüşmeyi başlatmaya çalışır.
   ✅ `429` + `details.retryAfterSeconds`; mevcut görüşmeleri etkilenmez (FR-022, SC-010).
5. Görüşme tamamlanır.
   ✅ `completedAt` yazılır; süre = `completedAt − createdAt` hesaplanabilir (FR-024, SC-012).
6. Aktif ön değerlendirmesi **olmayan** bir kullanıcı görüşme başlatır.
   ✅ `201` — ön değerlendirme zorunlu bağımlılık değildir (FR-021, SC-013).
7. `level` alanı gönderilmeden istek yapılır.
   ✅ `400` (FR-003). Aktif ön değerlendirme varsa frontend bu alanı **ön-doldurur**
   (sunucu zorunluluğu değişmez).
8. Sözlü mod: tarayıcı `SpeechRecognition` desteklemiyor (stub ile simüle edilir).
   ✅ Sözlü mod seçeneği UI'da devre dışı; kullanıcı yazılı moda yönlendirilir; sessiz
   başarısızlık yok (FR-025).
9. `TokenUsage` doğrulaması: bir görüşmede soru üretimi + rapor tamamlanır.
   ✅ `operation` değerleriyle satırlar yazılmış, `interviewId` bağlı; **başarısız** bir LLM
   çağrısı sonrası da satır var (`succeeded=false`) — FR-016.

---

## Test Bağlama (ATDD)

- Backend entegrasyon/e2e: Jest + Supertest — S1…S5 uç nokta sözleşmelerini
  doğrular; LLM `LlmProvider` port sınırındaki paylaşılan **fake** ile, PDF geçici kütüphaneyle
  test edilir (LLM/PDF sağlayıcı kararından bağımsız).
- Frontend: Vitest + RTL (soru-cevap akışı, dosya yükleme UX), Playwright
  (uçtan uca senaryo — soru üretiminden rapor görüntülemeye).
- Sözlü mod: `voice-client.ts` (Web Speech API, ADR-0010) Vitest'te yetenek tespiti ve
  zarif bozulma açısından test edilir — tarayıcı API'si stub'lanır. Sunucu tarafı sözlü/yazılı
  ayrımı yapmadığı için ek backend testi gerekmez.
- Kırmızı → Yeşil → Refactor: testler koddan önce yazılır (İlke III). Soru üretimi
  ve değerlendirme raporu **kritik akış** olduğundan test kapsamı olmadan
  birleştirilmez (merge).

## Başarı Kriteri Doğrulaması

| Senaryo | Başarı Kriteri |
|---------|----------------|
| S1.1 (soru üretim süresi) | SC-001 (<30 sn) |
| S1.1/S1.2 (N eşleşmesi) | SC-002 (%100) |
| S2.3 / S2.4 | SC-003 (%0 sıra ihlali) |
| S3.1 | SC-004 (%100 kayıpsız devam) |
| S5.1 | SC-005 (%95'i <60 sn) |
| S3.3 / S5.4 | SC-006 (%100 yetkisiz ret) |
| S5.2 | SC-007 (%100 yeniden LLM çağrısı yok) |
| S1.5 / S5.3 | SC-008 (%100 kayıpsız yeniden deneme) |
| S6.1 / S6.2 | SC-009 (%100 dil tutarlılığı) |
| S6.4 | SC-010 (%100 sınır aşımı reddi) |
| S6.3 | SC-011 (≥%90 pozisyon çıkarımı, %100 kayıpsız oluşturma) |
| S6.5 | SC-012 (%100 tamamlanma zamanı) |
| S6.6 | SC-013 (%100 ön değerlendirmesiz başlatma) |

---

## Doğrulama Koşusu Sonucu (T100/T107)

**Tarih:** 2026-08-01 · **Ortam:** Local (Docker `auth-postgres` + backend Jest,
LLM `LlmProvider` port sınırındaki paylaşılan fake ile — gerçek sağlayıcıya istek
**atılmadı**).

| Senaryo | Doğrulayan test(ler) | Sonuç |
|---------|----------------------|-------|
| S1.1-S1.4 | `us1-create-happy`, `us1-create-pdf`, `us1-create-validation`, `us1-question-count-mismatch` | ✅ |
| S1.5 | `us1-create-llm-failure` | ✅ |
| S2.1-S2.2 | `us2-sequential-flow`, `us2-completion` | ✅ |
| S2.3-S2.4 | `us2-order-lock`, `us2-answer-immutable` | ✅ |
| S2.5 | `us2-mc-validation` | ✅ |
| S3.1-S3.2 | `us3-resume`, `us3-multiple-active` | ✅ |
| S3.3 | `us3-resume-unauthorized` | ✅ |
| S3.4 | `us3-resume` (edge — otomatik iptal yok) | ✅ |
| S4.1-S4.2 | `us4-adaptive-uplevel`, `us4-adaptive-downlevel` | ✅ |
| S4.3 | `us4-adaptive-fallback` | ✅ |
| S4.4 | `us4-adaptive-disabled` | ✅ |
| S5.1-S5.2 | `us5-report-happy`, `us5-report-cached` | ✅ |
| S5.3 | `us5-report-failure`, `us5-report-timeout`, `us5-report-retry`, `us5-retry-rate-limit` | ✅ |
| S5.4 | `us5-report-unauthorized`, `us5-ownership-guard` | ✅ |
| S6.1-S6.2 | `us1-language` | ✅ |
| S6.3 | `us1-position` | ✅ |
| S6.4 | `us1-rate-limit`, `us2-answer-rate-limit` | ✅ |
| S6.5 | `us2-completion` (`completedAt` alanı) | ✅ |
| S6.6 | `us1-create-happy` (aktif ön değerlendirme olmadan başlatma — `003-pre-assessment` henüz yok, doğal olarak sağlanıyor) | ✅ |
| S6.7 | `us1-create-validation` (`level` zorunlu) | ✅ |
| S6.8 | Sözlü mod yetenek tespiti/zarif bozulma | ✅ — `frontend/test/voice-client.test.ts` (T095/T105) |
| S6.9 | `token-usage.spec.ts` (birim) + `us5-report-happy`/`us1-create-llm-failure` (satır yazımı, `succeeded=false` dahil) | ✅ |
| Uçtan uca (S1-S6 tarayıcı akışı) | `frontend/test/e2e/interview-flows.spec.ts` (Playwright, T094/T104) | ✅ — `10/10` yeşil |

**Suite özeti:** Backend birim `56/56` yeşil, backend entegrasyon `98/98` yeşil
(`npx prisma generate` + `npx prisma migrate deploy` sonrası, Postgres
`docker compose up -d postgres` ile ayakta). Frontend Vitest `28/28` yeşil
(yeni görüşme formu + chat akışı sıra kilidi + sözlü mod testleri dahil).
Playwright uçtan uca `10/10` yeşil (`npx playwright test`, `frontend/test/e2e/interview-flows.spec.ts`,
S1/S2/S3/S5/S6 senaryoları; backend REST yüzeyi ve LLM/PDF çağrıları
`page.route()` ile fake'lenir — Anayasa İlke VI: "gerçek sağlayıcıya istek
atan test yazılmaz" ve S4 adaptif akış UI'da gözlemlenebilir ayrı bir
uç nokta sunmadığından bu dosyada ayrıca kapsanmadı, birim/entegrasyon
testlerinde zaten doğrulanıyor).

**Bilinen kapsam dışı:** Gerçek Groq/DeepSeek sağlayıcıya giden test **yok**
(bilinçli tasarım — bkz. Ön Koşullar); gerçek tarayıcı Web Speech API'si de
testlerde her zaman stub'lanır (ADR-0010, tarayıcı desteği makineden makineye
değişir).
