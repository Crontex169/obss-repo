# Phase 1 Veri Modeli: Görüşme (Interview)

**Dilim**: `002-interview` | **Tarih**: 2026-07-30 | **ORM**: Prisma / PostgreSQL 16

Bu belge, Görüşme dilimine ait çekirdek tabloları (`Interview`, `Question`, `Answer`,
`Report`) tanımlar. Bu dilim, **001-auth-rol** dilimindeki `User` varlığına
(`id`, `email`, `role`) bağımlıdır ve onu yeniden tanımlamaz; `Interview.userId`,
`User.id`'ye referans verir.

**Cross-cutting bağımlılıklar** (`docs/API_CONVENTIONS.md`): token/maliyet kaydı
`TokenUsage` tablosundadır ve şema sahibi `specs/003-pre-assessment/data-model.md`'dir; bu
dilim tabloyu **inşa eder ve kullanır**, yeniden tanımlamaz. `ReportLanguage` ve
`ExperienceLevel` enum'ları da aynı belgeden gelir.

---

## Varlık Genel Bakış

| Varlık | Amaç | Spec karşılığı |
|--------|------|----------------|
| **Interview** | Bir mock interview oturumu; sahibi, ilan, mod, durum | Anahtar Varlık "Görüşme", FR-001/003/005 |
| **Question** | Görüşmeye ait üretilmiş tek bir soru | Anahtar Varlık "Soru", FR-004/006 |
| **Answer** | Bir soruya verilen tek cevap | Anahtar Varlık "Cevap", FR-006/007/008 |
| **Report** | Tamamlanmış görüşmenin nihai değerlendirmesi | Anahtar Varlık "Değerlendirme Raporu", FR-013/014 |
| **TokenUsage** | Her LLM çağrısının token/maliyet kaydı — **cross-cutting**, şema sahibi `003-pre-assessment` | FR-016, İlke VI |

---

## Interview

Bir kullanıcının başlattığı tek bir mock interview oturumunu temsil eder.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String (cuid/uuid) | PK |
| `userId` | String | FK → `User.id` (001-auth-rol) — **sahip**, cascade delete |
| `jobPostingSource` | Enum (`text` \| `pdf`) | İlanın giriş biçimi (FR-001) |
| `jobPostingText` | String (uzun metin) | Serbest metin veya PDF'ten çıkarılmış metin (FR-002) |
| `jobPostingFileName` | String? | PDF yüklendiyse orijinal dosya adı (denetim) |
| `questionCount` | Int | N — **5-20** aralığında (FR-003, Netleştirmeler) |
| `mode` | Enum (`written` \| `voice`) | Yazılı / sözlü real-time sesli asistan (FR-003) |
| `adaptiveEnabled` | Boolean | Görüşme bazlı seçim; hesap genelinde değil (FR-010, Netleştirmeler) |
| `status` | Enum (`in_progress` \| `completed`) | Soru-cevap akışının durumu (FR-005, FR-012) |
| `reportStatus` | Enum (`not_applicable` \| `pending` \| `ready` \| `failed`) | Rapor üretim ara durumu (FR-015, research.md §5) |
| `currentQuestionOrder` | Int | Sıradaki (henüz cevaplanmamış) sorunun `order` değeri — resume/sıralı kilit için (FR-009) |
| `position` | String? | İlandan çıkarılan pozisyon/meslek adı — **soru üretimi LLM çağrısının aynı yanıtında** döner, ek çağrı yok. Admin meslek filtresi + istatistikleri ve dashboard kartı bunu kullanır (`docs/PLAN.md` 1.1, `docs/APP_FLOW.md` §6). İlandan çıkarılamazsa `null` → admin filtresinde "Belirsiz" kovası |
| `level` | Enum `ExperienceLevel` (`intern` \| `junior` \| `senior`) | Görüşme zorluk seviyesi — **kullanıcı seçer** (`docs/PLAN.md` MVP). Kullanıcının aktif `PreAssessment` kaydı varsa form bu değerle **ön-doldurulur**; zorunlu bağımlılık **değildir** |
| `language` | Enum `ReportLanguage` (`tr` \| `en`) | Soru ve rapor üretim dili — `Accept-Language` başlığından çözümlenir (`docs/API_CONVENTIONS.md` §4.2). Kayıtta saklanır, böylece arşivden okunduğunda dil değişmez |
| `completedAt` | DateTime? | `status="completed"` geçişinde yazılır. **Görüşme süresi = `completedAt − createdAt`** — admin "ortalama görüşme süresi" istatistiğinin tek kaynağı (`docs/PLAN.md` 1.1). Ayrı `startedAt` tutulmaz; `createdAt` başlangıç sayılır |
| `deletedAt` | DateTime? | Soft-delete işareti (İlke VI) — silme **uç noktası** `004-history` kapsamında; bu dilim alanı ve **liste filtresini** hazırlar (`docs/API_CONVENTIONS.md` §4.3) |
| `createdAt` | DateTime | `@default(now())` — görüşme başlangıcı (süre hesabının alt sınırı) |
| `updatedAt` | DateTime | `@updatedAt` |

