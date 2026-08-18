---

description: "T001 devralma doğrulaması + implementasyon sırasında bulunan sapmalar (2026-08-04)"
---

# Devralma Doğrulaması (T001, T002, T003, T004)

**Tarih**: 2026-08-04 | **Yöntem**: `002-interview` kaynak kodu doğrudan okunarak
karşılaştırıldı (bkz. `backend/src/llm/**`, `backend/src/common/**`, `backend/src/interview/**`).

## T001 — LLM/ortak altyapı sözleşme uygunluğu

| Bileşen | Dosya | Durum |
|---------|-------|-------|
| `LlmService.generateStructured()` | `backend/src/llm/llm.service.ts` | ✅ Uygun. İmza: `schema`, `schemaName`, `systemPrompt`, `userData`, `timeoutMs?`, `operation`, `userId`, `interviewId?`, `preAssessmentId?`. `contracts/llm-contract.md` §1 ile eşleşiyor. |
| `llm.errors.ts` (3 sınıf) | `backend/src/llm/llm.errors.ts` | ✅ `LlmTimeoutError`→504, `LlmSchemaError`/`LlmProviderError`→502. `HttpException` tabanlı, global filtre otomatik eşliyor. |
| `schema-to-provider.ts` (katman-1) | `backend/src/llm/schema-to-provider.ts` | ✅ `z.toJSONSchema()` + strict-mod temizliği (minLength/maxLength/minItems/maxItems/pattern/format çıkarılıyor, `additionalProperties:false`, tüm alanlar `required`). **Önemli**: opsiyonellik `.optional()` DEĞİL `.nullable()` ile ifade edilmeli (Groq strict kısıtı) — bu dilimin şemasında opsiyonel alan yok, etkilenmiyoruz. |
| `token-usage.service.ts` + `TokenUsage` | `backend/src/llm/token-usage.service.ts` | ✅ `operation`, `preAssessmentId` alanları hazır; başarısız çağrıda da yazıyor. |
| `common/language.ts` | ✅ `resolveLanguage()` — Accept-Language → tr\|en, İlke bozulmamış. |
| `common/guards/llm-rate-limit.guard.ts` | ✅ `LlmRateLimitGuard` + `llmQuota(n)` — kota **controller metodunda** `@Throttle` ile verilir, guard'a gömülü değil. Bu dilim `llmQuota(5)` kullanacak. |
| `common/http-exception.filter.ts` | ✅ Ortak zarf `{statusCode,error,message,details?}`, sağlayıcı yanıtı sızdırmıyor. |
| `TokenUsage`/`LlmOperation.pre_assessment`/`ReportLanguage`/`ExperienceLevel` | `backend/prisma/schema.prisma` | ✅ Hepsi mevcut, `pre_assessment` enum değeri zaten tanımlı. |
| `backend/test/fakes/fake-llm.provider.ts` | ✅ `enqueue()`/`always()`/`reset()` — gerçek sağlayıcıya istek atmadan senaryo kurulabiliyor. |

**Sonuç**: Sapma yok. Bu dilimde hiçbir devralınan dosya değiştirilmedi.

## T002 — `.env` doğrulaması

`LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` (spike sonucu `openai/gpt-oss-120b`
dolu), `LLM_REQUEST_TIMEOUT_MS=30000` — kök `.env.example`'da hepsi mevcut. Ek işlem gerekmedi.

## T003 — Frontend veri çekme bağımlılığı: **TanStack Query KURULMADI (plan sapması)**

