# Uygulama Planı: Görüşme (Interview)

**Dal (Branch)**: `002-interview` | **Tarih**: 2026-07-30 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/002-interview/spec.md` özellik spesifikasyonu

**Not**: Bu plan `speckit.plan` iş akışıyla üretilmiştir. Teknoloji yığını ADR-0001…0003
(bkz. `docs/DECISIONS.md`) ile kilitlenmiştir ve burada yeniden tartışılmaz. Bu dilim,
**001-auth-rol** dilimindeki Kullanıcı/Auth altyapısına (kayıt/giriş, oturum, rol,
sunucu tarafı yetkilendirme) **bağımlıdır** ve onu yeniden üretmez.

## Özet

Bu dilim, AI destekli Mock Interview uygulamasının **ikinci dikey dilimi** olan
Görüşme (Interview) temelini kurar: kullanıcının iş ilanını (serbest metin veya PDF)
girmesi, soru sayısı (N, 5-20) ve mod (sözlü real-time sesli AI asistan / yazılı)
seçmesi, LLM aracılığıyla N adet karışık tipte (çoktan seçmeli/açık uçlu) soru
üretilmesi, soruların **sıralı** (kilitli) sunulup cevaplanması, isteğe bağlı
**adaptif** soru akışı (bonus), yarıda bırakılan görüşmenin kaldığı yerden **devam**
ettirilmesi (resume) ve tüm cevaplar sonrası LLM ile **değerlendirme raporu**
(Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar, Teknik/Davranışsal/Genel
3 eksende 0-100 skor) üretilip kalıcı saklanması ve Interview History üzerinden
yeniden LLM çağrısı yapılmadan görüntülenmesi.

**Teknik yaklaşım**: Backend'de yeni bir **`InterviewModule`** dikey dilimi, NestJS +
Prisma üzerinde `Interview`/`Question`/`Answer`/`Report` tablolarını yönetir. Her
görüşme oluşturulurken LLM'den **N adet baseline soru** tek seferde üretilir; bu küme
hem sabit modda doğrudan sunulur hem de adaptif modda "önceden planlanmış/varsayılan
soruya geri dönüş" için yedek görevi görür. Sıralı kilit ve sahiplik kontrolü **sunucu
tarafında** uygulanır; sahiplik/oturum guard'ları 001-auth-rol dilimindeki
`SessionGuard`/`OwnershipGuard` **yeniden kullanılarak** `Interview` kaynağına bağlanır
(yeni bir auth mekanizması kurulmaz). LLM ve PDF metin çıkarma sağlayıcıları, somut
seçimleri ayrı ADR'lere ertelenen **soyutlanmış arayüzler** (`LlmService`,
`PdfExtractionService`) arkasında tutulur; böylece bu dilimin veri
modeli/sözleşmeleri/testleri sağlayıcı kararlarından bağımsız ilerler. **Sesli mod için
sunucu tarafı soyutlama yoktur** — ADR-0010 ile STT/TTS tarayıcının Web Speech API'sine
verildi, sunucuda ses işlenmez.
Frontend React 19 + Vite + TypeScript + Tailwind + shadcn/ui ile soru-cevap (chat
tarzı) arayüzü ve rapor görünümünü sunar.

**Cross-cutting altyapı sahipliği (çapraz analiz sonrası):** Implementasyon sırası
Auth → **Interview** → Pre-assessment olduğundan projedeki **ilk LLM entegrasyonu bu
dilimdir**. Paylaşılan altyapıyı bu dilim **inşa eder**, `003-pre-assessment` devralır:
`LlmModule` (`generateStructured()`, sağlayıcı port, tek OpenAI-uyumlu adapter, iki katmanlı
şema doğrulama, hata sınıfları, çağrı başına timeout), `TokenUsage` tablosu, dil çözümleyici
(`Accept-Language` → tr/en) ve LLM hız sınırı guard'ı.

⚠️ **Tasarımın sahibi bu dilim değildir:** altyapı sözleşmesi `docs/API_CONVENTIONS.md`
§3-§4 ve `specs/003-pre-assessment/contracts/llm-contract.md`'dir; bu dilim onu **uygular**,
yeniden tasarlamaz. Çapraz analizde bu dilimin `LlmService` arayüzü domain metotlarını
altyapıya sızdırıyordu ve `LlmUsageLog` ile rakip bir maliyet tablosu tanımlıyordu — ikisi de
düzeltildi. Bu dilimin domain'e özgü prompt ve Zod şemaları `backend/src/interview/llm/`
altında durur; `backend/src/llm/` **sağlayıcı-agnostik** kalır.

## Teknik Bağlam

**Dil/Sürüm**: TypeScript 5.x (Node.js 20 LTS backend); React 19 (frontend)

**Birincil Bağımlılıklar**:
- Backend: NestJS (latest), Prisma (latest), `zod` (LLM çıktı şeması + girdi doğrulama),
  `zod-to-json-schema` (Zod → sağlayıcı JSON Schema), **`openai` npm SDK** (Groq ve DeepSeek
  ikisi de OpenAI-uyumlu → tek SDK yeterli, **ADR-0007**), `@nestjs/throttler` (hız sınırı —
  auth dilimi getiriyor), 001-auth-rol'den `SessionGuard`/`OwnershipGuard` (yeniden kullanım).
- PDF metin çıkarma: **`unpdf`** (**ADR-0009** ✅ Kabul, 2026-07-31) — native derleme
  bağımlılığı yok; `PdfExtractionService` arayüzü arkasında durur (research.md §3).
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui, soru-cevap/chat bileşenleri,
  PDF yükleme formu. Sözlü mod **tarayıcı Web Speech API** ile (**ADR-0010** — karara
  bağlandı): `SpeechRecognition` + `SpeechSynthesis` yerleşik, **yeni bağımlılık yok**,
  sunucuda ses işleme yok. Grafik: **Recharts**, shadcn/ui `Chart`
  bileşenleri üzerinden (**ADR-0011** ✅ — radar chart yerleşik, shadcn teması hazır).

**Depolama**: PostgreSQL 16 — 001-auth-rol ile **aynı** veritabanı (aynı `DATABASE_URL`);
yeni tablolar `Interview`, `Question`, `Answer`, `Report` **+ cross-cutting `TokenUsage`**
aynı Prisma şemasına eklenir. `TokenUsage`, `LlmOperation`, `ReportLanguage` ve
`ExperienceLevel` tanımlarının **sahibi** `specs/003-pre-assessment/data-model.md`'dir; bu
dilim onları **inşa eder** (sıra gereği ilk gelen dikey), `003-pre-assessment` devralır.
Bu dilime özgü ayrı bir maliyet tablosu (`LlmUsageLog`) **açılmaz** — tek tablo kuralı
`docs/API_CONVENTIONS.md` §4.1.

**Test**: Jest (backend birim/entegrasyon), Supertest (NestJS e2e/HTTP), Vitest +
React Testing Library (frontend), Playwright (uçtan uca akış).
- **LLM**: gerçek sağlayıcıya istek atan test **YAZILMAZ** (maliyet + belirsizlik).
  Testler `LlmProvider` port sınırındaki paylaşılan **fake** ile çalışır
  (`backend/test/fakes/fake-llm.provider.ts`) — `003-pre-assessment` de bunu devralır.
- **PDF**: `PdfExtractionService` arayüzü arkasındaki geçici kütüphane ile test edilir
  (somut kütüphane ADR-0009'a bağlı, sözleşme sabit).
- **Sözlü mod**: sunucuda ses işleme **yoktur** (ADR-0010) — backend testi gerekmez.
  Frontend'de tarayıcı `SpeechRecognition`/`SpeechSynthesis` API'leri **stub**'lanır ve
  yetenek tespiti + zarif bozulma test edilir (FR-025).

Spec'teki Türkçe Gherkin kabul kriterleri entegrasyon/e2e testlerine bağlanır (ATDD, İlke III).

**Hedef Platform**: Modern web tarayıcıları (SPA, mikrofon erişimi gerektiren sözlü
mod dahil); backend Linux sunucu / container.

**Proje Türü**: Web uygulaması (mevcut `backend/` + `frontend/` — 001-auth-rol ile aynı
proje köküne eklenen yeni dikey dilim).

**Performans Hedefleri**: Soru üretimi < 30 sn (SC-001); rapor üretimi vakaların
≥%95'i < 60 sn (SC-005). Bu dilimin performansı büyük ölçüde LLM sağlayıcı yanıt
süresine bağlıdır; kesin p95 bütçesi sağlayıcı kararına ertelenir.

**Kısıtlar**:
- Tüm sıralı kilit, sahiplik ve yetkilendirme kontrolleri **sunucu tarafında**
  (FR-006/007/017, İlke V); istemci kontrolüne güvenilmez.
- Kullanıcı sağlı iş ilanı/serbest metin, LLM'e daima **veri** olarak izole edilir;
  asla sistem talimatı olarak yorumlanmaz (İlke V, prompt injection savunması).
- Her LLM çağrısı **yapılandırılmış JSON şeması** ile doğrulanır; sessiz başarısızlık
  yasaktır (İlke VI).
- Her LLM çağrısı için token/maliyet kaydedilir (FR-016, İlke VI); admin
  ekranlaştırması bu dilimin kapsamı **dışındadır** (spec Kapsam Notu).
- Sırlar koda gömülmez; `.env`/`.env.example` ile sağlanır (İlke V).
- Görüşme kayıtlarında soft-delete'in veri temeli (`deletedAt`) bu dilimde
  **hazırlanır**; silme UI'ı kapsam dışıdır (İlke VI, spec Kapsam Notu).

**Ölçek/Kapsam**: Staj/vaka çalışması ölçeği. Bu dilimin kapsamı: 5 kullanıcı hikâyesi,
28 fonksiyonel gereksinim, tek `InterviewModule` dikey dilimi (001-auth-rol'e bağımlı).

## Anayasa Kontrolü (Constitution Check)

*KAPI: Phase 0 araştırmasından önce geçilmeli; Phase 1 tasarımdan sonra yeniden kontrol edilir.*

Anayasa `v1.0.0` ilkelerine göre değerlendirme:

| İlke | Durum | Bu dilimde nasıl karşılanıyor |
|------|-------|-------------------------------|
| **I. AI-Native & Devlog** | ✅ Uyumlu | Oturum sonunda `AI-DEVLOG.md` güncellenecek (tasks fazının çıktısı). |
| **II. Spec-Öncelikli** | ✅ Uyumlu | `spec.md` mevcut; Türkçe Gherkin kabul kriterleri (5 hikâye) mutlu yol + edge + error kapsıyor. |
| **III. Test-Öncelikli / ATDD** | ✅ Uyumlu (kapı: tasks) | Kabul kriterleri e2e/entegrasyon testlerine eşlenir (quickstart.md S1-S5); soru üretimi/rapor üretimi kritik akış, test kapsamı olmadan merge edilmez. |
| **IV. Dikey Dilim & Düzen** | ✅ Uyumlu | Tek `InterviewModule` uçtan uca (UI → NestJS servis/guard → Postgres); 001-auth-rol'ün guard'ları tekrar yazılmadan yeniden kullanılır. Kökteki teslim dosyaları (`SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md`) zorunlu. |
| **V. Güvenlik & Injection Savunması** | ✅ Uyumlu | Sunucu tarafı sıralı kilit + sahiplik (FR-006/007/017); iş ilanı/serbest metin LLM'e daima veri olarak izole edilir, sistem talimatına karıştırılmaz (research.md §2); sırlar `.env`'de. |
| **VI. LLM Sözleşmesi & Gözlemlenebilirlik** | ✅ Uyumlu | Her LLM etkileşimi için Zod şeması + **iki katmanlı doğrulama** (contracts/interview-flow-rules.md §4, `API_CONVENTIONS.md` §3.3); hata sınıfları + çağrı başına timeout, **otomatik retry yok** (§3.4); token/maliyet her çağrıda **tek paylaşılan `TokenUsage`** tablosuna yazılır, başarısızlar dahil (FR-016, §4.1); saatlik LLM çağrı sınırı sağlayıcı kotasını korur (FR-022, §3.5); soft-delete veri temeli + liste filtresi (`deletedAt`, §4.3). |
| **VII. Kararların Gerekçelendirilmesi & UX** | ✅ Uyumlu | Dört ADR de karara bağlandı: LLM sağlayıcı **ADR-0007**, PDF **ADR-0009** (unpdf), sözlü mod **ADR-0010** (Web Speech), grafik **ADR-0011** (Recharts). Açık karar kalmadı. UX: sıralı akış net gösterilir; adaptif/rapor hatalarında zarif toparlanma + yeniden deneme (FR-011/015); sözlü mod desteklenmeyen tarayıcıda devre dışı gösterilir, sessiz başarısızlık yok (FR-025, ADR-0010/R1). |

**Karmaşıklık kapıları**: İlave karmaşıklık yok. Auth/oturum/rol mantığı 001-auth-rol'den
**yeniden kullanılır** (tekrar yazılmaz). Rapor üretimi için ayrı bir asenkron
kuyruk/worker altyapısı **kurulmaz** — eşzamanlı istek/yanıt + `retry` uç noktası bu
ölçekte yeterli görülmüştür (research.md §5, gerekçeli reddedilen alternatif). LLM/PDF
sağlayıcı soyutlaması (arayüz + adapter) tek bir küçük dolaylama katmanıdır ve
somut sağlayıcı kararı bekleneni bloke etmemek için gereklidir (Anayasa İlke VII —
gerekçeli). **Sonuç: GEÇTİ (PASS)** — gerekçesiz ihlal yok.

**Post-Design yeniden değerlendirme (Phase 1 sonrası)**: Tasarım çıktıları
(`data-model.md`, `contracts/`, `quickstart.md`) yalnızca `InterviewModule` sınırında
kaldı; 001-auth-rol'ün guard sözleşmesi **değiştirilmeden** yeniden kullanıldı, yeni bir
auth katmanı eklenmedi. Anayasa kontrolü **hâlâ GEÇİYOR**.

## Proje Yapısı

### Dokümantasyon (bu özellik)

```text
specs/002-interview/
├── plan.md              # Bu dosya (speckit.plan çıktısı)
├── research.md          # Phase 0 çıktısı
├── data-model.md        # Phase 1 çıktısı
├── quickstart.md        # Phase 1 çıktısı
├── contracts/           # Phase 1 çıktısı (görüşme uç nokta ve akış sözleşmeleri)
│   ├── interview-api.md
│   └── interview-flow-rules.md
├── checklists/
│   └── requirements.md  # (mevcut)
└── tasks.md             # Phase 2 çıktısı (speckit.tasks — bu komut ÜRETMEZ)
```

### Kaynak Kod (repo kökü)

Web uygulaması yapısı (frontend + backend ayrı — 001-auth-rol ile **aynı** repo/proje
köküne eklenen yeni dikey dilim):

```text
backend/
├── prisma/
│   └── schema.prisma          # + Interview, Question, Answer, Report
│                              # + cross-cutting: TokenUsage, LlmOperation,
│                              #   ReportLanguage, ExperienceLevel (şema sahibi: 003)
├── src/
│   ├── auth/                  # (001-auth-rol — değiştirilmez, yeniden kullanılır)
│   ├── common/                 # (+) cross-cutting — 003-pre-assessment devralır
│   │   ├── language.ts               # Accept-Language -> tr | en (FR-020, §4.2)
│   │   └── guards/
│   │       └── llm-rate-limit.guard.ts   # saatlik LLM çağrı sınırı (FR-022, §3.5)
│   ├── llm/                    # (+) PAYLAŞILAN LLM altyapısı — SAĞLAYICI-AGNOSTİK
│   │   │                       #     tasarım: API_CONVENTIONS §3 + 003/llm-contract.md
│   │   ├── llm.module.ts
│   │   ├── llm.service.ts            # generateStructured(): timeout + katman-2 Zod + usage
│   │   ├── llm.provider.ts           # sağlayıcı-bağımsız port (test fake'i bu sınırda)
│   │   ├── llm.errors.ts             # LlmTimeoutError | LlmSchemaError | LlmProviderError
│   │   ├── schema-to-provider.ts     # Zod -> JSON Schema (desteklenmeyen anahtarları çıkarır)
│   │   ├── token-usage.service.ts    # TokenUsage yazımı (cross-cutting, §4.1)
│   │   └── providers/
│   │       ├── openai-compatible.provider.ts  # TEK adapter — Groq + DeepSeek (ADR-0007)
│   │       └── provider.config.ts             # baseURL / model / şema iletim biçimi
│   ├── interview/              # InterviewModule (bu dilimin dikey dilimi)
│   │   ├── interview.module.ts
│   │   ├── interview.controller.ts    # POST/GET /api/interviews/*
│   │   ├── interview.service.ts       # sıralı kilit, adaptif akış, rapor orkestrasyonu
│   │   ├── llm/                       # (+) DOMAIN'e özgü prompt + Zod şemaları
│   │   │   ├── question-generation.ts # şema (+ position) + prompt (level, language)
│   │   │   ├── adaptive.ts            # şema + prompt
│   │   │   └── report.ts              # şema (3 eksen skor) + prompt, timeoutMs: 60_000
│   │   ├── dto/
│   │   │   ├── create-interview.dto.ts   # + level
│   │   │   └── submit-answer.dto.ts
│   │   └── ownership/
│   │       └── interview-ownership.guard.ts  # OwnershipGuard'ı Interview kaynağına bağlar
│   ├── pdf/
│   │   └── pdf-extraction.service.ts  # PdfExtractionService arayüzü — [ADR-0009]
│   └── prisma/
│       └── prisma.service.ts          # (001-auth-rol — yeniden kullanılır)
└── test/
    ├── fakes/
    │   └── fake-llm.provider.ts # (+) port sınırındaki PAYLAŞILAN fake — 003 devralır
    ├── unit/                    # llm timeout / hata sınıfı / şema katman-1 / dil çözümleyici
    ├── integration/             # create/answer/resume/report akışları (Gherkin eşlemesi)
    └── e2e/                     # Supertest akışları (fake LLM/PDF ile)