> **Kaldırılan alanlar — `totalTokens` / `totalCostUsd`:** Çapraz analizde kaldırıldı.
> Token/maliyet toplamları `TokenUsage` tablosundan `SUM()` ile hesaplanır
> (`docs/API_CONVENTIONS.md` §4.1). Denormalize rollup, bu ölçekte kazanç sağlamadan iki
> kaynağı senkron tutma borcu yaratıyordu. FR-016 ("token/maliyet ilgili görüşme kaydına
> kaydedilir") `TokenUsage.interviewId` FK'sı ile karşılanır.

**Doğrulama kuralları**:
- `questionCount` 5-20 aralığı dışında olamaz (FR-003); aralık dışı değer `400` ile reddedilir.
- `jobPostingText` boş olamaz; PDF'ten metin çıkarılamazsa görüşme **oluşturulmaz** (FR-002, FR-019).
- `mode="voice"` iken üretilecek tüm `Question` kayıtları yalnızca `open_ended` tipinde olmalıdır (FR-004).
- `status="completed"` olmadan `Report` **oluşturulamaz**.
- **Üretilen soru sayısı `questionCount`'a eşit olmalıdır.** Bu garanti yalnızca **katman-2
  Zod doğrulamasında** vardır — `minItems`/`maxItems` sağlayıcı şemasından çıkarılır
  (`docs/API_CONVENTIONS.md` §3.3). Sayı uymazsa `LlmSchemaError` → görüşme **oluşturulmaz**
  (FR-019 ile aynı yol).
- `completedAt`, `status="completed"` ile **aynı transaction'da** yazılır; biri varsa diğeri
  de olmalıdır (`status="in_progress"` iken `completedAt` daima `null`).

**Durum geçişleri (`status`)**:
- **Başlangıç**: Geçerli iş ilanı + N + mod ile başarılı LLM soru üretimi → `in_progress`
  (FR-005). Soru üretimi başarısız olursa `Interview` **hiç oluşturulmaz** (FR-019).
- **Devam**: Sorular sırayla cevaplanır; `currentQuestionOrder` her cevaptan sonra ilerler (FR-009).
- **Tamamlanma**: Soru N cevaplanınca → `completed` **ve `completedAt = now()`** (tek yönlü,
  geri dönüşü yok — FR-012).

**Durum geçişleri (`reportStatus`)**:
- `not_applicable` (varsayılan, `status="in_progress"` iken) → `status="completed"` olduğunda
  otomatik `pending`'e geçer ve rapor üretimi eşzamanlı tetiklenir.
- `pending` → `ready` (LLM başarılı, `Report` oluşturuldu) veya `failed` (LLM hata/zaman aşımı — FR-015).
- `failed` → kullanıcı yeniden dener → `pending` → `ready`/`failed` (tekrar).
- `ready` bir kez ulaşıldıktan sonra **değişmez**; tekrar görüntüleme LLM'i yeniden çağırmaz (FR-014, SC-007).

**İlişkiler**: `Interview *—1 User` (001-auth-rol), `Interview 1—* Question`,
`Interview 1—1 Report` (yalnızca `reportStatus="ready"` iken var), `Interview 1—* TokenUsage`
(cross-cutting — `003-pre-assessment/data-model.md` sahibi).

---

## Question

Bir görüşmeye ait, LLM tarafından üretilmiş tek bir soru.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `interviewId` | String | FK → `Interview.id` (cascade delete) |
| `order` | Int | 1..N; görüşme içinde **benzersiz** (FR-006) |
| `type` | Enum (`multiple_choice` \| `open_ended`) | Yazılı modda karışık; sözlü modda yalnızca `open_ended` (FR-004) |
| `text` | String | Soru metni |
| `options` | String[]? | Yalnızca `type="multiple_choice"` için seçenek listesi |
| `tip` | String? | **(FR-031, İpucu & Rehberlik)** Soruya nasıl daha iyi cevap verilebileceğine dair kısa, genel rehberlik (format/uzunluk/yaklaşım); cevabı doğrudan vermez. LLM aynı soru üretim çağrısında üretir; üretemezse `null` — soru yine geçerlidir, alan **zorunlu değildir**. |
| `rationale` | String? | **(FR-031)** LLM'in bu soruyu neden sorduğuna, ilan metninin hangi kısmını/gereksinimini ölçtüğüne dair kısa açıklama (soru-ilan izlenebilirliği). Aynı çağrıda üretilir, `null` olabilir. |
| `adaptedFromAnswerId` | String? | Adaptif akışta bu soru hangi önceki cevaba göre güncellendiyse referansı (FR-010) |
| `isBaseline` | Boolean | `@default(true)`; adaptif uyarlama ile içerik değiştirildiyse `false` |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Doğrulama kuralları**:
- `(interviewId, order)` çifti **benzersiz** olmalı.
- `type="multiple_choice"` ise `options` en az 2 öğe içermeli.
- Bir `Question`'a bağlı `Answer` **varsa**, bu `Question`'ın `text`/`options`/`type` alanları
  **artık değiştirilemez** (kullanıcıya gösterilmiş ve cevaplanmış soru donar — adaptif
  güncelleme yalnızca henüz gösterilmemiş/cevaplanmamış `order`'a uygulanır, research.md §4).
- `tip`/`rationale`, LLM çıktısından geldiği için diğer serbest metin alanları gibi
  saklanmadan önce `sanitizeFreeText` ile temizlenir (kontrol karakteri + etiket taklidi
  temizliği, İlke V — `llm/prompt-shared.ts`); adaptif uyarlama bu alanları günceller
  (hedef soru henüz gösterilmemişse, aynı `isBaseline`/`adaptedFromAnswerId` kuralına tabi).

**İlişki**: `Question *—1 Interview`, `Question 1—0..1 Answer`.

---

## Answer

Kullanıcının belirli bir soruya verdiği yanıtı temsil eder.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `questionId` | String | FK → `Question.id` (cascade delete), **benzersiz** (bir soruya en fazla bir cevap) |
| `content` | String | Serbest metin veya seçilen seçenek değeri |
| `sourceMode` | Enum (`written` \| `voice`) | Cevabın hangi modda verildiği (research.md §6) |
| `answeredAt` | DateTime | `@default(now())` — cevaplanma zamanı |

**Doğrulama kuralları**:
- `questionId` **benzersiz** olmalı — bir soruya en fazla bir cevap bağlanabilir; kayıt
  oluşturulduktan sonra **immutable** (güncelleme/silme yasak — FR-007).
- `Question.type="multiple_choice"` ve `content` **boş değilse**, `content` o sorunun
  `options` listesinden biri olmalı; değilse `400` ile reddedilir (FR-008).
- `content` **boş string olabilir** — süre sınırı dolduğunda hiçbir girdi yapılmamış demektir
  (FR-027). Boş cevap geçerli bir kayıttır; akış sıradaki soruya geçer ve rapor prompt'unda
  "cevap verilmedi" olarak işaretlenir. Boş cevap ile "cevap yok" (henüz `Answer` kaydı
  oluşmamış) farklı durumlardır.
- Yalnızca ilgili `Interview.currentQuestionOrder` ile eşleşen `Question.order` için
  `Answer` oluşturulabilir (sıralı kilit — FR-006, research.md §4).

**İlişki**: `Answer 1—1 Question`.

---

## Report

Tamamlanmış bir görüşmenin LLM tarafından üretilen nihai değerlendirmesi.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String | PK |
| `interviewId` | String | FK → `Interview.id` (cascade delete), **benzersiz** (1—1) |
| `overallImpression` | String | Genel İzlenim metni (FR-013) |
| `strengths` | String[] | Güçlü Yönler listesi |
| `improvementAreas` | String[] | Geliştirilmesi Gereken Alanlar listesi |
| `technicalScore` | Int | 0-100 yüzdesel skor (FR-013, Netleştirmeler) |
| `behavioralScore` | Int | 0-100 yüzdesel skor |
| `generalScore` | Int | 0-100 yüzdesel skor |
| `overallScore` | Int | 0-100 **genel puan** — LLM üretmez; `round((technical+behavioral+general)/3)` ile hesaplanıp yazılır (FR-026). Rapor kaydıyla saklanır, böylece formül sonradan değişse bile geçmiş raporların puanı kaymaz |
| `additionalNotes` | String[]? | İsteğe bağlı ek değerlendirme notları — Prisma kolonu optional, ama LLM şemasında (Groq `strict`) Zod tarafı `.nullable()` (`string[] \| null`), **`.optional()` değil** (§3.3) |
| `questionFeedback` | Json | **Soru bazlı geri bildirim (issue #68)** — `[{ order, verdict: "dogru"\|"kismen"\|"yetersiz", correctAnswer, explanation }]`. İlişkisel tablo değil Json: hiçbir sorgu bu içeriği filtrelemiyor/join'lemiyor, raporla birlikte yazılıp raporla birlikte okunuyor. `@default("[]")` — bu alan eklenmeden önce üretilmiş raporlarda boş dizi |
| `generatedAt` | DateTime | `@default(now())` |

**Doğrulama kuralları**:
- `technicalScore`, `behavioralScore`, `generalScore` **0-100** aralığında olmalı.
- `overallScore`, yazım anında üç eksenin yuvarlanmış ortalamasına eşit olmalı (FR-026);
  LLM yanıtından okunmaz, `scores` doğrulandıktan **sonra** sunucuda hesaplanır.
- `questionFeedback[].order`, o görüşmenin **cevaplanmış** bir sorusuna karşılık gelmeli ve
  aynı `order` iki kez bulunmamalı; sunucu yazmadan önce eler (issue #68).
- Bir `Interview`'a en fazla bir `Report` bağlanabilir (`interviewId` benzersiz);
  yeniden üretim, mevcut kaydı **değiştirmez** — mevcut sözleşmede rapor bir kez
  `ready` olduktan sonra sabittir (FR-014).

**İlişki**: `Report 1—1 Interview`.

---

## TokenUsage *(cross-cutting — bu dilime ait DEĞİL, bu dilim inşa eder)*

> ⚠️ **Değişiklik notu (çapraz analiz):** Bu dilim önceden kendi `LlmUsageLog` tablosunu
> tanımlıyordu. `003-pre-assessment` ise aynı amaç için cross-cutting `TokenUsage` tablosunu
> tanımlamıştı — kolonları uyumsuz (`tokens` ↔ `inputTokens`/`outputTokens`), `userId` ve
> `provider`/`model` alanları eksikti ve `005-admin` sorgularını iki tablonun `UNION`'ına
> çeviriyordu. **`LlmUsageLog` kaldırıldı; tek tablo `TokenUsage`'dır**
> (`docs/API_CONVENTIONS.md` §4.1).

Şema tanımının **sahibi**: `specs/003-pre-assessment/data-model.md`.
Fiili **inşa sahibi**: bu dilim — implementasyon sırası Auth → Interview → Pre-assessment
olduğundan `TokenUsage` tablosu, `LlmOperation` enum'u ve `ReportLanguage` enum'u bu dilimin
migration'ında oluşur.

Bu dilimin kullandığı alanlar:

| Alan | Bu dilimdeki değer |
|------|--------------------|
| `operation` | `question_generation` \| `adaptive_evaluation` \| `interview_report` |
| `interviewId` | İlgili `Interview.id` (FR-016 bağlantısı) |
| `userId` | Görüşme sahibi — admin kullanıcı bazlı maliyet sorgusu için |
| `preAssessmentId` | Bu dilimde daima `null` |
| `succeeded` | Başarısız çağrılar da kaydedilir (İlke VI) |

Yazım, paylaşılan `LlmModule` içinde `generateStructured()` tarafından yapılır — çağıran
servis unutamaz (`docs/API_CONVENTIONS.md` §3.1). Bu dilimde **ekranlaştırılmaz**
(`005-admin` kapsamı).

**İlişki**: `TokenUsage *—0..1 Interview`.

---

## İlişki Diyagramı (mantıksal)

```text
┌────────────┐  1—*   ┌──────────────┐
│    User    │───────▶│   Interview  │  status: in_progress|completed
│ (001-auth) │        │  userId,     │  reportStatus: not_applicable|pending|ready|failed
└────────────┘        │  mode, N,    │  position, level, language
                       │  adaptive    │  completedAt, deletedAt
                       └──────┬───────┘
             1—*             │            1—1              1—*
     ┌───────────────────────┼─────────────────────┬────────────────┐
     │                       │                      │                │
┌────▼─────┐         ┌───────▼──────┐        ┌──────▼─────┐   ┌──────▼───────────┐
│ Question │  1—0..1  │   (Answer    │        │   Report   │   │ TokenUsage       │
│ order,   │─────────▶│   via        │        │ 3 eksen    │   │ (cross-cutting)  │
│ type     │          │ Question.id) │        │ skor       │   │ operation,       │
└──────────┘          └──────────────┘        └────────────┘   │ interviewId,     │
                                                                │ in/outTokens     │
                                                                └──────────────────┘
```

---

## Gereksinim İzlenebilirliği

| Alan/Kural | Gereksinim |
|------------|-----------|
| `Interview.userId` sahiplik | FR-005, FR-017 (001-auth-rol bağımlılığı) |
| `questionCount` 5-20 | FR-003 |
| `jobPostingSource`/`jobPostingText` + PDF hata durumu | FR-001, FR-002, FR-019 |
| `mode="voice"` → yalnızca `open_ended` | FR-004, Netleştirmeler |
| `Question.order` benzersizliği + sıralı kilit | FR-006, FR-007 |
| `Answer` immutability + seçenek doğrulaması | FR-007, FR-008 |
| `Interview.currentQuestionOrder` (resume) | FR-009 |
| `adaptiveEnabled` (görüşme bazlı) + `isBaseline`/`adaptedFromAnswerId` | FR-010, FR-011 |
| `status` → `completed` geçişi | FR-012 |
| `Report` 3 eksen 0-100 skor | FR-013 |
| `Report.overallScore` (eksenlerden türetilen genel puan) | FR-026, SC-014 |
| `Answer.content` boş olabilir (süre dolumu) | FR-027, SC-015 |
| `reportStatus="ready"` sonrası yeniden LLM çağrısı yok | FR-014, SC-007 |
| `reportStatus="pending"/"failed"` ara durum | FR-015 |
| `TokenUsage.interviewId` (cross-cutting maliyet kaydı) | FR-016, İlke VI |
| `deletedAt` (soft-delete temeli + liste filtresi) | İlke VI (Anayasa), `API_CONVENTIONS.md` §4.3 |
| Üretilen soru sayısı = `questionCount` (katman-2 Zod) | FR-004, FR-005, `API_CONVENTIONS.md` §3.3 |
| `position` (admin meslek filtresi + kart başlığı) | `docs/PLAN.md` 1.1, `docs/APP_FLOW.md` §2/§6 |
| `completedAt` (ortalama görüşme süresi) | `docs/PLAN.md` 1.1, `docs/APP_FLOW.md` §2 |
| `level` (zorluk seviyesi, kullanıcı seçimi) | `docs/PLAN.md` Fonksiyon Backlog (MVP) |
| `language` (`Accept-Language` → tr/en) | `docs/PLAN.md` Fonksiyon Backlog (MVP), `API_CONVENTIONS.md` §4.2 |
