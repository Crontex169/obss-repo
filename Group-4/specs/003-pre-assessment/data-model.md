# Phase 1 Veri Modeli: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Dilim**: `003-pre-assessment` | **Tarih**: 2026-07-30 | **ORM**: Prisma / PostgreSQL 16

Bu belge, bu dilimin `backend/prisma/schema.prisma`'ya **eklediği** modelleri tanımlar.
`001-auth-rol` diliminin `User` / `Session` / `Account` / `Verification` modelleri
**değiştirilmez**; `User`'a yalnızca ilişki alanları eklenir (bkz. Çakışma Notu).

---

## Varlık Genel Bakış

| Varlık | Amaç | Spec karşılığı | Kapsam |
|--------|------|----------------|--------|
| **PreAssessment** | Bir kullanıcının bir ön değerlendirme girişimi | Anahtar Varlık "Ön Değerlendirme", FR-004/005/009a | Bu dilim |
| **CompetencyReport** | LLM'in ürettiği, şemaya göre doğrulanmış rapor | Anahtar Varlık "Yetkinlik Raporu", FR-006/006a/006b | Bu dilim |
| **TokenUsage** | Bir LLM çağrısının token + maliyet kaydı | Anahtar Varlık "Token Kullanımı", FR-010 | **Cross-cutting** — Interview + Admin dilimleri de kullanır |

---

## Enum'lar

> ⚠️ **2026-08-04 kapsam kararı:** `InterestArea` enum'u (frontend/backend/ml) **KALDIRILMIŞTIR** —
> ön değerlendirme girdisi meslek-bağımsız hale getirildi (spec.md FR-002). Aşağıdaki enum
> listesi bu karara göre yeniden yazılmıştır.

```prisma
// --- Meslek-bağımsız girdi enum'ları (FR-002, 2026-08-04) ---

enum ExperienceYears {
  none       // hiç çalışmadım
  lt1        // 1 yıldan az
  y1_3       // 1-3 yıl
  y3_5       // 3-5 yıl
  y5_10      // 5-10 yıl
  y10plus    // 10+ yıl
}

enum WorkStatus {
  employed_full   // tam zamanlı çalışıyorum
  employed_part   // yarı zamanlı çalışıyorum
  seeking         // iş arıyorum
  student         // öğrenciyim
}

enum EducationLevel {
  primary         // ilkokul
  secondary       // ortaokul
  high_school     // lise
  vocational      // meslek lisesi
  associate       // ön lisans
  bachelor        // lisans
  graduate        // lisansüstü
}

enum WorkPreference {
  hands_on        // elimle bir şeyler üretirken/tamir ederken
  people          // insanlarla iletişim kurarken
  detail_routine  // detaylı, düzenli, tekrar eden işlerde
  problem_solving // sürekli değişen, yeni problemler çözerken
  planning        // planlama, düzenleme, takip etme işlerinde
}

enum TeamPreference {
  alone           // tek başıma, kendi hızımda
  small_team      // küçük ekiple
  large_team      // kalabalık ekiple
  leading         // ekibi yöneterek
  no_preference   // farketmez
}

enum LearningStyle {
  shown           // birisi gösterirse
  by_doing        // kendim deneyerek
  written         // yazılı talimat okuyarak
  video           // video izleyerek
  mentorship      // ustanın yanında uzun süre çalışarak
}

enum ProblemApproach {
  self            // kendim çözmeye çalışırım
  ask_experienced // deneyimli birine sorarım
  report_manager  // yöneticime bildiririm
  research        // daha önce ne yapıldığına bakarım
  team_discussion // ekiple konuşup karar veririz
}

// --- Devralınan / cross-cutting ---

enum ExperienceLevel {
  intern
  junior
  senior
}

enum PreAssessmentStatus {
  generating   // üretim sürüyor
  completed    // rapor üretildi ve doğrulandı
  failed       // LLM hatası / şema uyumsuzluğu / timeout
}

enum ReportLanguage {
  tr
  en
}

enum ConfidenceLevel {
  dusuk
  orta
  yuksek
}

enum LlmOperation {
  pre_assessment        // 003-pre-assessment (bu dilim)
  question_generation   // 002-interview
  adaptive_evaluation   // 002-interview
  interview_report      // 002-interview
}
```