frontend/
├── src/
│   ├── lib/
│   │   └── voice-client.ts     # Web Speech API (ADR-0010) + yetenek tespiti (FR-025)
│   ├── pages/
│   │   ├── interview/new.tsx        # iş ilanı + N / mod / SEVİYE / adaptif seçimi
│   │   ├── interview/[id]/session.tsx  # soru-cevap (chat) akışı, sıralı sunum
│   │   └── interview/[id]/report.tsx   # rapor görünümü (grafik — [ADR-0011])
│   ├── components/
│   │   └── interview/           # soru kartı, PDF yükleme, sesli mod kontrolleri (shadcn/ui)
│   └── routes/
│       └── protected.tsx        # (001-auth-rol — yeniden kullanılır)
└── test/                        # Vitest + RTL

.env.example                    # 001-auth-rol'e ek: LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY,
                                #   LLM_MODEL, LLM_REQUEST_TIMEOUT_MS
                                #   (VOICE_* GEREKMİYOR — Web Speech tarayıcıda, ADR-0010)
```

**Yapı Kararı**: Mevcut web uygulaması yapısı (001-auth-rol ile aynı `backend/` +
`frontend/`) korunur; bu dilim yeni bir proje/servis açmaz. Auth/oturum/rol katmanı
(`backend/src/auth/`) **değiştirilmez**; `InterviewModule`, `SessionGuard`/`OwnershipGuard`'ı
içeri aktarıp `Interview` kaynağına bağlar.

**Katman sınırı (çapraz analiz kararı):** `backend/src/llm/` **sağlayıcı-agnostik motordur** —
domain bilmez ve `generateStructured()` dışında yüzey sunmaz. Soru üretimi/adaptif/rapor
prompt ve şemaları dikeyin içinde (`interview/llm/`) durur. Böylece `003-pre-assessment`
kendi prompt/şemasını (`pre-assessment/prompts/`, `pre-assessment/schemas/`) motoru
değiştirmeden ekler. Aynı gerekçeyle `common/` altındaki dil çözümleyici ve hız sınırı
guard'ı da dikeyden bağımsızdır.

## Karmaşıklık Takibi

> Anayasa kontrolünde gerekçelendirilmesi gereken ihlal bulunmadığından bu tablo boştur.

İhlal yok — LLM/PDF soyutlaması (arayüz + adapter) gerekçeli ve tek katmanlı;
rapor üretimi için asenkron kuyruk kurulmadı (eşzamanlı + retry yeterli, research.md §5);
auth mantığı tekrar yazılmadı (001-auth-rol yeniden kullanıldı).

## Phase 0: Araştırma

Ayrıntılar için bkz. [research.md](./research.md). Çözülen tasarım kararları: LLM
sağlayıcı entegrasyon mimarisi (soyutlama), girdi izolasyonu/prompt injection
savunması, PDF metin çıkarma yaklaşımı, soru üretimi + sıralı kilit + sabit/adaptif
akış uygulaması, rapor üretimi ve ara durum yönetimi, sözlü (voice) mimari, 001-auth-rol
guard'larının yeniden kullanımı, token/maliyet takibi.

**Karara bağlananlar** (planlama sonrası): LLM sağlayıcı **ADR-0007** (Groq birincil +
DeepSeek yedek, tek `openai` SDK), sözlü mod **ADR-0010** (tarayıcı Web Speech API).

**Kalan [NETLEŞTİRİLECEK]**: yok — hepsi karara bağlandı.

| Konu | ADR | Durum |
|------|-----|-------|
| ~~Somut PDF kütüphanesi~~ | ADR-0009 ✅ | **Kapandı (2026-07-31)** — unpdf |
| ~~Grafik kütüphanesi~~ | ADR-0011 ✅ | **Kapandı** — Recharts (shadcn/ui Charts) |
| ~~`LLM_MODEL` değeri~~ | ADR-0007 / R4, R5 | **Kapandı (2026-08-04)** — `openai/gpt-oss-120b`; T001 spike'ı koşuldu, ölçüm `spike-model-secimi.md`'de (7/7 şema, yanlış ret 0) |

## Phase 1: Tasarım & Sözleşmeler

- **Veri modeli**: [data-model.md](./data-model.md) — Prisma şeması
  (Interview/Question/Answer/Report + cross-cutting `TokenUsage`), ilişkiler, durum
  geçişleri (`status`, `reportStatus`), doğrulama kuralları, gereksinim izlenebilirliği.
  Admin'in ihtiyaç duyduğu alanlar (`position`, `completedAt`) ve cross-cutting alanlar
  (`level`, `language`) **bu dilimde** eklenir — sonradan eklenmeleri geri doldurulamaz veri
  kaybı doğuruyordu (çapraz analiz bulgusu).
- **Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) —
  hata zarfı, `404` kuralı, LLM çağrı sözleşmesi/timeout/hız sınırı, `TokenUsage`, dil
  çözümlemesi, soft-delete görünürlüğü. Bu dilimin sözleşmeleri onu **yeniden tanımlamaz**.
- **Sözleşmeler**: [contracts/interview-api.md](./contracts/interview-api.md)
  (HTTP uç noktaları), [contracts/interview-flow-rules.md](./contracts/interview-flow-rules.md)
  (sıralı kilit, sahiplik-guard bağlama, adaptif akış, LLM çıktı şemaları).
- **Doğrulama kılavuzu**: [quickstart.md](./quickstart.md) — kurulum + kabul
  senaryolarının (S1-S5) uçtan uca doğrulanması ve başarı kriteri eşlemesi.

## Tamamlanma Raporu

Bu komut Phase 1 tasarımından sonra sonlanır. Üretilen çıktılar Tamamlanma bölümünde özetlenir.
