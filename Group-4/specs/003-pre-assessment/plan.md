# Uygulama Planı: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Dal (Branch)**: `003-pre-assessment` | **Tarih**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

> ⚠️ **Çapraz analiz güncellemesi (2026-07-30):** Bu dilim **üçüncü** dikey dilimdir
> (`002-interview` ikincidir) ve implementasyon sırası **Auth → Interview → Pre-assessment**
> olarak kesinleşmiştir. Sonuç: bu dilimin tasarladığı paylaşılan altyapıyı
> (`LlmModule`, `TokenUsage`, `common/language.ts`, hız sınırı guard'ı) **`002-interview`
> inşa eder**; bu dilim onu **devralır**. Tasarımın sahipliği değişmedi — sözleşme hâlâ bu
> dilimin `contracts/llm-contract.md` ve `data-model.md` dosyalarındadır ve
> `docs/API_CONVENTIONS.md` §3-§4'te cross-cutting olarak kayıtlıdır.

**Girdi**: `specs/003-pre-assessment/spec.md` özellik spesifikasyonu

**Not**: Bu plan `speckit.plan` iş akışıyla üretilmiştir. Frontend/backend/DB/auth yığını
ADR-0001…0003 (bkz. `docs/DECISIONS.md`) ile kilitlenmiştir ve burada yeniden tartışılmaz.
LLM sağlayıcı kararı bu dilimde **ilk kez** alınmıştır: **ADR-0007 — Groq (birincil) +
DeepSeek (yedek)** (bkz. [research.md](./research.md) §1). ADR-0006 (OpenAI) "LLM maliyeti
sıfır olmalı" kısıtı netleşince değiştirilmiştir.

## Özet

Bu dilim, uygulamanın **üçüncü dikey dilimidir**. LLM altyapısının **tasarım sahibi** bu
dilimdir; ancak implementasyon sırası gereği altyapıyı `002-interview` kurar ve bu dilim
onu devralır (yukarıdaki not). Oturum açmış kullanıcı — **mesleği ne olursa olsun** —
meslek-bağımsız bir form doldurur: deneyim süresi, çalışma durumu ve dört çalışma tarzı
sorusu (zorunlu, çoktan seçmeli) + 8 maddelik 1-5 öz-değerlendirme ölçeği (zorunlu);
opsiyonel olarak eğitim durumu, **serbest/önerili yetenek etiketleri** ve üç kısa açık uçlu
cevap ekleyebilir (FR-002…FR-002c). Deneyim seviyesi (intern/junior/senior) **sorulmaz**,
deneyim süresinden türetilir (FR-002d). Sistem bu girdilerden LLM ile **skorsuz, niteliksel**
bir yetkinlik raporu üretir (genel özet + güçlü yönler + gelişim alanları + çalışma tarzı
özeti + güven seviyesi — **öğrenme yol haritası ve mesleğe göre bölümleme içermez**),
raporu kullanıcı hesabıyla ilişkilendirerek saklar ve gösterir. Kullanıcı yeniden
değerlendirme yapabilir; eski rapor silinmeden arşivlenir (kullanıcı başına tek **aktif**
rapor). Admin tüm raporlara salt okunur erişebilir.

> ⚠️ **Kapsam kararı (2026-08-04) — meslek-bağımsızlık:** Uygulama yalnızca yazılımcılara
> değil **tüm meslek gruplarına** hitap edeceği için ön değerlendirme girdisi baştan
> yeniden tasarlandı (bkz. `spec.md` § Netleştirmeler → Oturum 2026-08-04, anayasa v1.2.0):
> `InterestArea` (frontend/backend/ml) ve teknoloji/araç checklist'i **kaldırıldı**; rapor
> şemasındaki `alanlar` (ilgi alanı başına değerlendirme) yerine düz `gucluYonler` /
> `gelisimAlanlari` / `calismaTarziOzeti` geldi. **Bu dilim ilk kez serbest metin girdisi
> kabul ediyor** (yetenek etiketleri + açık uçlu cevaplar) — dolayısıyla prompt injection
> yüzeyi artık gerçek; izolasyon ve sınır doğrulaması teorik değil zorunlu koruma oldu.
>
> ⚠️ **Clarify güncellemesi (2026-08-03):** Üç karar `spec.md`'ye işlendi (bkz. Netleştirmeler
> § Oturum 2026-08-03): (1) `FR-002a` — opsiyonel teknoloji/araç + Likert girdisi *(2026-08-04'te
> meslek-bağımsız öz-değerlendirme ölçeğiyle DEĞİŞTİRİLDİ)*; (2) `FR-006` — öğrenme yol haritası
> şemadan **çıkarıldı**, kişiye özel yol haritası artık görüşme tamamlandığında `002-interview`
> tarafından üretilecek; (3) `FR-016` **tersine çevrildi** — kullanıcının aktif ön değerlendirme
> raporunun **tam içeriği**, görüşme soru üretim prompt'una context olarak verilir (zorunlu
> bağımlılık değil).