> **Not:** `LlmOperation` **tam listesi** yukarıdadır ve `docs/API_CONVENTIONS.md` §4.1 ile
> senkrondur. `TokenUsage` cross-cutting olduğu için değerler tek yerde toplandı.
> **Sıra notu:** Implementasyon sırası Auth → Interview → Pre-assessment olduğundan bu enum
> ve `TokenUsage` tablosu fiilen **`002-interview` diliminde** oluşturulur; bu dilim onu
> devralır ve `pre_assessment` değerini kullanır. Şema tasarımının sahibi bu belgedir.
> `ConfidenceLevel` değerleri Türkçe köklü ama **dilden bağımsız sabit** enum'dur
> (FR-018: alan adları ve enum değerleri çevrilmez).
>
> **`ExperienceLevel` bu dilimde artık bir kullanıcı girdisi DEĞİLDİR** (FR-002d):
> `experienceYears`'tan türetilir (`none`/`lt1` → `intern`, `y1_3`/`y3_5` → `junior`,
> `y5_10`/`y10plus` → `senior`). Enum'un kendisi `002-interview` tarafından kullanılmaya
> devam ettiği için korunur; bu dilim yalnızca türetilmiş değeri saklar ve
> `002-interview` FR-021 ön-doldurması bu değeri okur.

---

## PreAssessment

Bir kullanıcının bir ön değerlendirme girişimini temsil eder.

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String (cuid) | PK |
| `userId` | String | FK → `User.id` (cascade delete) |
| `experienceYears` | `ExperienceYears` | **Zorunlu**, tekli (FR-002) |
| `workStatus` | `WorkStatus` | **Zorunlu**, tekli (FR-002) |
| `educationLevel` | `EducationLevel?` | **Opsiyonel** (FR-002) |
| `workPreference` | `WorkPreference` | **Zorunlu**, tekli (FR-002 — çalışma tarzı a) |
| `teamPreference` | `TeamPreference` | **Zorunlu**, tekli (FR-002 — çalışma tarzı b) |
| `learningStyle` | `LearningStyle` | **Zorunlu**, tekli (FR-002 — çalışma tarzı c) |
| `problemApproach` | `ProblemApproach` | **Zorunlu**, tekli (FR-002 — çalışma tarzı d) |
| `selfRatings` | `Json` | **Zorunlu** — 8 meslek-bağımsız madde için 1-5 puan (FR-002a), aşağıdaki yapı |
| `skills` | `String[]` | **Opsiyonel** — serbest/önerili yetenek etiketleri (FR-002b); boş dizi geçerlidir |
| `openAnswers` | `Json?` | **Opsiyonel** — 3 kısa açık uçlu cevap (FR-002c), aşağıdaki yapı |
| `experienceLevel` | `ExperienceLevel` | **Türetilmiş** — kullanıcıya sorulmaz, `experienceYears`'tan hesaplanır (FR-002d) |
| `language` | `ReportLanguage` | Üretim dili (FR-017/019) |
| `status` | `PreAssessmentStatus` | `@default(generating)` |
| `isActive` | Boolean | `@default(false)` — yalnızca `completed` kayıtlarda `true` olabilir (FR-004) |
| `failureReason` | String? | `failed` durumunda kısa hata sınıfı (`timeout` / `schema` / `provider`) — kullanıcıya gösterilmez, tanı içindir |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Kısıtlar**:
- **Partial unique index** — kullanıcı başına en fazla bir aktif kayıt (FR-004, SC-007):
  ```sql
  CREATE UNIQUE INDEX pre_assessment_one_active_per_user
    ON "PreAssessment" ("userId") WHERE "isActive" = true;
  ```
  Prisma şemasında `@@index` ile ifade edilemediği için **elle yazılmış migration** olarak
  eklenir (bkz. Migration Notu).
