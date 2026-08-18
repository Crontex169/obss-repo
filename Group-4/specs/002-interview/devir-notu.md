# Devir Notu — `002-interview` → `003-pre-assessment`

**Dilim**: `002-interview` (inşa sahibi) | **Devralan**: `003-pre-assessment`
**Tarih**: 2026-08-01 | **Görev**: T102/T108

Bu belge, `docs/API_CONVENTIONS.md`'de "inşa sahibi `002-interview`" olarak
işaretlenen paylaşılan altyapının **gerçekten** devralınmaya hazır olduğunu
kod okuyarak doğrular ve bilinen sapmaları/dikkat noktalarını kaydeder.
`003-pre-assessment` bu altyapıyı **yeniden kurmaz**, olduğu gibi kullanır.

---

## 1. `LlmService` yüzeyi — HAZIR ✅

`backend/src/llm/llm.service.ts` — tek giriş noktası `generateStructured<T>()`.

- İmza `docs/API_CONVENTIONS.md` §3.1 ile birebir uyumlu (bu oturumda
  doğrulandı ve dokümandaki eksik `schemaName: string` alanı eklendi — T097/T106).
- `operation: LlmOperation` alanı zaten `pre_assessment` değerini içeriyor
  (`prisma/schema.prisma` `enum LlmOperation`), yani `003-pre-assessment`
  şema migration'ı **beklemeden** bu operasyonu kullanabilir.
- `preAssessmentId?: string` alanı `GenerateStructuredArgs`'ta ve
  `TokenUsageService`'te zaten mevcut (bkz. §4 aşağıda) — `003` yeni bir alan
  eklemeden doğrudan geçebilir.
- Timeout: varsayılan `LLM_REQUEST_TIMEOUT_MS` (30 sn), çağrı başına
  `timeoutMs` override edilebilir (`002-interview` rapor çağrısı 60 sn
  kullanıyor — örnek zaten kod tabanında, `003` kendi ihtiyacına göre
  aynı deseni kullanabilir).
- İki katmanlı doğrulama (sağlayıcı JSON Schema + runtime Zod) ve hata
  sınıfları (`LlmTimeoutError`/`LlmSchemaError`/`LlmProviderError`) domain'den
  bağımsız — `003`'ün kendi şeması/promptu için ek kod **gerekmez**.

**Sapma yok.**

## 2. Ortak guard (`LlmRateLimitGuard`) — HAZIR ✅

`backend/src/common/guards/llm-rate-limit.guard.ts`.