**Teknik yaklaşım**: NestJS içinde tek bir `PreAssessmentModule` dikey dilimi. LLM erişimi
paylaşılan `LlmModule` arkasındadır: sağlayıcıya özgü SDK tek bir `LlmProvider` arayüzü
ardında kapsüllenir. **Bu modül `002-interview` diliminde kurulmuş olarak gelir** — bu dilim
onu yalnızca `imports` eder ve kendi prompt/şemasını verir; motoru değiştirmez. Şema
sözleşmesi **tek kaynaktan** yönetilir: bir Zod şeması hem sağlayıcının structured-output
parametresine JSON Schema olarak verilir hem de dönen yanıtı runtime'da doğrular (FR-007).
Kullanıcı başına tek aktif kayıt kısıtı uygulama kilidiyle değil, **PostgreSQL partial unique
index** ile veritabanı düzeyinde garanti edilir (FR-004) — bu, bu dilime **özgü** ve yeni bir
migration gerektiren tek şema işidir. Hız sınırı (FR-013) `002-interview`'ın kurduğu ortak
`LlmRateLimitGuard`'ı 5/saat yapılandırmasıyla kullanır. Frontend React 19 + shadcn/ui ile
dashboard'a bir Pre-assessment sekmesi ekler.

## Teknik Bağlam

**Dil/Sürüm**: TypeScript 5.x (Node.js 20 LTS backend); React 19 (frontend)

**Birincil Bağımlılıklar**:
- Backend: NestJS (latest), Prisma (latest), `zod`, `zod-to-json-schema`,
  `@nestjs/throttler`, **`openai` npm SDK** — hepsi **`002-interview` tarafından zaten
  kurulmuş** olarak gelir (ADR-0007: Groq ve DeepSeek OpenAI-uyumlu, tek SDK yeterli).
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui, TanStack Query (veri çekme)
- **Bu dilimin eklediği yeni backend bağımlılığı: 0.** (Çapraz analiz öncesi 2 olarak
  planlanmıştı; sıra değişikliğiyle o kurulum `002-interview`'a geçti.) TanStack Query
  frontend'de ilk kez burada gerekiyorsa tek yeni bağımlılıktır.

**Depolama**: PostgreSQL 16 — geliştirmede Docker (local), production'da managed bulut
Postgres. Auth dilimiyle **aynı veritabanı ve aynı Prisma şeması**.
`TokenUsage` tablosu ve `LlmOperation` / `ReportLanguage` / `ExperienceLevel` enum'ları
`002-interview` migration'ında **oluşmuş** olarak gelir (şema tasarımı yine
[data-model.md](./data-model.md)'de tanımlıdır). Bu dilimin eklediği yeni modeller:
`PreAssessment` + `CompetencyReport`, artı `TokenUsage.preAssessmentId` ilişkisinin
kullanımı ve **partial unique index** (elle migration).

**Test**: Jest (backend birim), Supertest (NestJS e2e/HTTP), Vitest + React Testing Library
(frontend). LLM çağrıları testlerde **daima fake'lenir** (devralınan `backend/test/fakes/fake-llm.provider.ts`,
port sınırında) — gerçek sağlayıcıya istek atan test YAZILMAZ (maliyet + belirsizlik). Spec'teki Türkçe Gherkin kabul kriterleri
entegrasyon/e2e testlerine bağlanır (ATDD, İlke III).