- `@@index([userId, createdAt(sort: Desc)])` — arşiv listesi sorgusu için (FR-009a).
- `selfRatings` **tüm 8 maddeyi** içermelidir; her puan `1`–`5` arası tam sayı olmalıdır.
  Eksik madde, fazladan madde veya aralık dışı puan **400** ile reddedilir — LLM çağrılmaz
  (FR-003). Madde adları sunucu tarafında sabittir.
- `skills` (FR-002b) **serbest metin kabul eder**: en fazla **15 etiket**, etiket başına en
  fazla **40 karakter**; boş/yalnızca boşluk etiketler ve kontrol karakterleri reddedilir,
  tekrarlar tekilleştirilir. Sınır aşımı **400** ile reddedilir — LLM çağrılmaz.
- `openAnswers` (FR-002c) her alanı için en fazla **300 karakter**; sınır aşımı **400**.

**`selfRatings` JSON yapısı** (zorunlu, tam 8 madde — FR-002a):

```jsonc
{
  "dikkat_titizlik": 4,
  "ogrenme_hizi": 5,
  "iletisim": 3,
  "fiziksel_dayaniklilik": 4,
  "zaman_yonetimi": 3,
  "baski_altinda": 4,
  "sorumluluk": 5,
  "ekip_uyumu": 4
}
```

**`skills` yapısı** (opsiyonel, serbest + önerili — FR-002b):

```jsonc
["forklift kullanımı", "iş güvenliği", "ekip yönetimi"]
```

**`openAnswers` JSON yapısı** (opsiyonel — FR-002c):

```jsonc
{
  "enIyiOldugum": "...",     // maks 300 karakter
  "gelistirmekIstedigim": "...",
  "ikiYillikHedef": "..."
}
```

> **Bu üç alan neden `Json`/`String[]`, ayrı tablo değil?** Hepsi tek bir `PreAssessment`
> kaydına ait, bütün olarak okunan, en fazla birkaç düzine elemanlı veridir; hiçbir sorgu
> tek bir maddenin içine filtrelemez. Ayrı tablo bu ölçekte üç ek model ve JOIN maliyetinden
> başka bir şey getirmez.
>
> **Yetenek öneri listesi nereden gelir?** Sunucu tarafında sabit bir config'te tutulur
> (`backend/src/pre-assessment/constants/skill-suggestions.ts`). ⚠️ Bu liste bir
> **doğrulama listesi DEĞİLDİR** — yalnızca kullanıcıya öneri sunar. Liste dışı etiketler
> serbestçe girilebilir (FR-002b); doğrulama yalnızca uzunluk/adet üzerinden yapılır.

**Durum geçişleri**:

```text
                    LLM başarılı + şema geçti
  [yok] ──create──> generating ─────────────────> completed (isActive=true)
                        │                              │
                        │ hata/timeout/şema             │ yeniden değerlendirme
                        ▼                              ▼
                     failed                     completed (isActive=false)
                  (isActive=false)                  = arşivlenmiş
```

- **generating → completed**: LLM yanıtı şema doğrulamasını geçti. Aynı transaction içinde:
  kullanıcının varsa mevcut aktif kaydı `isActive=false` yapılır, yeni kayıt
  `isActive=true` olur (FR-009a). Partial unique index bu sırayı garanti altına alır.
- **generating → failed**: LLM hatası, boş yanıt, şema uyumsuzluğu veya 30 sn timeout
  (FR-008/008a). `isActive` `false` kalır; **mevcut aktif rapor değişmez** (Hikâye 2,
  kriter 5). `CompetencyReport` yazılmaz (FR-009).
- **completed → completed (isActive=false)**: Yeni bir değerlendirme aktif olduğunda
  arşivlenir. Kayıt **silinmez** (FR-009a).
- Terminal durumlar: `completed` ve `failed`. Geri dönüş yoktur.

**İlişkiler**: `PreAssessment *—1 User`, `PreAssessment 1—0..1 CompetencyReport`,
`PreAssessment 1—* TokenUsage`.

---

## CompetencyReport