`plan.md`/`tasks.md` TanStack Query'yi "bu dilimin tek yeni bağımlılığı" olarak öngörmüştü.
Ancak `002-interview`'in gerçek implementasyonu incelendiğinde TanStack Query'nin **hiç
kurulmadığı** görüldü (`frontend/package.json`'da yok) — kurulu gerçek desen düz `fetch` +
`useState`/`useEffect` (bkz. `lib/interview-client.ts`, `pages/interview/list.tsx`).

**Karar**: Bu dilim de aynı deseni kullanır, TanStack Query eklenmez. Gerekçe: tek bir dilim
için tüm projede başka hiçbir yerde kullanılmayan bir veri-çekme kütüphanesi eklemek İlke IV
(tutarlı dikey desen) ile çelişir ve gereksiz bir bağımlılıktır. Sonuç: **bu dilim yeni backend
VEYA frontend bağımlılığı eklemez** (plan.md'nin "0 backend" notu frontend'i de kapsayacak
şekilde genişletildi).

## T004 — Klasör iskeleti

Faz 2/3'te dosyalar doğrudan oluşturuldu (`backend/src/pre-assessment/`, `dto/`, `llm/`,
`constants/`, `frontend/src/components/pre-assessment/`, `frontend/src/pages/pre-assessment/`)
— ayrı bir "iskelet" adımına gerek kalmadı.

## Ek bulgu — `details.retryable` devralınan hata sınıflarında YOK ✅ KAPANDI (2026-08-05)

> **Çözüldü:** Bayrak `LlmError` base sınıfına taşındı; üç hata sınıfı da artık
> `details.retryable: true` üretiyor ve bu dilimin `toRetryableError()` sarmalaması
> **kaldırıldı**. Aynı geçişte `002-interview`'in kendi sözleşmesindeki (o da alanı
> vaat ediyordu ama üretmiyordu) sapma da kapandı. Regresyon koruması:
> `backend/test/unit/llm-errors.spec.ts`. Aşağıdaki metin bulgunun tarihsel kaydıdır.


`contracts/llm-contract.md` §5 ve `pre-assessment-api.md`, `502`/`504` yanıtlarının
`details.retryable: true` taşımasını şart koşar (frontend "tekrar dene" düğmesi bunu
kullanır). Ancak devralınan `backend/src/llm/llm.errors.ts` bu alanı **eklemiyor** —
yalnızca `{ message }` gövdesi üretiyor. Devralınan dosya bu dilimde **değiştirilmedi**;
bunun yerine `pre-assessment.service.ts` kendi sınırında (`toRetryableError()`) hatayı
yeni bir `HttpException` ile sarmalayıp `details.retryable: true` ekliyor. Bu davranış
`docs/API_CONVENTIONS.md` §3.4'e not düşüldü — `002-interview` kapsamında `llm.errors.ts`'e
taşınırsa bu dilimin sarmalaması kaldırılabilir.

## Ek bulgu — E2E test şeması (`test_e2e`) partial unique index'i UYGULAMIYORDU