**Hedef Platform**: Modern web tarayıcıları (SPA); backend Linux sunucu / container.

**Proje Türü**: Web uygulaması (ayrı `backend/` + `frontend/` — auth dilimiyle aynı iskelet).

**Performans Hedefleri**: Rapor üretimi p95 < 30 sn (SC-002); LLM çağrısına 30 sn hard
timeout (FR-008a). Form gönderimi < 1 dk (SC-001). Rapor görüntüleme (LLM'siz yol)
p95 < 300 ms.

**Kısıtlar**:
- Tüm yetkilendirme sunucu tarafında (FR-011/011a, İlke V).
- Girdiler kapalı listeden; sunucu tarafı enum doğrulaması geçmeden LLM çağrılmaz (FR-003).
- Kullanıcı girdisi LLM'e **veri** olarak izole edilir, sistem talimatından ayrılır (FR-012).
- Kullanıcı başına en fazla bir aktif rapor; eşzamanlı gönderim dahil (FR-004).
- Kullanıcı başına saatte 5 üretim çağrısı; başarılı + başarısız birlikte (FR-013).
- Otomatik yeniden deneme YOK; her tekrar kullanıcı tetikli (FR-008b).
- API anahtarları koda gömülmez; `.env` + `.env.example` (İlke V).
- Şema doğrulamasını geçmeyen yanıt kaydedilmez (FR-007).
- **Şema garantisi sağlayıcıya bağlıdır** (ADR-0007): Groq `strict` modda sağlayıcı
  düzeyinde garanti verir, DeepSeek vermez. Bu nedenle **runtime Zod doğrulaması her
  sağlayıcıda zorunludur** ve DeepSeek yolunda tek garantidir.

**Ölçek/Kapsam**: Staj/vaka çalışması ölçeği (onlarca–yüzlerce kullanıcı, kullanıcı başına
birkaç rapor). Bu dilimin kapsamı: 5 kullanıcı hikâyesi, 26 fonksiyonel gereksinim,
12 başarı kriteri, 4 anahtar varlık, tek `PreAssessmentModule` + **devralınan** paylaşılan `LlmModule`.

## Anayasa Kontrolü (Constitution Check)

*KAPI: Phase 0 araştırmasından önce geçilmeli; Phase 1 tasarımdan sonra yeniden kontrol edilir.*

Anayasa `v1.1.0` ilkelerine göre değerlendirme (2026-08-03'te Ürün Kapsamı — Pre-assessment
satırı bu dilimin clarify kararlarını yansıtacak şekilde genişletildi; ilke metinlerinde
değişiklik yok):

| İlke | Durum | Bu dilimde nasıl karşılanıyor |
|------|-------|-------------------------------|
| **I. AI-Native & Devlog** | ✅ Uyumlu | Planlama AI ile yürütülüyor; `AI-DEVLOG.md` bu oturum için güncellenecek. |
| **II. Spec-Öncelikli** | ✅ Uyumlu | `spec.md` + clarify (5 soru) tamam; Türkçe Gherkin kriterleri mutlu yol + edge + error kapsıyor. |
| **III. Test-Öncelikli / ATDD** | ✅ Uyumlu (kapı: tasks) | Kabul kriterleri e2e/entegrasyon testlerine eşlenir; testler koddan önce. LLM çağrıları fake'lenir (port sınırında) — sözleşme testi şemaya karşı yapılır. |
| **IV. Dikey Dilim & Düzen** | ✅ Uyumlu | Tek `PreAssessmentModule` uçtan uca (React sekmesi → NestJS → LLM → Postgres). `LlmModule` paylaşılan altyapıdır, ayrı dikey dilim değil ve bu dilimde **devralınır**. |
| **V. Güvenlik & Injection Savunması** | ✅ Uyumlu | Sunucu tarafı enum doğrulaması (FR-003), sahiplik + rol guard'ları (FR-011/011a), kullanıcı girdisinin veri olarak izolasyonu (FR-012), hız sınırı (FR-013), `.env` (İlke V). Girdiler kapalı liste olduğu için injection yüzeyi bu dilimde minimum. |
| **VI. LLM Sözleşmesi & Gözlemlenebilirlik** | ✅ Uyumlu | Açık girdi/çıktı sözleşmesi + JSON Schema (`contracts/llm-contract.md`), runtime şema doğrulaması (FR-007), zarif hata + tekrar dene (FR-008), 30 sn timeout (FR-008a), token/maliyet kaydı başarısız çağrılar dahil (FR-010). |
| **VII. Kararların Gerekçelendirilmesi & UX** | ✅ Uyumlu | LLM sağlayıcı kararı **ADR-0007** olarak `docs/DECISIONS.md`'ye yazıldı (ADR-0006 superseded, gerekçesiyle korundu). UX: AI şeffaflığı + güven seviyesi (FR-014), ilerleme geri bildirimi (FR-015), kullanıcı kontrolü/tekrar dene (FR-008b). |

**Karmaşıklık kapıları**: Bu dilim **yeni backend bağımlılığı eklemez** ve **yeni paylaşılan
modül kurmaz** — `zod-to-json-schema`, `openai` ve `LlmModule` `002-interview` tarafından
kurulmuş gelir (sıra değişikliği; tasarım gerekçesi bu dilimde kaldı). `LlmModule`'ün var
olma gerekçesi geçerliliğini koruyor: **üç** LLM etkileşimi (bu dilimin raporu, interview'ın
soru üretimi ve görüşme raporu) aynı token/maliyet kaydını, aynı timeout ve aynı iki katmanlı
şema doğrulamasını kullanıyor — üç yerde kopyalamak yerine bir soyutlama
(`docs/API_CONVENTIONS.md` §3). Bu dilimin **kendi** eklediği tek yapısal karmaşıklık:
partial unique index için elle yazılan migration satırı (FR-004, gerekçesi aşağıda). Ayrı bir
mikroservis veya kuyruk **kurulmaz**; senkron HTTP isteği içinde çalışır (30 sn timeout bunu
mümkün kılıyor). **Sonuç: GEÇTİ (PASS)** — gerekçesiz ihlal yok.

**Post-Design yeniden değerlendirme (Phase 1 sonrası)**: Tasarım çıktıları
(`data-model.md`, `contracts/`, `quickstart.md`) `PreAssessmentModule` + `LlmModule`
sınırında kaldı; kuyruk, cache katmanı veya ek servis eklenmedi. `TokenUsage` varlığı
cross-cutting olarak tasarlandı (Interview/Admin dilimleri devralacak) — bu, gelecekteki
tekrarı önleyen bilinçli bir genelleme, spekülatif soyutlama değil. Anayasa kontrolü
**hâlâ GEÇİYOR**.

## Proje Yapısı

### Dokümantasyon (bu özellik)

```text
specs/003-pre-assessment/
├── plan.md              # Bu dosya (speckit.plan çıktısı)
├── research.md          # Phase 0 çıktısı (LLM sağlayıcı + 3 teknik bilinmeyen)
├── data-model.md        # Phase 1 çıktısı (Prisma şeması)
├── quickstart.md        # Phase 1 çıktısı (kurulum + kabul senaryosu doğrulaması)
├── contracts/           # Phase 1 çıktısı
│   ├── pre-assessment-api.md   # HTTP uç nokta sözleşmesi
│   └── llm-contract.md         # LLM girdi/çıktı sözleşmesi + JSON Schema
├── checklists/
│   └── requirements.md  # (mevcut)
└── tasks.md             # Phase 2 çıktısı (speckit.tasks — bu komut ÜRETMEZ)
```

### Kaynak Kod (repo kökü)

Auth dilimiyle aynı web uygulaması iskeleti; bu dilimin eklediği dosyalar `(+)` işaretli:

```text
backend/
├── prisma/
│   └── schema.prisma               # (+) PreAssessment, CompetencyReport
│                                   # (mevcut) TokenUsage + enum'lar — 002-interview kurdu
├── src/
│   ├── app.module.ts               # (+) PreAssessmentModule kaydı (LlmModule zaten kayıtlı)
│   ├── auth/                       # (mevcut — 001-auth-rol, DEĞİŞTİRİLMEZ)
│   ├── common/                     # (mevcut — 002-interview, DEĞİŞTİRİLMEZ)
│   │   ├── language.ts             #   Accept-Language -> tr | en (FR-017)
│   │   └── guards/
│   │       └── llm-rate-limit.guard.ts   #   5/saat yapılandırmasıyla kullanılır (FR-013)
│   ├── llm/                        # (mevcut — 002-interview kurdu, DEĞİŞTİRİLMEZ)
│   │   ├── llm.module.ts
│   │   ├── llm.service.ts          #   generateStructured(): timeout + şema doğrulama + usage
│   │   ├── llm.provider.ts         #   sağlayıcı-bağımsız arayüz (port)
│   │   ├── schema-to-provider.ts   #   Zod -> JSON Schema (katman-1)
│   │   ├── providers/
│   │   │   ├── openai-compatible.provider.ts  #   TEK adapter — Groq + DeepSeek (ADR-0007)
│   │   │   └── provider.config.ts             #   baseURL / model / şema iletim biçimi
│   │   ├── token-usage.service.ts  #   TokenUsage yazımı (cross-cutting)
│   │   └── llm.errors.ts           #   TimeoutError | SchemaError | ProviderError
│   ├── pre-assessment/             # (+) dikey dilim
│   │   ├── pre-assessment.module.ts
│   │   ├── pre-assessment.controller.ts    # 5/saat: @UseGuards(LlmRateLimitGuard) + @Throttle(llmQuota(5)) — interview deseni, sarmalayıcı guard dosyası YOK
│   │   ├── pre-assessment.service.ts
│   │   ├── dto/
│   │   │   └── create-pre-assessment.dto.ts   # zod: 6 meslek-bağımsız enum + selfRatings (8×1-5) + opsiyonel educationLevel/skills/openAnswers (FR-002…FR-002c)
│   │   ├── constants/
│   │   │   ├── self-rating-items.ts           # 8 meslek-bağımsız ölçek maddesi (FR-002a)
│   │   │   └── skill-suggestions.ts           # yetenek ÖNERİ listesi — doğrulama listesi DEĞİL (FR-002b)
│   │   └── llm/
│   │       ├── competency-report.schema.ts    # zod — TEK KAYNAK (prompt + doğrulama)
│   │       └── competency-report.prompt.ts    # sistem talimatı + veri izolasyonu
└── test/
    ├── integration/
    │   └── pre-assessment.spec.ts  # Gherkin eşlemesi (LLM mock'lu)
    └── e2e/
        └── pre-assessment.e2e-spec.ts

frontend/
├── src/
│   ├── pages/
│   │   └── pre-assessment/         # (+) `pages/interview/` deseniyle aynı — tek sekme dosyası değil
│   │       ├── new.tsx                 # form + senkron üretim + sonuç (Hikâye 1) → route `/pre-assessment/new`
│   │       ├── report.tsx              # tek rapor görünümü, aktif veya geçmişten (Hikâye 2) → route `/pre-assessment/:id`
│   │       └── list.tsx                # geçmiş listesi (Hikâye 2, FR-009a) → route `/pre-assessments`
│   ├── components/
│   │   └── pre-assessment/         # (+)
│   │       ├── assessment-form.tsx     # çoklu ilgi alanı + tekli seviye + opsiyonel skill checklist (FR-002a)
│   │       ├── report-view.tsx         # AI rozeti + güven seviyesi (FR-014)
│   │       ├── report-history.tsx      # arşiv listesi (FR-009a)
│   │       └── generation-state.tsx    # yükleniyor / hata + tekrar dene (FR-008, FR-015)
│   └── lib/
│       └── pre-assessment-client.ts   # (+) tipli istemci — `interview-client.ts` deseniyle aynı, `api/` alt klasörü YOK
└── test/                           # (+) Vitest + RTL

.env.example                        # (mevcut) LLM_* değişkenleri 002-interview'de eklendi
```

**Yapı Kararı**: Auth dilimiyle aynı frontend/backend ayrımı korundu. Bu dilime özgü tüm
mantık `backend/src/pre-assessment/` altında toplandı (İlke IV). LLM erişimi paylaşılan
`backend/src/llm/` modülündedir; **bu dilim o dizine dokunmaz** — yalnızca kendi prompt ve
Zod şemasını (`pre-assessment/llm/`) verir. `common/language.ts` ve ortak hız sınırı guard'ı
da `002-interview` tarafından kurulmuş cross-cutting yardımcılardır; guard doğrudan
`common/guards/`'dan import edilip controller metodunda `@UseGuards()` + `@Throttle(llmQuota(n))`
ile kullanılır — bu dilime özgü sarmalayıcı guard dosyası **yazılmaz**.

> **2026-08-04 düzeltme**: Bu bölüm daha önce backend'de ayrı `schemas/`+`prompts/`+`guards/`
> alt klasörleri ve frontend'de tek dosyalık sekmeli sayfa (`pages/pre-assessment.tsx`) +
> `lib/api/pre-assessment.ts` öneriyordu. `002-interview`'in gerçek implementasyonu
> incelenince bunun kurulu convention'dan saptığı görüldü — backend'de prompt+şema tek
> `llm/` klasöründe toplanıyor ve rate-limit guard sarmalanmadan doğrudan kullanılıyor;
> frontend'de her hikâye ayrı route'lu bir sayfa dosyası (`pages/interview/*.tsx`, gerçek
> `react-router` route'ları — sekme değil) ve istemci `lib/<dilim>-client.ts` adında düz bir
> dosya. Yukarıdaki ağaç ve bu paragraf buna göre düzeltildi; `tasks.md`'deki ilgili görevler
> de aynı şekilde güncellendi.

> Sıra değişmeden önce bu dosya `llm/` ve `common/language.ts`'i **bu dilimin ekleyeceği**
> dosyalar olarak listeliyordu. Sıra Auth → Interview → Pre-assessment olarak kesinleşince
> inşa sahipliği interview'a geçti; **tasarım sahipliği bu dilimde kaldı**.

## Bağımlılık ve Sıra — Ön Koşullar

Implementasyon sırası: **`001-auth-rol` → `002-interview` → `003-pre-assessment`** (bu dilim).
Bu dilim iki dikeyin üzerine kurulur ve **ikisi de main'e merge edildikten sonra** başlar.

### `001-auth-rol`'den devralınanlar

| Devralınan | Kullanım |
|-----------|----------|
| `SessionGuard` / `RolesGuard` / `OwnershipGuard` | FR-001, FR-011, FR-011a |
| `User` modeli (`id`, `email`, `role`) | `PreAssessment.userId`, `TokenUsage.userId` |
| `@nestjs/throttler` | FR-013 hız sınırının temeli |

### `002-interview`'den devralınanlar *(tasarım sahibi bu dilim, inşa sahibi interview)*

| Devralınan | Bu dilimde ne yapılır | Sözleşme |
|-----------|------------------------|----------|
| `LlmModule` + `generateStructured()` | `imports` edilir; yalnızca kendi prompt + Zod şeması verilir | `contracts/llm-contract.md`, `API_CONVENTIONS.md` §3 |
| `LlmProvider` port + OpenAI-uyumlu adapter | Değiştirilmez | ADR-0007 |
| `llm.errors.ts` (`LlmTimeoutError` / `LlmSchemaError` / `LlmProviderError`) | Yakalanır, kullanıcıya zarif hata (FR-008) | §3.4 |
| `schema-to-provider.ts` (katman-1 üretici) | Değiştirilmez | §3.3 |
| `token-usage.service.ts` + `TokenUsage` tablosu | `operation: pre_assessment`, `preAssessmentId` ile yazılır (FR-010) | §4.1 |
| `common/language.ts` | `Accept-Language` → `tr`\|`en` (FR-017) | §4.2 |
| `common/guards/llm-rate-limit.guard.ts` | **5/saat** yapılandırmasıyla kullanılır (FR-013) | §3.5 |
| `openai`, `zod-to-json-schema` bağımlılıkları + `LLM_*` env | Kurulu gelir; `LLM_MODEL` spike'ı yapılmış olur | ADR-0007 / R4, R5 |

> **Devralma doğrulaması bu dilimin ilk görevidir:** yukarıdaki dosyaların mevcut ve
> sözleşmeye uygun olduğu doğrulanır. Eksik/sapmış varsa bu dilim onu **yeniden yazmaz** —
> `002-interview` kapsamında düzeltilir ve `docs/API_CONVENTIONS.md` güncellenir.

### Bu dilime ÖZGÜ olan (başka dikeyde yok)

- `PreAssessment` + `CompetencyReport` modelleri
- **Partial unique index** (`WHERE isActive = true`) — elle yazılan migration satırı
- `pre-assessment/` modülü: controller, service, DTO, prompt, şema
- Frontend Pre-assessment sekmesi (form | rapor | arşiv)

### Kesişme noktaları ve azaltma

| Dosya | Risk | Azaltma |
|-------|------|---------|
| `backend/prisma/schema.prisma` | Orta — iki dikey de model ekledi | Auth'un `User`/`Session`/`Account`/`Verification` blokları ve interview'ın blokları **DEĞİŞTİRİLMEZ**; bu dilim dosyanın SONUNA ekler ve `User`'a ilişki satırları (`preAssessments`) ekler. `TokenUsage`'a yalnızca `preAssessment` ilişkisi bu dilimde kullanılır (alan zaten var). |
| `backend/src/app.module.ts` | Düşük | `imports` dizisine bir satır (`PreAssessmentModule`); `LlmModule` zaten kayıtlı |
| `backend/src/llm/**` | **Yok** | Bu dilim LLM altyapı dosyalarına **DOKUNMAZ**; yalnızca içe aktarır |
| `backend/src/auth/**` | **Yok** | Dokunmaz; guard'ları içe aktarır |
| `.env.example` | **Yok** | `LLM_*` değişkenleri interview diliminde eklendi |

### İleriye Dönük Bağımlılık: `002-interview`'in Bu Dilimi Okuması (FR-016)

Yukarıdaki tüm devralma ilişkileri tek yönlüdür (bu dilim `002-interview`'i okur/kullanır).
FR-016 kararı bir **ters yön** ekliyor: `002-interview`'in soru üretim servisi, kullanıcının
**aktif** `PreAssessment` + `CompetencyReport` kaydını **okuyacak** ve tam içeriğini soru
üretim prompt'una context olarak verecektir.

- **Bu, implementasyon sırasını (Auth → Interview → Pre-assessment) değiştirmez** — bu dilim
  hâlâ `002-interview` merge edildikten sonra başlar. Değişen, `002-interview`'in **bu
  özelliği** ekleyeceği zamandır: `PreAssessment`/`CompetencyReport` tabloları var olmadan
  bu context-okuma kodu anlamsızdır, dolayısıyla o değişiklik `002-interview` tarafında ayrı
  bir takip işi (Faz B) olarak, **bu dilim merge edildikten sonra** yapılmalıdır.
- Aktarımın **şeklinin tasarım sahibi bu dilimdir** (`contracts/llm-contract.md` §8);
  aktarımı kodda **gerçekleştiren** taraf `002-interview`'dir — bu, mevcut "tasarım
  sahibi ≠ inşa sahibi" deseninin (bkz. plan başındaki not) bir devamıdır, sadece yön ters.
- Risk: `002-interview`'in question-generation servisi artık `PreAssessment` Prisma
  modeline bir okuma bağımlılığı kazanıyor. Aktif kayıt **yoksa** context boş geçilir —
  görüşme akışı bloklanmaz (spec FR-016, SC-013 ile tutarlı).

## Karmaşıklık Takibi

> Anayasa kontrolünde gerekçesiz ihlal bulunmadığından bu tablo yalnızca bilinçli
> genellemeleri kayda geçirir.

| Karar | Neden gerekli | Reddedilen daha basit alternatif | İnşa sahibi |
|-------|---------------|----------------------------------|-------------|
| Paylaşılan `LlmModule` (dilime gömmek yerine) | Timeout + şema doğrulama + token kaydı davranışı 3 LLM etkileşiminde aynı | Mantığı servise gömmek — ikinci LLM dilimi geldiğinde kopyala-yapıştır veya geriye dönük refactor | `002-interview` |
| `LlmProvider` port arayüzü (tek implementasyon) | ADR-0007 **iki sağlayıcı** tanımlıyor (Groq + DeepSeek yedek) ve model seçimi spike'a bağlı; test fake'i bu sınırdan takılıyor | SDK'yı doğrudan servise çağırmak — yedek yola geçiş ve test fake'i için servisi değiştirmek gerekirdi | `002-interview` |
| `TokenUsage` cross-cutting varlık | Admin dilimi tüm dilimlerin maliyetini tek yerden raporlayacak (İlke VI) | Her dilime ayrı maliyet tablosu — admin sorgusu UNION'a döner | `002-interview` |
| `timeoutMs` çağrı başına parametre (sabit 30 sn yerine) | Interview raporu SC-005 gereği 60 sn'ye ihtiyaç duyuyor; sabit 30 sn onu keserdi (çapraz analiz bulgusu) | Modüle gömülü sabit timeout | `002-interview` |
| Partial unique index (`WHERE isActive`) — elle migration | Prisma DSL koşullu index üretemiyor; FR-004/SC-007 eşzamanlı gönderimde de tek aktif kayıt istiyor | Uygulama düzeyinde kilit — yarış koşuluna açık | **bu dilim** |

Bu dilim **kütüphane eklemiyor**; kuyruk, cache, ayrı LLM servisi, retry kütüphanesi ve
state machine **eklenmedi**. Tablodaki ilk dört satır bu dilimin *tasarım* kararlarıdır;
kodları `002-interview` diliminde yazılır (sıra kararı).

## Phase 0: Araştırma

Ayrıntılar için bkz. [research.md](./research.md). Çözülen belirsizlikler:

1. **LLM sağlayıcı** (**ADR-0007**) — eleyici eksen **maliyet** (sıfır olmalı):
   **Groq birincil + DeepSeek yedek**, tek `openai` SDK ile. Sözlü mod bu seçimle
   çözülmüyor; Interview diliminde ayrı karar (ADR-0007 / R3).
2. **Şema doğrulama yaklaşımı** — Zod tek kaynak + `zod-to-json-schema` ile sağlayıcıya
   JSON Schema; yanıt aynı Zod şemasıyla runtime doğrulanır.
3. **Hız sınırı** — `@nestjs/throttler` + kullanıcı-anahtarlı özel guard (auth diliminden
   devralınan bağımlılık).
4. **Eşzamanlılık koruması** — PostgreSQL **partial unique index** (`WHERE isActive`);
   uygulama düzeyinde kilit yok.

**Kalan [NETLEŞTİRİLECEK]**: **Yok** — `LLM_MODEL` spike'ı (Groq'ta `strict` desteği +
Türkçe kalite ölçümü, ADR-0007 / R4, R5) sıra değişikliğiyle **`002-interview`'ın ilk
görevine** taşındı; bu dilim başladığında `LLM_MODEL` `.env`'de belirlenmiş olur.

> Bu dilimin **ilk görevi** artık devralma doğrulamasıdır: `LlmModule` yüzeyinin, ortak
> hız sınırı guard'ının, `common/language.ts`'in ve `TokenUsage` tablosunun mevcut ve
> `docs/API_CONVENTIONS.md` §3-§4 sözleşmesine uygun olduğunu doğrulamak.

## Phase 1: Tasarım & Sözleşmeler

- **Veri modeli**: [data-model.md](./data-model.md) — `PreAssessment`, `CompetencyReport`,
  `TokenUsage` Prisma modelleri, `User` ilişkisi, partial unique index, durum geçişleri.
- **Sözleşmeler**:
  [contracts/pre-assessment-api.md](./contracts/pre-assessment-api.md) (HTTP uç noktaları,
  hata formatı, yetki matrisi),
  [contracts/llm-contract.md](./contracts/llm-contract.md) (sistem talimatı, girdi izolasyonu,
  çıktı JSON Schema, hata davranışı).
- **Doğrulama kılavuzu**: [quickstart.md](./quickstart.md) — kurulum + kabul senaryolarının
  uçtan uca doğrulanması.

## Tamamlanma Raporu

Bu komut Phase 1 tasarımından sonra sonlanır. ADR-0007 `docs/DECISIONS.md`'ye yazıldı ve
`docs/TECH_STACK.md` güncellendi; `tasks.md` üretildi ve çapraz analiz sonrası devralma modeline göre yenilendi.

**Sıradaki adım:** `002-interview` main'e merge edildikten sonra `speckit.implement` (bkz. `tasks.md` bloklayıcı ön koşul).