Bir ön değerlendirmeye ait, LLM tarafından üretilmiş ve şemaya göre doğrulanmış rapor.
Yalnızca `status = completed` olan `PreAssessment` kayıtlarında bulunur (FR-009).

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String (cuid) | PK |
| `preAssessmentId` | String | FK → `PreAssessment.id`, **@unique** (1—0..1), cascade delete |
| `genelOzet` | String | Serbest metin özet (FR-006) |
| `gucluYonler` | `String[]` | Öne çıkan yönler, 2-6 madde (FR-006) |
| `gelisimAlanlari` | `String[]` | Geliştirilebilecek yönler, 2-6 madde (FR-006) |
| `calismaTarziOzeti` | String | Çalışma tarzı cevaplarından türeyen kısa metin (FR-006) |
| `guvenSeviyesi` | `ConfidenceLevel` | düşük/orta/yüksek (FR-006, İlke VII) |
| `createdAt` | DateTime | `@default(now())` |

> **2026-08-04 kapsam kararı:** `alanlar` (ilgi alanı başına güçlü/gelişim konuları) alanı
> **KALDIRILMIŞTIR**. Mesleğe/sektöre göre bölümleme, girdinin meslek-bağımsız hale
> gelmesiyle (FR-002) anlamını yitirdi. Yerine düz `gucluYonler` / `gelisimAlanlari`
> listeleri ve yeni `calismaTarziOzeti` alanı geldi.
>
> **Öğrenme yol haritası bu şemada YOKTUR** (2026-08-03 clarify — FR-006'dan çıkarıldı).
> Kişiye özel yol haritası artık görüşme (`002-interview`) tamamlandığında, o görüşmenin
> performansına dayalı olarak üretilir; bu modelde alan olarak bulunmaz.

**Doğrulama kuralları**:
- `genelOzet` en az 50 karakter; `calismaTarziOzeti` en az 30 karakter.
- `gucluYonler` ve `gelisimAlanlari` her biri **2-6 madde**; boş liste kabul edilmez.
- **Sayısal skor alanı YOKTUR** (FR-006b, SC-010). Şemada skor alanı tanımlanmaz;
  doğrulama fazladan alan gelirse reddeder (`strict` şema). Adayın `selfRatings`
  puanları rapora **puan olarak taşınmaz** ve bunlardan ortalama/toplam bir skor
  hesaplanmaz — yalnızca niteliksel yorumun girdisidir.
- **Mesleğe/sektöre göre bölümlenmiş bir yapı üretilmez** (SC-010).
- Tüm metinsel içerik `PreAssessment.language` dilinde olmalıdır (FR-018, SC-011).

> **`gucluYonler` / `gelisimAlanlari` neden `String[]`, ayrı tablo değil?** Her biri en
> fazla 6 kısa metin içerir, yalnızca sahibi ve admin tarafından bütün olarak okunur,
> hiçbir sorgu tek bir maddenin içine filtrelemez. FR-006a "makine-okunur yapılandırılmış
> veri" gereksinimi karşılanır — alanlar ayrı ayrı erişilebilir kalır (tek bir serbest
> metin bloğu değildir).

**İlişki**: `CompetencyReport 1—1 PreAssessment`.

---

## İnterview Context Transferi (FR-016)

Kullanıcının **aktif** (`isActive = true`, `status = completed`) `PreAssessment` kaydı
varsa, `002-interview`'in soru üretim servisi bu kaydı ve ilişkili `CompetencyReport`'u
**salt okunur** olarak okur ve tam içeriğini (`genelOzet`, `gucluYonler`, `gelisimAlanlari`,
`calismaTarziOzeti`, `guvenSeviyesi`) — ayrıca `PreAssessment.selfRatings` ve
`PreAssessment.skills` alanlarını — kendi LLM prompt'una **veri** olarak context şeklinde
verir (bkz. `contracts/llm-contract.md` §7).

- Bu, bu dilimde yeni bir yazma yolu **eklemez** — yalnızca mevcut modellere `002-interview`
  tarafında yeni bir okuma erişimi tanımlar.
- Aktif kayıt **yoksa** context boş geçilir; görüşme normal başlar (zorunlu bağımlılık değil).
- Bu okumanın kod tarafı `002-interview` kapsamındadır (bkz. `plan.md` § İleriye Dönük
  Bağımlılık); bu belge yalnızca **hangi alanların** okunacağının sözleşmesidir.