- Limit guard'a **gömülü değil**; her uç nokta `@LlmRateLimit(llmQuota(N))`
  ile kendi kotasını bildirir. `003-pre-assessment` için hedef limit
  (`docs/API_CONVENTIONS.md` §3.5 tablosu) zaten **5/saat** olarak
  belgelenmiş — guard kodunda değişiklik gerekmez, yalnızca
  `POST /api/pre-assessments` üzerine `@UseGuards(LlmRateLimitGuard)` +
  `@LlmRateLimit(llmQuota(5))` eklenir (aynı `002-interview`
  controller'larındaki kalıp, bkz. `interview.controller.ts`).
- Sayaç kullanıcı bazlı (`getTracker` → `req.user.id`), IP'ye düşme yalnızca
  oturumsuz istekler için (normalde `SessionGuard` önce çalıştığından bu yola
  düşülmez).

**Sapma yok.**

## 3. `common/language.ts` — HAZIR ✅

`resolveLanguage(acceptLanguage?: string): 'tr' | 'en'` — `Accept-Language`
başlığından çözümleme, `003-pre-assessment` aynı fonksiyonu **import edip**
kullanabilir. Dil istek gövdesinde taşınmaz; üretilen kayıt (`PreAssessment.language`)
kendi dilini saklamalı — bu `002-interview`'daki `Interview.language` deseninin
birebir tekrarı olmalı (data-model.md zaten bu alanı öngörüyor).

**Sapma yok.**

## 4. `TokenUsage` tablosu — HAZIR ✅

`prisma/schema.prisma` `model TokenUsage`:

- `operation: LlmOperation` enum'unda `pre_assessment` değeri **zaten var**.
- `preAssessmentId: String?` kolonu **zaten var** (FK'siz — `PreAssessment`
  modeli henüz yok, `003` kendi migration'ında FK'yi bağlayabilir; kolonun
  kendisi veri kaybı olmadan kullanılabilir durumda).
- Denormalize toplam/rollup alanı **yok** (bilinçli, §4.1) — `003` da
  `Interview.totalTokens` benzeri bir alan **eklemez**, `SUM()` ile okur.
- Tek tablo kuralı: `003-pre-assessment` kendi maliyet tablosunu **açmaz**,
  bu tabloya yazar (`TokenUsageService.record()` zaten domain'den bağımsız).

**Bilinen sapma/dikkat noktası:** `preAssessmentId` alanının Prisma
`@relation` FK'si henüz **tanımlı değil** (yalnızca düz `String?`). `003`
migration'ında `PreAssessment` modeli eklenirken bu kolona FK eklenmesi
gerekecek — mevcut satırlarda veri kaybı olmaz (kolon adı/tipi değişmez),
yalnızca referans bütünlüğü sonradan bağlanır. Bu, `002-interview` Faz 2
kararında (`implementation-log.md`) zaten gerekçelendirilmişti.

## 5. Paylaşılan LLM fake — HAZIR ✅

`backend/test/fakes/fake-llm.provider.ts` (`FakeLlmProvider`) — `LlmProvider`
port sınırında takılan, sıralı senaryo kuyruğu (`enqueue`) ve varsayılan
senaryo (`always`) destekleyen paylaşılan test çifti. `003-pre-assessment`
testleri:

- Gerçek sağlayıcıya **istek atmaz** (Anayasa İlke VI/maliyet+belirlenemezlik).
- `enqueue({ content: ... })` ile kendi şemasına uygun sahte yapılandırılmış
  yanıtı kuyruğa koyar; `enqueue({ error: new LlmTimeoutError() })` gibi hata
  senaryolarını simüle edebilir (`002-interview`'ın `us5-report-timeout` /
  `us1-create-llm-failure` testlerinde zaten kullanılan kalıp).
- `calls` dizisi üzerinden **kaç kez** ve **hangi argümanlarla** çağrıldığı
  doğrulanabilir (ör. "yeniden LLM çağrısı yapılmadı" — SC-007 benzeri
  kurallar için).

**Sapma yok.**

## 6. Prompt/şema paylaşılan yardımcılar (bonus bulgu, T101/T109 sonrası)

Bu yakınsama oturumunda `backend/src/interview/llm/prompt-shared.ts`
oluşturuldu (`LANGUAGE_NAME`, `wrapAsUserData`). Bu dosya **interview'e özel
değildir** — `003-pre-assessment` da dil adı eşleme ve kullanıcı verisi
izolasyon sarmalayıcısına ihtiyaç duyacağından, `003` kendi `pre-assessment/llm/`
klasöründen bu dosyayı **import edebilir** (dosya taşınmadı, `interview/llm/`
altında kalmaya devam ediyor — gerekirse `003` başladığında
`common/llm-prompt-shared.ts`'e taşınıp iki dikeyin de import ettiği bir konuma
alınması **önerilir**, ama bu bir blocker değildir).

---

## Özet

| Bileşen | Durum | Not |
|---------|-------|-----|
| `LlmService.generateStructured` | ✅ Hazır | `operation`/`preAssessmentId` zaten destekli |
| `LlmRateLimitGuard` + `llmQuota()` | ✅ Hazır | `003` yalnızca `@LlmRateLimit(llmQuota(5))` ekler |
| `common/language.ts` | ✅ Hazır | Doğrudan import |
| `TokenUsage` tablosu | ✅ Hazır (FK sonradan) | `preAssessmentId` FK'siz `String?`, migration'da bağlanacak |
| Paylaşılan LLM fake | ✅ Hazır | `backend/test/fakes/fake-llm.provider.ts` |
| Prompt yardımcıları (`prompt-shared.ts`) | ✅ Kullanılabilir | Taşıma opsiyonel, blocker değil |

**Sonuç:** `003-pre-assessment` implementasyonuna başlamak için `002-interview`
tarafında **hiçbir eksik altyapı yok**. Tek dikkat noktası `TokenUsage.preAssessmentId`
FK'sinin `003` migration'ında bağlanmasıdır (veri kaybı riski yok).