`backend/test/global-setup.js`, entegrasyon testlerini izole `test_e2e` şemasında
çalıştırmak için `prisma db push` kullanıyor. `db push` **yalnızca `schema.prisma`
DSL'ini senkronlar** — DSL'de ifade edilemeyen partial unique index (FR-004, `pre_assessment_one_active_per_user`)
bu yolla **hiç oluşmuyordu**. Sonuç: T043 eşzamanlılık testi ilk yazıldığında DB kısıtı
gerçekte yoktu ve iki eşzamanlı istek de `201` dönüyordu (yanlış-pozitif geçen bir test
değil, gerçekten kısıtsız bir DB'ye karşı test edilmiş oluyordu).

**Düzeltme**: `backend/prisma/manual-constraints.sql` eklendi (idempotent, `IF NOT EXISTS`)
ve `global-setup.js`, `db push`'tan **sonra** bu dosyayı `prisma db execute` ile ayrıca
uyguluyor artık. Gerçek migration'daki (`migrations/<ts>_pre_assessment/migration.sql`)
satırla içerik olarak aynı, iki ayrı dosya olarak tutuluyor çünkü migration dosyaları
tekrar çalıştırılabilir (idempotent) olmak zorunda değil, ama `db push` her test
çalıştırmasında yeniden senkronlanıyor.

⚠️ **Bu, Prisma DSL'in ifade edemediği herhangi bir gelecekteki kısıt için de geçerli bir
desendir** — `002-interview`/`005-admin` benzer bir elle-migration ihtiyacı duyarsa aynı
`manual-constraints.sql` dosyasına satır eklenmeli, ayrı dosyalar açılmamalı.

## Ek bulgu (2026-08-04, meslek-bağımsızlık turu) — hız sınırı testleri kendi kendine 429'a çarpıyor

`LlmRateLimitGuard` guard olduğu için **`ZodValidationPipe`'tan önce** çalışır; dolayısıyla
`400` dönen istekler bile 5/saat kotasını tüketir (FR-013 "başarılı + başarısız birlikte
sayılır" tasarımının doğal sonucu). Beşten fazla `POST` yapan bir test dosyası tek
kullanıcıyla çalıştığında 6. istekten itibaren `400` yerine `429` alır ve asıl senaryoyu
hiç test edemez. Bu tuzağa bu oturumda `pa-us1-validation` ve `pa-us1-enum-guard`
dosyaları düştü (ayrıca `004-history` oturumunda `002-interview` testlerinde de yaşanmış).

**Düzeltme**: `test/integration/helpers/pa-app.ts` içine `freshUser()` yardımcısı eklendi;
çok istekli test dosyaları her senaryo için taze kullanıcı açıyor.

## Ek bulgu (2026-08-04) — serbest metin sanitizasyonu DTO sınırında olmalı

İlk implementasyonda `sanitizeFreeText()` yalnızca prompt oluşturulurken uygulanıyordu;
ham değer veritabanına olduğu gibi yazılıyordu. Yetenek etiketinde **null byte** (`U+0000`)
gönderen bir test bunu yakaladı: PostgreSQL `text` kolonu null byte kabul etmediği için
istek `500` döndü (`400` değil). Ayrıca bu, `002-interview`'e context olarak taşınacak
verinin de kirli kalması demekti.

**Düzeltme**: sanitizasyon DTO'nun `.transform()` adımına taşındı — artık hem DB'ye hem
prompt'a **temizlenmiş** değer gidiyor. Uzunluk doğrulaması bilinçli olarak **ham girdi**
üzerinde kalıyor (kullanıcının formda gördüğü sınırla aynı olsun diye), sanitizasyon
ondan sonra uygulanıyor.

## Ek bulgu (2026-08-04) — eşzamanlılık testi yanlış invariant'ı doğruluyordu

`T043` testi iki eşzamanlı `POST` için `[201, 409]` bekliyordu ve tam paket koşusunda
**flaky**'ydi. İnceleme sonucu `[201, 201]`'in de **geçerli** bir sonuç olduğu görüldü: iki
transaction serileşirse ikincinin `updateMany` adımı birincinin satırını görüp arşivler ve
kendisi aktif olur — bu tam olarak meşru "yeniden değerlendirme" akışıdır (FR-009a), hata
değil. `409` yalnızca iki transaction'ın birbirini görmeden ilerlediği dar pencerede oluşur;
hangi dalın çalışacağı zamanlamaya bağlıdır.

**Düzeltme**: test artık FR-004/SC-007'nin **gerçek** garantisini doğruluyor — sonuç ne
olursa olsun aynı anda birden fazla aktif kayıt bulunamaz (partial unique index bunu DB
seviyesinde sağlar). `P2002 → 409` eşlemesi ise ayrı ve **deterministik** bir birim
testine taşındı (`test/unit/pa-us2-conflict-mapping.spec.ts`).

## Ek bulgu — test dosyası adı çakışması (tasks.md sapması)

`tasks.md` bu dilimin testlerini `us1-create-happy.spec.ts`, `us1-validation.spec.ts` gibi
adlarla planlıyordu. Ancak `backend/test/integration/` altında **`002-interview`'in kendi
US1 testleri zaten bu adları kullanıyor** (`us1-create-happy.spec.ts`, `us1-create-validation.spec.ts`,
vb. — her dilim kendi "Hikâye 1"ine göre adlandırmış). Çakışmayı önlemek için bu dilimin test
dosyaları **`pa-` öneki** ile adlandırıldı (`pa-us1-create-happy.spec.ts` vb.). `tasks.md`
implementasyon sırasında bu isimlerle güncellendi.