---

## TokenUsage *(cross-cutting)*

Bir LLM çağrısının maliyet kaydı. **Bu varlık bu dilime özgü değildir** — Interview
(soru üretimi, görüşme raporu) ve Admin (maliyet istatistikleri) dilimleri aynı tabloyu
kullanacaktır (İlke VI).

| Alan | Tip | Kısıt / Not |
|------|-----|-------------|
| `id` | String (cuid) | PK |
| `userId` | String | FK → `User.id` (cascade delete) — admin istatistikleri için |
| `operation` | `LlmOperation` | Hangi dilim/işlem ürettiği |
| `preAssessmentId` | String? | FK → `PreAssessment.id` (nullable) — bu dilimin bağlantısı |
| `interviewId` | String? | FK → `Interview.id` (nullable) — `002-interview` bağlantısı; "görüşme başına maliyet" (admin) bu alandan hesaplanır |
| `provider` | String | `groq` \| `deepseek` (ADR-0007) — sağlayıcı değişse de geçmiş kayıtlar anlamlı kalır |
| `model` | String | Model kimliği (`.env` → `LLM_MODEL`; spike ile netleşecek) |
| `inputTokens` | Int | Girdi token sayısı |
| `outputTokens` | Int | Çıktı token sayısı |
| `estimatedCostUsd` | Decimal(10,6) | Tahmini maliyet. **Groq ücretsiz katmanda `0`** — token sayıları yine kaydedilir, kota tüketimi maliyetten bağımsız izlenir (ADR-0007 / R1) |
| `succeeded` | Boolean | Çağrı başarılı mıydı (FR-010: başarısızlar da kaydedilir) |
| `createdAt` | DateTime | `@default(now())` |

**Kurallar**:
- Başarısız çağrılar da kaydedilir (`succeeded = false`) — sağlayıcı token tüketmişse
  maliyet takibinde boşluk oluşmaz (FR-010, Hikâye 5 kriter 2).
- Sağlayıcı token bilgisi döndürmediyse (ör. bağlantı hiç kurulamadı) `inputTokens` ve
  `outputTokens` `0` yazılır; kayıt yine oluşturulur.
- `TokenUsage` yazımı **başarısız olursa kullanıcı akışı bozulmaz** (Hikâye 5, kriter 3):
  hata yakalanır, loglanır, rapor kullanıcıya gösterilmeye devam eder. Sessizce yutulmaz.
- `@@index([userId, createdAt])`, `@@index([operation, createdAt])` ve `@@index([interviewId])`
  — admin istatistik sorguları ve görüşme başına maliyet için.
- **Denormalize toplam alanı yoktur.** `Interview.totalTokens` / `totalCostUsd` gibi rollup
  alanları kullanılmaz; toplamlar `SUM()` ile hesaplanır (`docs/API_CONVENTIONS.md` §4.1).
  Bu ölçekte rollup'ın kazancı yok, bedeli iki kaynağı senkron tutma borcu.

> **Neden dilime özel değil?** Admin paneli "toplam tüketilen token — zaman serisi" ve
> "görüşme başına maliyet" raporlayacak (`docs/APP_FLOW.md` bölüm 2). Her dilime ayrı
> maliyet tablosu, admin sorgusunu üç tablonun UNION'ına dönüştürürdü.
>
> ⚠️ Bu tabloya rakip bir tasarım (`LlmUsageLog`) `002-interview` diliminde ayrıca
> tanımlanmıştı; çapraz analizde tespit edilip **kaldırıldı**. Tek maliyet tablosu kuralı
> `docs/API_CONVENTIONS.md` §4.1'de kayıtlıdır.

**İlişkiler**: `TokenUsage *—1 User`, `TokenUsage *—0..1 PreAssessment`,
`TokenUsage *—0..1 Interview` (`002-interview`).

---

## İlişki Diyagramı (mantıksal)

```text
                    ┌────────────────────┐
                    │       User         │  (001-auth-rol — DEĞİŞTİRİLMEZ)
                    │  id, email, role   │
                    └─────────┬──────────┘
                    1—*       │       1—*
          ┌───────────────────┴───────────────────┐
          │                                       │
┌─────────────────────────┐             ┌─────────▼──────────┐
│    PreAssessment        │             │    TokenUsage      │
│  experienceYears        │             │  operation         │
│  workStatus             │◄─────0..1───│  preAssessmentId?  │
│  educationLevel?        │      *      │  inputTokens       │
│  workPreference         │             │  outputTokens      │
│  teamPreference         │             │  estimatedCostUsd  │
│  learningStyle          │             │  succeeded         │
│  problemApproach        │             └────────────────────┘
│  selfRatings (Json)     │
│  skills[] (serbest)     │  ← FR-002b: injection yüzeyi
│  openAnswers (Json?)    │  ← FR-002c: injection yüzeyi
│  experienceLevel        │  ← TÜRETİLMİŞ (FR-002d), sorulmaz
│  language / status      │
│  isActive ◄── partial   │
│    unique index         │
└─────────┬───────────────┘
     1—0..1│                   ⇢ (okuma, FR-016) 002-interview soru üretimi
┌─────────▼───────────────┐
│   CompetencyReport      │
│  genelOzet              │
│  gucluYonler[]          │  ← skor alanı YOK (FR-006b)
│  gelisimAlanlari[]      │  ← yol haritası YOK → 002-interview (FR-006)
│  calismaTarziOzeti      │  ← mesleğe göre bölümleme YOK (FR-002)
│  guvenSeviyesi          │
└─────────────────────────┘
```

---

## Prisma Şema Eki

Aşağıdaki blok `backend/prisma/schema.prisma` dosyasının **sonuna** eklenir. `User`
modeline yalnızca iki ilişki satırı eklenir; başka hiçbir auth alanına dokunulmaz.

```prisma
// --- 001-auth-rol'ün User modeline eklenen İKİ satır (başka değişiklik yok) ---
// model User {
//   ... mevcut alanlar ...
//   preAssessments PreAssessment[]
//   tokenUsages    TokenUsage[]
// }

model PreAssessment {
  id              String              @id @default(cuid())
  userId          String
  user            User                @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Meslek-bağımsız zorunlu girdiler (FR-002)
  experienceYears ExperienceYears
  workStatus      WorkStatus
  workPreference  WorkPreference
  teamPreference  TeamPreference
  learningStyle   LearningStyle
  problemApproach ProblemApproach
  selfRatings     Json                // 8 madde × 1-5 (FR-002a)

  // Opsiyonel girdiler
  educationLevel  EducationLevel?
  skills          String[]            // serbest/önerili etiketler (FR-002b)
  openAnswers     Json?               // 3 kısa açık uçlu cevap (FR-002c)

  // Türetilmiş — kullanıcıya SORULMAZ (FR-002d), 002-interview FR-021 bunu okur
  experienceLevel ExperienceLevel

  language        ReportLanguage
  status          PreAssessmentStatus @default(generating)
  isActive        Boolean             @default(false)
  failureReason   String?
  report          CompetencyReport?
  tokenUsages     TokenUsage[]
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([userId, createdAt(sort: Desc)])
  // Kullanıcı başına tek aktif kayıt: partial unique index — elle migration (aşağı bkz.)
}

model CompetencyReport {
  id                String          @id @default(cuid())
  preAssessmentId   String          @unique
  preAssessment     PreAssessment   @relation(fields: [preAssessmentId], references: [id], onDelete: Cascade)
  genelOzet         String
  gucluYonler       String[]
  gelisimAlanlari   String[]
  calismaTarziOzeti String
  guvenSeviyesi     ConfidenceLevel
  createdAt         DateTime        @default(now())
}

model TokenUsage {
  id               String         @id @default(cuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  operation        LlmOperation
  preAssessmentId  String?
  preAssessment    PreAssessment? @relation(fields: [preAssessmentId], references: [id], onDelete: SetNull)
  interviewId      String?        // 002-interview bağlantısı
  interview        Interview?     @relation(fields: [interviewId], references: [id], onDelete: SetNull)
  provider         String
  model            String
  inputTokens      Int
  outputTokens     Int
  estimatedCostUsd Decimal        @db.Decimal(10, 6)
  succeeded        Boolean
  createdAt        DateTime       @default(now())

  @@index([userId, createdAt])
  @@index([operation, createdAt])
  @@index([interviewId])
}
```

> **Not:** `TokenUsage` ve `LlmOperation` blokları fiilen `002-interview` migration'ında
> oluşur (implementasyon sırası gereği). Bu dilim geldiğinde tablo hazırdır; bu dilim
> yalnızca `preAssessmentId` ilişkisinin ve `pre_assessment` enum değerinin **kullanıcısıdır**.
> Şema tasarımının sahibi yine bu belgedir — değişiklik burada yapılır.
>
> **Migration sırası (bulgu U3 çözümü):** `002-interview` migration'ı `preAssessmentId`'yi
> düz `String?` kolon olarak ekler (henüz `PreAssessment` tablosu yoktur, `@relation`
> kurulamaz — bkz. `specs/002-interview/tasks.md` T012). `003-pre-assessment` migration'ı,
> `PreAssessment` tablosunu oluşturduktan **sonra**, aynı kolonu `@relation` ile FK'ya
> bağlayan **ikinci** bir migration ekler (kolon adı/tipi değişmez, yalnızca constraint
> eklenir). Sıra: 002 kolonu açar → 003 tabloyu yaratır ve FK'yı kapatır.

### Migration Notu — partial unique index

Prisma şema DSL'i koşullu (partial) index'i ifade edemez. `prisma migrate dev` ile
migration üretildikten sonra oluşan SQL dosyasına **elle** eklenir:

```sql
-- backend/prisma/migrations/<timestamp>_pre_assessment/migration.sql (sona ekle)
CREATE UNIQUE INDEX "pre_assessment_one_active_per_user"
  ON "PreAssessment" ("userId")
  WHERE "isActive" = true;
```

Bu satır olmadan FR-004 / SC-007 **karşılanmaz**; `tasks.md`'de ayrı bir görev ve bu
kısıtı doğrulayan bir eşzamanlılık testi olarak yer almalıdır.

---

## Gereksinim İzlenebilirliği

| Alan / Kural | Gereksinim |
|--------------|-----------|
| Meslek-bağımsız zorunlu enum alanları (deneyim, durum, 4 çalışma tarzı) | FR-002, SC-001a |
| `selfRatings` — 8 meslek-bağımsız madde × 1-5, zorunlu | FR-002a |
| `skills` — serbest/önerili etiket, adet+uzunluk sınırlı | FR-002b, SC-008 |
| `openAnswers` — 3 opsiyonel kısa metin, uzunluk sınırlı | FR-002c, SC-008 |
| `experienceLevel` türetilmiş (kullanıcıya sorulmaz) | FR-002d |
| Enum tipleri + sınır doğrulaması (sunucu tarafı) | FR-003, SC-008 |
| Serbest metnin veri olarak izolasyonu | FR-012, SC-008a |
| Partial unique index (`WHERE isActive`) | FR-004, SC-007 |
| `CompetencyReport` alanları (yol haritası YOK, mesleğe göre bölümleme YOK) | FR-006, SC-010 |
| `gucluYonler`/`gelisimAlanlari` yapılandırılmış liste (tek serbest metin bloğu değil) | FR-006a |
| Skor alanının bulunmaması + `selfRatings`'ten skor türetilmemesi | FR-006b, SC-010 |
| Aktif rapor + `selfRatings` + `skills`'in `002-interview`'e context olarak okunması | FR-016 |
| `status=failed` → rapor yazılmaz, aktif kayıt korunur | FR-008, FR-009 |
| `isActive=false` arşiv + `@@index([userId, createdAt])` | FR-009a, SC-009 |
| `TokenUsage.succeeded` (başarısızlar dahil) | FR-010, SC-006 |
| `userId` FK + rol tabanlı erişim | FR-011, FR-011a, SC-005 |
| `language` alanı ve arşivde korunması | FR-017, FR-019, SC-011 |
