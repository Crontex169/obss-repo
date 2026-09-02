# DECISIONS.md

> Bu doküman, projede alınan teknik kararları **gerekçeleriyle**, değerlendirilen
> alternatiflerle ve neden tercih edilmediğiyle birlikte kaydeder (ADR — Architecture
> Decision Record tarzı). Her yeni karar bir bölüm olarak eklenir.
>
> Not: Brief gereği bu dosya ilerleyen fazlarda ayrıca **Üst Seviye Tasarım**,
> **Mantıksal Tasarım Diyagramı** ve **Fiziksel Deployment Diyagramı** bölümlerini de
> içerecektir.

---

## ADR Kayıt Defteri (numaralandırmanın TEK doğru kaynağı)

> ⚠️ **Yeni ADR açmadan önce bu tabloya bak.** Spec dosyaları ("sonraki ADR şu numara
> olacak" gibi) numara rezerve **edemez**; rezervasyon yalnızca burada yapılır. Bu tablo,
> dikeyler arası referans çakışmasını önlemek için eklendi.

| # | Konu | Durum | Sahibi / kaynağı |
|---|------|-------|------------------|
| ADR-0001 | Frontend framework: React + Vite + TypeScript | ✅ Kabul | Faz 0 |
| ADR-0002 | Backend framework + veritabanı: NestJS + PostgreSQL | ✅ Kabul | Faz 0 |
| ADR-0003 | Kimlik doğrulama altyapısı: Better Auth | ✅ Kabul | `001-auth-rol` |
| ADR-0004 | Test araçları: Jest+Supertest / Vitest+RTL / Playwright | ✅ Kabul | `001-auth-rol` |
| ADR-0005 | ORM sürüm kilidi: Prisma 6.19.3 | ✅ Kabul | `001-auth-rol` |
| ADR-0006 | LLM sağlayıcı: OpenAI | ⛔ Değiştirildi (→ 0007) | `003-pre-assessment` |
| ADR-0007 | LLM sağlayıcı: Groq (birincil) + DeepSeek (yedek) | ✅ Kabul | `003-pre-assessment` |
| ADR-0008 | E-posta gönderim yolu: Resend | ✅ Kabul | `001-auth-rol` |
| ADR-0009 | PDF metin çıkarma kütüphanesi: unpdf | ✅ Kabul | `002-interview` |
| ADR-0010 | Sözlü mod altyapısı: tarayıcı Web Speech API | ✅ Kabul | `002-interview` |
| ADR-0011 | Grafik kütüphanesi: Recharts (shadcn/ui Charts üzerinden) | ✅ Kabul | `002-interview` + `005-admin` |
| ADR-0012 | Oturum çerezi duruşu + CSRF savunması: açık yapılandırma + `OriginGuard` | ✅ Kabul | `docs/SECURITY.md` S5 (#64) |
| ADR-0013 | Adaptif uyarlamaya ön değerlendirme bağlamının genişletilmesi | ✅ Kabul | `002-interview` (FR-010/FR-030) |
| ADR-0014 | Sözlü mod STT: Groq Whisper (tarayıcı yerine, TTS aynen kalır) | ✅ Kabul | `docs/superpowers/specs/2026-08-24-stt-whisper-design.md` |

---

## ADR-0001 — Frontend Framework: React + Vite + TypeScript

- **Tarih:** 2026-07-29
- **Durum:** Kabul edildi
- **Karar verenler:** Ekip (birlikte)

### Bağlam

Uygulama tarayıcıda çalışan bir SPA olacak. Ekranlar: sekmeli dashboard
(Interview History / Self-assessment / Interview), chat tarzı soru-cevap arayüzü,
admin istatistik ekranı (grafikler) ve sözlü (real-time sesli AI asistan) mod.
Bu ihtiyaçlar; olgun **grafik**, **chat UI**, **voice/real-time** ve **PDF** entegrasyon
kütüphanelerine erişim gerektiriyor. Ayrıca ekip dikey dilimlerle çalışacak ve
brief "AI Native" geliştirmeyi beklediği için AI araçlarının en doğru ürettiği
teknoloji tercih edilmeli.

### Karar

Frontend olarak **React 19 + Vite + TypeScript** seçildi; UI için **Tailwind CSS +
shadcn/ui**.

### Değerlendirilen Alternatifler

Her seçenek performans, kompleksite, ölçeklenebilirlik, bakım ve maliyet
açısından değerlendirildi.

| Kriter | A) React + Vite (SEÇİLEN) | B) Vue 3 + Vite | C) SvelteKit |
|--------|--------------------------|-----------------|--------------|
| Performans | İyi (VDOM overhead düşük) | React'e yakın, hafif daha iyi | En iyi (derleme zamanı, VDOM yok, en küçük bundle) |
| Kompleksite | Orta (hook/state eğrisi) | En düşük (SFC, sezgisel reactivity) | Yazımda düşük, ama az bilinen pattern riski |
| Ölçeklenebilirlik | Çok yüksek (en büyük ekosistem) | Yüksek ama daha dar | Orta (ekosistem en dar) |
| Bakım | Yüksek (bol developer + AI desteği) | Yüksek | Orta (az developer, zayıf AI desteği) |
| Maliyet | Ücretsiz, yardım maliyeti en düşük | Ücretsiz | Ücretsiz |

### Gerekçe (Neden React?)

- Proje çok sayıda hazır kütüphane gerektiriyor (grafik, chat UI, voice/real-time,
  PDF). React ekosisteminde bunların hepsi olgun ve bol.
- Ekip iş bölümü (dikey dilim) ve AI destekli geliştirme en iyi React'te akıyor;
  AI araçları React'i en doğru ve tutarlı üretiyor (brief'in "AI Native" beklentisi).
- Staj süresi kısıtlı — geniş ekosistem ve topluluk desteği, takılma anlarında
  en hızlı çözümü sağlar.

### Neden Diğerleri Değil?

- **Vue 3:** Güçlü bir ikinci tercihti; kompleksitesi en düşük ve performansı iyi.
  Ancak voice/real-time ve grafik kütüphanesi zenginliğinde React'in gerisinde
  kaldı ve AI araç desteği React kadar güçlü değil.
- **SvelteKit:** En iyi performans ve en küçük bundle avantajına sahip; fakat bu
  ölçekte performans farkı hissedilmez. Ekosistem darlığı (olgun voice/chart/UI-kit
  eksikliği) ve zayıf AI araç desteği, kısıtlı staj süresinde zaman kaybı riski
  taşıyor.

### Sonuçlar / Etkiler

- UI bileşenleri Tailwind + shadcn/ui ile kurulacak.
- Sonraki kararlar (state yönetimi, routing, grafik kütüphanesi, voice entegrasyonu)
  bu temel üzerine alınacak ve ayrı ADR'ler olarak eklenecek.


---

## ADR-0002 — Backend Framework: NestJS + Veritabanı: PostgreSQL

- **Tarih:** 2026-07-29
- **Durum:** Kabul edildi
- **Karar verenler:** Ekip (birlikte)

### Bağlam

Uygulama; kimlik doğrulama/rol ayrımı, LLM entegrasyonu, görüşme/soru/cevap/rapor
yönetimi, admin istatistikleri, soft-delete ve token/maliyet takibi gerektiriyor.
Frontend React 19 + TypeScript olarak kilitlendi. Backend ve veritabanı `_TBD_`
durumdaydı. Auth diliminin planlanabilmesi için bu iki karar önkoşuldu.

### Karar

Backend **NestJS** (Node.js + TypeScript); veritabanı **PostgreSQL** seçildi.

### Değerlendirilen Alternatifler (Backend)

| Kriter | A) NestJS (SEÇİLEN) | B) Express/Fastify | C) FastAPI (Python) | D) Spring Boot (Java) |
|--------|---------------------|--------------------|---------------------|-----------------------|
| Dil birliği (FE ile) | Tam (TS) | Tam (TS) | Yok | Yok |
| Yapı/düzen | Yüksek (modül/DI/guard) | Düşük (elle kurulur) | Orta | Yüksek |
| Auth/rol için uygunluk | Guard/decorator ile ideal | Elle | Orta | Yüksek ama ağır |
| Öğrenme eğrisi | Orta | Düşük | Düşük | Yüksek |
| AI/LLM ekosistemi | İyi | İyi | En güçlü | Orta |

### Gerekçe (Neden NestJS?)

- Frontend ile **tek dil (TypeScript)** → DTO/tip paylaşımı, düşük bağlam değişimi.
- **Guard + dependency injection** yapısı, anayasadaki "sunucu tarafı yetki kontrolü"
  ilkesini ve kullanıcı/admin rol ayrımını temiz kurar.
- Modüler mimari, **dikey dilim** yaklaşımımıza (AuthModule, InterviewModule…) birebir oturur.
- Yerleşik test desteği (Jest) → ATDD/test-öncelikli ilkeyle uyumlu.

### Neden Diğerleri Değil?

- **Express/Fastify:** Daha hafif ama yapıyı tümüyle elle kurmak gerekir; proje büyüdükçe
  düzen dağılma riski. NestJS zaten Express üstünde çalışıyor.
- **FastAPI:** AI/LLM ekosistemi en güçlüsü; ancak frontend ile dil birliği kaybolur.
- **Spring Boot:** Çok sağlam/kurumsal fakat en dik öğrenme eğrisi ve kısıtlı staj süresi
  için ağır.

### Değerlendirilen Alternatifler (Veritabanı)

| Kriter | PostgreSQL (SEÇİLEN) | MySQL/MariaDB | MongoDB | SQLite |
|--------|----------------------|---------------|---------|--------|
| İlişkisel bütünlük | Yüksek | Yüksek | Düşük (belge) | Yüksek |
| İstatistik/agregasyon | Çok güçlü | İyi | Orta | Sınırlı |
| Soft-delete/JOIN ihtiyacı | İdeal | İyi | Zor | İyi ama ölçek sınırlı |
| Üretim uygunluğu | Yüksek | Yüksek | Yüksek | Sadece dev/demo |

### Gerekçe (Neden PostgreSQL?)

- Admin paneli **ilişkisel sorgular** (meslek filtresi, ortalama süre, tamamlanma oranı,
  token toplamları) ve **soft-delete** gerektiriyor → ilişkisel model ideal.
- Olgun, ücretsiz, güçlü agregasyon; local'de Docker ile, yayında managed servis
  (Neon/Supabase/Railway/RDS) ile aynı `DATABASE_URL` üzerinden çalışır.

### Sonuçlar / Etkiler

- ORM kararı ayrı bir ADR olarak alınacak (Prisma önerilir; Better Auth resmi Prisma
  adaptörüne sahip — bkz. ADR-0003).
- Geliştirme: local Docker Postgres; production: bulut managed Postgres.

---

## ADR-0003 — Kimlik Doğrulama Altyapısı: Better Auth

- **Tarih:** 2026-07-29
- **Durum:** Kabul edildi
- **Karar verenler:** Ekip (birlikte)

### Bağlam

Auth dilimi şunları gerektiriyor: e-posta/şifre + Google OAuth, zorunlu e-posta
doğrulama, kullanıcı/admin rol ayrımı, "beni hatırla" oturumu, başarısız girişte
throttling/CAPTCHA, seed ile tanımlı admin. Ayrıca admin paneli tüm kullanıcı verisine
erişip soft-delete ve token/maliyet istatistikleri üretecek → verinin kendi
veritabanımızda olması önemli.

### Karar

Kimlik doğrulama için **Better Auth** (kendi PostgreSQL'imizde, NestJS backend içinde)
seçildi.

### Değerlendirilen Alternatifler

| Kriter | A) Passport+JWT (kendi) | Better Auth (SEÇİLEN) | Clerk/Auth0 (managed) |
|--------|-------------------------|------------------------|------------------------|
| Veri sahipliği | Kendi Postgres | **Kendi Postgres** | Dış servis |
| Kurulum süresi | Uzun | Orta (hazır özellikler) | En kısa |
| E-posta doğ./throttling/OAuth | Elle | Hazır | Hazır |
| Admin istatistik/soft-delete | Kolay (tek DB) | Kolay (tek DB) | Shadow-user senkronu gerekir |
| Dış bağımlılık/maliyet/lock-in | Yok | Yok | Var |
| Hesap bağlama (Google↔email) | Elle | Eklenti ile hazır | Hazır |
| Olgunluk/ekosistem | En olgun | Yeni (hızlı büyüyor) | Olgun |
| NestJS entegrasyonu | Yerel | Adapter/köprü gerekir | SDK |

### Gerekçe (Neden Better Auth?)

- **İki ana endişeyi birden çözüyor:** (1) süre — e-posta doğrulama, throttling, Google
  OAuth, "beni hatırla", şifre sıfırlama, hesap bağlama hazır gelir (Passport'a göre çok
  daha hızlı); (2) veri sahipliği — kullanıcı/oturum verisi kendi PostgreSQL'imizde durur,
  böylece admin istatistikleri ve soft-delete tek DB'den kolayca yapılır.
- Ekstra altyapı yok: ayrı bir auth servisi çalıştırılmaz; NestJS backend'in içinde bir
  kütüphane olarak çalışır (local Docker Postgres → bulut Postgres, sadece `DATABASE_URL` değişir).
- Anayasadaki "sunucu tarafı yetki + sır gömme yasağı" ilkesine uygun.

### Neden Diğerleri Değil?

- **Passport+JWT (kendi):** En yüksek kontrol/öğrenme ama e-posta doğrulama, throttling,
  OAuth, hesap bağlamayı elle kurmak kısıtlı sürede uzun sürer.
- **Clerk/Auth0 (managed):** En hızlı kurulum fakat kullanıcı verisi dış serviste kalır →
  admin "tüm kullanıcılar" listesi/istatistik ve soft-delete için sürekli shadow-user
  senkronizasyonu; ayrıca vendor lock-in, kota ve "admin sadece e-posta/şifre" gibi özel
  kuralların uygulanma zorluğu.

### Sonuçlar / Etkiler

- Better Auth'u NestJS'e bağlamak için küçük bir **adapter/köprü** kodu yazılacak
  (Better Auth Express/Node handler'ının Nest'e mount edilmesi).
- ORM olarak **Prisma** öneriliyor (Better Auth resmi Prisma adaptörü mevcut); nihai ORM
  kararı ayrı ADR olacak.
- E-posta doğrulama için bir **mail gönderim yolu** (SMTP / mail servisi) gerekli; ayrı
  küçük bir ADR ile kararlaştırılacak.
- Tüm gizli anahtarlar (`.env`) koda gömülmez; örnek `.env.example` paylaşılır.

---
## ADR-0004 — Test Araçları: Jest+Supertest (backend) / Vitest+RTL (frontend) / Playwright (e2e)

- **Tarih:** 2026-07-30
- **Durum:** Kabul edildi
- **Karar verenler:** Ekip (birlikte)

### Bağlam

Anayasa İlke III (Test-first/ATDD) her kabul kriterinin en az bir teste bağlanmasını
zorunlu kılıyor. Backend NestJS, frontend Vite+React seçili (ADR-0001, ADR-0002).
`specs/001-auth-rol/plan.md` bu araçları zaten varsaymıştı ama karar `DECISIONS.md`'ye
hiç yansımamıştı; bu ADR o eksikliği gideriyor.

### Karar

- **Backend birim/entegrasyon:** Jest
- **Backend e2e/HTTP:** Supertest
- **Frontend birim/component:** Vitest + React Testing Library
- **Uçtan uca (e2e):** Playwright (Google OAuth mock/staging akışları)

### Değerlendirilen Alternatifler

| Kriter | Jest+Supertest+Vitest+RTL+Playwright (SEÇİLEN) | Mocha+Chai+Cypress | Vitest tek araç (backend dahil) |
|--------|--------------------------------------------------|---------------------|-----------------------------------|
| Performans | İyi (framework varsayılanı, paralel) | Orta | İyi ama NestJS DI mock desteği zayıf |
| Kompleksite | Düşük (her framework kendi resmi aracı) | Orta (ayrı config) | Orta (resmi olmayan adapter gerekir) |
| Ölçeklenebilirlik | Yüksek (geniş ekosistem, paralel test) | Orta | Orta |
| Bakım | Düşük risk (resmi dokümanla birebir) | Orta (Cypress e2e ağır) | Orta (resmi olmayan entegrasyon riski) |
| Maliyet | Yok (açık kaynak, hazır kurulum) | Yok ama config maliyeti yüksek | Yok ama entegrasyon riski var |

### Gerekçe

- NestJS CLI projede Jest'i varsayılan getirir; Supertest NestJS'in resmi e2e test
  dokümantasyonunda önerilen HTTP test aracı — ek kurulum/adapter maliyeti yok.
- Vitest, Vite config'ini doğrudan paylaşır ve Jest API'siyle uyumlu; React Testing
  Library component testleri için ekosistem standardı.
- Playwright, Google OAuth gibi gerçek tarayıcı gerektiren e2e akışları (mock/staging ile)
  test etmek için gerekli.

### Neden Diğerleri Değil?

- **Mocha+Chai+Cypress:** Daha fazla manuel config (ayrı assertion kütüphanesi, NestJS
  testing modülüyle resmi entegrasyon yok); Cypress component-level testlerde Playwright'a
  göre daha ağır.
- **Vitest'i backend'de de kullanmak:** Araç sayısını azaltır ama `@nestjs/testing`
  modülü Jest'e göre optimize edilmiş; resmi olmayan adapter/config gerektirir.

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` Testing satırı bu karara göre güncellenir.
- `specs/001-auth-rol/tasks.md` test görevleri bu araçlarla yazılır (Faz 2/3 unit+integration,
  Faz 9 e2e).

---


## ADR-0005 — ORM Sürüm Kilidi: Prisma 6.19.3 (Prisma 7'ye şimdilik geçilmiyor)

- **Tarih:** 2026-07-30
- **Durum:** Kabul edildi
- **Karar verenler:** Ekip (kullanıcı onayı ile, `/speckit.implement` oturumu)

### Bağlam

ADR-0003, ORM olarak Prisma'yı "önerilen" işaretlemiş ve nihai sürüm/major kararını
ayrı bir ADR'ye ertelemişti (`docs/TECH_STACK.md` ORM satırı `_TBD_` idi). Auth dilimi
implementasyonu sırasında `npm install prisma@latest` otomatik olarak **Prisma 7**'yi
kurdu. Prisma 7, `schema.prisma` içindeki klasik `datasource.url` alanını kaldırıp
yerine `prisma.config.ts` + sürücü adaptörü (`adapter`) modelini zorunlu kılıyor. Bu,
hem `specs/001-auth-rol/data-model.md`'nin varsaydığı klasik şema biçimiyle hem de
Better Auth'un resmi Prisma adaptörü (`better-auth/adapters/prisma`) ile uyumsuzdu
(migration `P1012` hatasıyla sonuçlandı).

### Karar

ORM sürümü **Prisma 6.19.3** (son kararlı 6.x sürümü) olarak kilitlendi. `backend/package.json`
içinde `prisma` ve `@prisma/client` bu sürüme **exact pin** (`6.19.3`, `^` olmadan) ile
sabitlenmiştir.

### Değerlendirilen Alternatifler

| Kriter | A) Prisma 6.19.3 (SEÇİLEN) | B) Prisma 7.x'e hemen geçiş |
|--------|------------------------------|------------------------------|
| Better Auth adaptör uyumluluğu | Doğrulandı (bu oturumda migration + testler yeşil) | Belirsiz — Better Auth'un resmi Prisma adaptörü Prisma 7'nin yeni `adapter`/`prisma.config.ts` modelini henüz belgelemiyor |
| data-model.md ile uyum | Birebir (klasik `datasource.url` şeması) | data-model.md'nin yeniden yazılmasını gerektirir |
| Rework riski (staj süresi kısıtlı) | Düşük | Yüksek (config modeli + adaptör + migration akışı yeniden kurulur) |
| Güncellik | Bir major geride | En güncel |

### Gerekçe

- Zaten onaylanmış tasarım dokümanlarını (data-model.md, ADR-0003) bozmadan, mevcut
  Better Auth + Prisma entegrasyonunu çalışır durumda tutmak öncelikliydi.
- Prisma 7'nin yeni config modeline geçişin Better Auth tarafında resmi/doğrulanmış
  bir destek hattı bu oturumda tespit edilemedi; riskli ve zaman kısıtlı bir stajda
  gereksiz rework yaratır.
- 6.x hattı hâlâ aktif olarak yayınlanıyor (6.19.3) ve güvenlik/hata düzeltmeleri alıyor.

### Neden Diğeri Değil?

- **Prisma 7'ye hemen geçiş:** En güncel sürüm olması dışında bu dilim için somut bir
  fayda sağlamıyor; `prisma.config.ts` + adapter modeline geçiş, migration akışının ve
  Better Auth entegrasyonunun yeniden doğrulanmasını gerektirir. Şimdilik ertelendi.

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` ORM satırı bu karara göre güncellenir (artık `_TBD_` değil).
- `backend/package.json`'da `prisma`/`@prisma/client` `6.19.3` olarak **exact pin**'li kalır;
  gelecekte Prisma 7'ye geçiş ayrı bir ADR ile ele alınacak (Better Auth'un resmi Prisma 7
  desteği netleştiğinde yeniden değerlendirilir).

## ADR-0006 — LLM Sağlayıcı: OpenAI

- **Tarih:** 2026-07-30
- **Durum:** ⛔ **DEĞİŞTİRİLDİ (superseded)** — bkz. [ADR-0007](#adr-0007--llm-sağlayıcı-Groq-birincil--deepseek-yedek)
- **Karar verenler:** Ekip (birlikte)

> **Neden değiştirildi:** Bu ADR yazıldıktan sonra ekip **"LLM maliyeti sıfır olmalı"**
> kısıtını netleştirdi. Bu kısıt karar anında bilinmiyordu; ADR-0006 maliyeti "bu ölçekte
> ayırt edici değil" varsayımı üzerine kuruluydu ve o varsayım geçersiz kaldı. Analiz
> tarihsel kayıt olarak korunmuştur — ücretli sağlayıcıların neden değerlendirildiğini ve
> bütçe kısıtı kalkarsa hangi seçeneğin doğru olduğunu belgeler.

> **Numara notu:** E-posta gönderim yolu (SMTP / mail servisi) kararı **ADR-0008**
> numarasına rezerve edilmiştir (bkz. aşağıdaki yer tutucu). ADR-0004 = Test Araçları,
> ADR-0005 = ORM sürüm kilidi olarak kullanılmıştır. Numaralandırmanın tek doğru kaynağı
> bu dosyadaki **ADR Kayıt Defteri** tablosudur.

### Bağlam

`docs/TECH_STACK.md`'de LLM sağlayıcı `_Kararlaştırılacak_` durumdaydı. `003-pre-assessment`
dilimi projedeki **ilk LLM entegrasyonu** olduğu için kararı vermek zorunda kaldı. Ancak
seçim yalnızca o dilimi bağlamıyor; ürünün tüm LLM ihtiyaçlarını kapsıyor:

| Dilim | LLM ihtiyacı | Kritik yetenek |
|-------|--------------|----------------|
| Pre-assessment | Kısa prompt → yapılandırılmış JSON rapor | Şema garantili çıktı |
| Interview — soru üretimi | İş ilanı metni (PDF'ten çıkarılmış, uzun) → N soru | Uzun bağlam + şema |
| Interview — **sözlü mod** | Gerçek zamanlı sesli AI asistan (`docs/APP_FLOW.md` ekran 7) | **Realtime ses API'si** |
| Interview — değerlendirme raporu | Tüm soru-cevaplar → Teknik/Davranışsal/Genel rapor | Uzun bağlam + şema |

Sözlü mod, anayasanın "Teknoloji ve Kısıtlar" bölümünde ürün kapsamına dahil edilmiştir;
opsiyonel bir bonus değildir.

### Karar

LLM sağlayıcı olarak **OpenAI** seçildi. Pre-assessment dilimi için model: `gpt-4.1-mini`.
Interview dilimlerinin model seçimi, o dilimlerin planlama aşamasında aynı sağlayıcı içinde
ayrıca değerlendirilecektir.

### Değerlendirilen Alternatifler

Her seçenek performans, kompleksite, ölçeklenebilirlik, bakım ve maliyet açısından
değerlendirildi. Fiyatlar 1M token başına girdi/çıktı, Temmuz 2026 itibarıyla.

| Kriter | A) OpenAI (SEÇİLEN) | B) Google Gemini | C) Anthropic Claude |
|--------|---------------------|------------------|---------------------|
| Ucuz model | GPT-4.1-mini $0.40/$1.60 | 2.5 Flash-Lite **$0.10/$0.40** | Haiku 4.5 $1.00/$5.00 |
| Güçlü model | GPT-5.6 Terra $2.50/$15 | 3.1 Pro $2.00/$12 | Sonnet 5 $3/$15 (tanıtım $2/$10) |
| Yapılandırılmış çıktı | **Strict Structured Outputs** (şema uyumu garantili) | `responseSchema` | `output_config.format` (JSON Schema) |
| **Realtime ses API'si** | **Var** (Realtime API) | **Var** (Live API) | **Yok** |
| Token/maliyet raporlama | `usage` | `usageMetadata` | `usage` |
| Node/TS SDK | Resmî, olgun | Resmî | Resmî |
| Türkçe üretim kalitesi | Yüksek | Yüksek | Yüksek |
| Ekip aşinalığı | Yüksek | Orta | Orta |
| Sözlü mod için gereken entegrasyon sayısı | **1** | **1** | **2** (LLM + ayrı STT/TTS) |

### Gerekçe (Belirleyici Eksen: Kompleksite)

Üç sağlayıcı da ilk dilimin gereksinimlerini — şema garantili JSON, token raporlama,
resmî TS SDK, Türkçe üretim — **karşılıyor**. Performans üçünde de yeterli;
ölçeklenebilirlik eşdeğer (üçünde de model yükseltmesi aynı SDK içinde parametre
değişimi). Maliyet de bu ölçekte (onlarca kullanıcı, çağrı başına ~1000 token) ayırt
edici değil: aylık fark birkaç dolar seviyesinde kalıyor.

Ayrımı yapan tek eksen **kompleksite** oldu:

- **Anthropic'in yerel realtime ses API'si yok.** Sözlü mod için ikinci bir sağlayıcı
  (STT + TTS + orkestrasyon) entegre etmek gerekir: ikinci SDK, ikinci API anahtarı,
  ikinci fatura ve **ikinci token/maliyet kaynağı**. Bu, anayasa İlke VI'nın "her LLM
  çağrısı için token ve maliyet kaydedilir, admin panelinde görünür kılınır" hedefini
  iki kaynağın birleştirilmesi problemine dönüştürür.
- **OpenAI ve Gemini** tek sağlayıcıyla dört ihtiyacın tamamını kapsıyor.

OpenAI'nin Gemini'ye tercih edilme nedeni: (1) **Strict Structured Outputs**, üç seçenek
arasında şema uyumunu en katı garanti eden mekanizma — `FR-007` "doğrulamayı geçmeyen
yanıt kaydedilmez" gereksiniminde boşa giden çağrı oranını düşürür; (2) **ekip aşinalığı
en yüksek**, kısıtlı staj süresinde hata ayıklama en hızlı.

### Neden Diğerleri Değil?

- **Google Gemini:** En ucuz seçenek (~4× fark) ve Live API ile sözlü modu da kapsıyor —
  **güçlü bir ikinci tercih**. Maliyet birincil kısıt olsaydı seçilirdi. Bu ölçekte
  maliyet farkı aylık birkaç dolarda kaldığı, buna karşılık ekip aşinalığı ve
  structured-output katılığı OpenAI'de daha yüksek olduğu için ikinci sırada kaldı.
- **Anthropic Claude:** Metin kalitesi ve şema desteği eşdeğer güçlükte; eleyen tek şey
  realtime ses API'sinin bulunmaması ve bunun getirdiği ikinci entegrasyon yükü.

### Kararın Yanlış Olacağı Durum

1. **Sözlü mod kapsamdan çıkarsa.** Belirleyici eksen ortadan kalkar; karar maliyet
   eksenine düşer ve **Gemini 2.5 Flash-Lite** (~4× ucuz) doğru seçim olur.
2. **Kullanım hacmi ölçek değiştirirse.** Onlarca değil binlerce kullanıcıya çıkılırsa
   aylık maliyet farkı "birkaç dolar" olmaktan çıkar ve maliyet belirleyici eksene döner.

Her iki koşulda da bu ADR yeniden değerlendirilmeli; süperseded edilirse yeni ADR
numarasıyla kaydedilmelidir.

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | **Realtime API'nin Türkçe ses kalitesi doğrulanmadı.** Kararın belirleyici gerekçesi sözlü mod; TR STT/TTS kalitesi beklenenin altında çıkarsa gerekçenin temeli çöker. | Interview dilimi planlanmadan **önce** küçük bir spike ile TR ses kalitesi ölçülecek. Yetersizse ADR yeniden değerlendirilir (Gemini Live API veya ayrı ses sağlayıcısı). |
| R2 | **Strict Structured Outputs, JSON Schema'nın tüm kısıtlarını desteklemiyor.** `minLength`, `minItems`, `maxItems` gibi kısıtlar strict modda kabul edilmeyebilir; `contracts/llm-contract.md`'deki şema bu kısıtları kullanıyor. | Şema iki katmana ayrılır: yapısal kısıtlar (tip, `enum`, `required`, `additionalProperties: false`) sağlayıcıya gönderilir; sayısal/uzunluk kısıtları **Zod `superRefine`** ile runtime'da doğrulanır. `FR-007` yine karşılanır. |
| R3 | **Tek sağlayıcıya bağımlılık.** Kota aşımı, kesinti veya fiyat artışı tüm LLM özelliklerini aynı anda durdurur. | Sağlayıcıya özgü kod tek adapter dosyasında izole (`backend/src/llm/providers/`); servis katmanı yalnızca `LlmProvider` arayüzünü görür. Sağlayıcı değişiminde değişen dosya sayısı **bir**. `TokenUsage` tablosunda `provider` + `model` alanları tutulur; geçmiş kayıtlar sağlayıcı değişse de anlamlı kalır. |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "AI / LLM" bölümündeki LLM provider satırı **OpenAI** olarak
  kilitlenir.
- Gizli yapılandırma `.env` üzerinden: `LLM_API_KEY`, `LLM_MODEL`. Koda gömülmez;
  `.env.example` paylaşılır (İlke V).
- Sağlayıcıya özgü tüm kod `backend/src/llm/providers/` altında tek adapter dosyasında
  toplanır; `LlmService` ve dikey dilimler yalnızca `LlmProvider` port arayüzünü bilir.
  Bu, R3'ün azaltması ve testlerde mock'un takıldığı sınırdır.
- Token ve maliyet kaydı tek bir `TokenUsage` tablosunda toplanır (cross-cutting);
  Interview ve Admin dilimleri aynı tabloyu kullanır (İlke VI).
- **Yeniden değerlendirme tetikleyicileri:** sözlü modun kapsamdan çıkması, aylık LLM
  maliyetinin bütçeyi aşması, veya R1 spike'ının olumsuz sonuçlanması.

**Fiyat kaynakları (Temmuz 2026):**
[OpenAI API Pricing — BenchLM](https://benchlm.ai/openai/api-pricing) ·
[GPT-5.6 Pricing — aipricing.guru](https://www.aipricing.guru/openai-pricing/) ·
[Gemini API Pricing — BenchLM](https://benchlm.ai/google/api-pricing) ·
[Google Gemini API Pricing 2026 — OpsLyft](https://www.opslyft.com/blog/google-gemini-api-pricing-2026).
Anthropic model/fiyat verisi: `claude-api` skill referansı (cache: 2026-06-24).

---

## ADR-0007 — LLM Sağlayıcı: Groq (birincil) + DeepSeek (yedek)

- **Tarih:** 2026-07-30
- **Durum:** Kabul edildi (ADR-0006'nın yerine geçer)
- **Karar verenler:** Ekip (birlikte)

### Bağlam

ADR-0006 yazıldıktan sonra ekip bir kısıtı netleştirdi: **projenin LLM maliyeti sıfır
olmalı.** Bu bir staj vaka çalışmasıdır; kurumsal bir LLM bütçesi yoktur ve ödemeli API
anahtarı temin edilmesi beklenmemektedir. ADR-0006 "bu ölçekte maliyet farkı ayırt edici
değil" varsayımı üzerine kuruluydu; ücretsizlik mutlak bir kısıt hâline gelince o varsayım
geçersiz kaldı ve maliyet **eleyici** eksene dönüştü.

Değişmeyen teknik ihtiyaçlar: yapılandırılmış JSON çıktı ve şema doğrulaması (İlke VI,
FR-007), token/maliyet raporlama (FR-010), Node/TS'ten erişim, Türkçe üretim.

### Karar

**Birincil sağlayıcı: Groq.** Ücretsiz katmanı olan, OpenAI-uyumlu bir API sunar ve
desteklenen modellerinde `response_format: {"type": "json_schema"}` + `strict: true` ile
**constrained decoding** yapar.

**Yedek sağlayıcı: DeepSeek.** Groq ücretsiz katman kotası dolduğunda veya servis
erişilemez olduğunda devreye alınacak ikinci yol. DeepSeek ücretsiz değildir ancak fiyatı
ücretli alternatiflerin bir mertebe altındadır (V4 Flash $0.14/$0.28 per 1M token).

Her iki sağlayıcı da **OpenAI-uyumlu** (OpenAI-compatible) API sunar. Bu, kararın maliyetini
belirleyen teknik ayrıntıdır: tek bir `openai` npm SDK'sı, yalnızca `baseURL` ve `apiKey`
değiştirilerek iki sağlayıcıya da bağlanır. İki sağlayıcı desteklemek ikinci bir SDK,
ikinci bir istemci katmanı veya ayrı bir adapter yazmayı gerektirmez.

### Değerlendirilen Alternatifler

| Eksen | A) Groq — birincil (SEÇİLEN) | B) DeepSeek — yedek (SEÇİLEN) | C) Ücretli (OpenAI / Gemini) |
|-------|------------------------------|-------------------------------|------------------------------|
| **Maliyet** | **Ücretsiz katman** (kota sınırlı) | ~$0.14/$0.28 per 1M (V4 Flash); cache-hit girdi ~$0.03/1M | En düşük ücretli $0.10/$0.40 — yine de sıfır değil |
| **Performans** | LPU tabanlı, çok yüksek token/sn — 30 sn timeout'a geniş pay | İyi; thinking/non-thinking modları var | İyi |
| **Şema garantisi** | `json_schema` + `strict: true` → constrained decoding, %100 uyum (**yalnızca desteklenen modellerde**) | Yalnızca `json_object` — **geçerli JSON garantisi var, şema garantisi YOK** | Strict Structured Outputs / responseSchema |
| **Kompleksite** | OpenAI-uyumlu → mevcut SDK, `baseURL` değişimi | OpenAI-uyumlu → aynı SDK, ikinci `baseURL` | Kendi resmî SDK'sı |
| **Ölçeklenebilirlik** | Ücretsiz katman kotası **sert tavan** — demo/geliştirme ölçeğine uygun, üretime değil | Ödemeli, pratikte tavansız | Ödemeli, tavansız |
| **Bakım** | Açık kaynak model kataloğu; model adları/desteği değişebilir | Sürüm takibi tek sağlayıcı | En olgun, en stabil |
| **Realtime ses (sözlü mod)** | **Çift yönlü realtime oturum yok** | **Yok** | Var (Realtime API / Live API) |

### Gerekçe (Belirleyici Eksen: Maliyet)

ADR-0006'da belirleyici eksen **kompleksite** idi (sözlü mod için tek entegrasyon).
Ücretsizlik mutlak kısıt hâline gelince eksen sırası değişti: **maliyet artık eleyici** —
sıfır olmayan her seçenek en baştan elenir. Bu, C) seçeneğini tümüyle dışarıda bırakır.

Kalan iki seçenek arasında Groq'un birincil olmasının nedeni **şema garantisi**: FR-007
"doğrulamayı geçmeyen yanıt kaydedilmez" diyor ve Groq `strict: true` ile bunu sağlayıcı
düzeyinde garanti ediyor; DeepSeek yalnızca "geçerli JSON" garantisi veriyor. DeepSeek'in
tamamen elenmemesinin nedeni ise Groq'un **ücretsiz katman kotası**: kota dolduğunda tek
sağlayıcılı bir kurulum tümüyle durur. İki sağlayıcı OpenAI-uyumlu olduğu için yedek yol
neredeyse bedava geldi — yoksa tek sağlayıcıda kalınırdı.

Diğer eksenler ayrıştırıcı olmadı: performans üç seçenekte de 30 sn bütçesinin çok
altında; ölçeklenebilirlik bu ölçekte (onlarca kullanıcı) bağlayıcı değil; kompleksite
Groq ve DeepSeek'te OpenAI-uyumluluk sayesinde eşit.

### Neden Diğerleri Değil?

- **OpenAI / Gemini (ADR-0006):** Teknik olarak en güçlü seçenekler ve sözlü modu tek
  entegrasyonla çözen tek adaylar. Ücretsizlik kısıtı nedeniyle elendiler — teknik bir
  yetersizlikten değil.
- **Yalnızca Groq (yedeksiz):** Ücretsiz katman kotası sert bir tavandır; demo sunumu
  sırasında kotaya takılmak tüm LLM özelliklerini durdurur. Yedek yolun maliyeti
  OpenAI-uyumluluk sayesinde ihmal edilebilir olduğu için yedeksiz kalmak gerekçesiz kaldı.
- **Yalnızca DeepSeek:** Ücretsiz değil ve şema garantisi vermiyor; birincil olmak için
  Groq'a göre iki eksende de geride.

### Kararın Yanlış Olacağı Durum

1. **Ücretsizlik kısıtı kalkarsa** (kurumsal kredi, sponsorluk, eğitim kotası) — eleyici
   eksen ortadan kalkar ve **ADR-0006 yeniden geçerli olur**; özellikle sözlü mod
   uygulanacaksa ücretli sağlayıcı tek entegrasyonla çözer.
2. **Groq'un Türkçe üretim kalitesi yetersiz çıkarsa** — Groq açık kaynak model kataloğu
   sunar; Türkçe kalitesi ücretli sağlayıcıların kapalı modelleriyle eşit olmayabilir.
   Rapor metni kullanıcıya doğrudan gösterildiği için bu, kabul edilemez bir kalite
   düşüşüyse karar yeniden değerlendirilmelidir (bkz. R4).

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | **Groq ücretsiz katman kotası dolar** — demo/sunum sırasında tüm LLM özellikleri durur. | İki yol: (a) **otomatik** — `LLM_ALT_*` dolduruluysa birincil hata verdiği anda aynı çağrı DeepSeek'te bir kez tekrarlanır (operasyon ayrımı yok, `LlmService`); (b) **elle** — `LLM_PROVIDER`/`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` değiştirilip yeniden başlatılır (aynı SDK, farklı `baseURL`). Ayrıca FR-013 (kullanıcı başına saatte 5 çağrı) kota tüketimini zaten sınırlıyor. |
| R2 | **DeepSeek şema garantisi vermiyor** — yedek yola düşüldüğünde sağlayıcı düzeyinde uyum garantisi kaybolur. | İki katmanlı şema tasarımı zaten mevcut (`contracts/llm-contract.md`): katman 2 (Zod runtime doğrulama) **her sağlayıcıda** çalışır ve DeepSeek yolunda tek garanti olur. DeepSeek yolunda şema ayrıca prompt'a metin olarak gömülür ve prompt'ta "json" kelimesi geçirilir (sağlayıcı gereksinimi). |
| R3 | **Sözlü mod çözümsüz kalır** — ne Groq ne DeepSeek çift yönlü realtime konuşma oturumu sunuyor. | Sözlü mod bu dilimin kapsamında değil. Interview dilimi planlanırken **ayrı bir karar** olarak ele alınacak; muhtemel yollar: tarayıcı Web Speech API (ücretsiz, istemci tarafı), ayrı STT/TTS servisi, veya sözlü modun kapsam dışına alınması. Bu, ADR-0007'nin bilinen ve kabul edilmiş bedelidir. |
| R4 | **Türkçe üretim kalitesi doğrulanmadı** — açık kaynak modellerin TR performansı değişkendir. | Implementasyon başlarken küçük bir spike: aynı prompt Groq'un aday modellerinde çalıştırılıp Türkçe rapor kalitesi karşılaştırılır. Model seçimi bu ölçümle netleşir; `LLM_MODEL` `.env`'den geldiği için değişimi tek satır. |
| R5 | **Groq'ta `strict` modu yalnızca belirli modellerde** — seçilen model desteklemiyorsa şema garantisi sessizce kaybolur. | Model seçilirken `strict` desteği **doğrulanacak** ve `.env.example`'da desteklenen bir model varsayılan olarak yazılacak. Desteklenmeyen modelde davranış DeepSeek yoluyla aynıdır — katman 2 devreye girer, sistem bozulmaz. |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → LLM provider satırı **Groq (birincil) + DeepSeek (yedek)** olarak
  güncellenir; ADR-0006 kaynaklı OpenAI satırları kaldırılır.
- **Tek SDK:** `openai` npm paketi her iki sağlayıcı için kullanılır (OpenAI-uyumlu API).
  `.env`: `LLM_PROVIDER` (`Groq` | `deepseek`), `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.
  Anahtarlar koda gömülmez; `.env.example` paylaşılır (İlke V).
- `backend/src/llm/providers/` altında **tek bir OpenAI-uyumlu adapter** yeterlidir;
  sağlayıcı farkı yapılandırma verisidir, ayrı sınıf değil. Yalnızca şema iletim biçimi
  sağlayıcıya göre dallanır (`json_schema+strict` ↔ `json_object`+prompt'a gömme).
- `TokenUsage.provider` alanı `Groq` / `deepseek` değerlerini alır; sağlayıcı değişse de
  geçmiş maliyet kayıtları anlamlı kalır.
- **Fiyat notu (2026-08-10, güncelleme):** Token/maliyet raporlaması (FR-010) için
  `backend/src/llm/providers/provider.config.ts` içindeki `PRICING.groq` sabiti
  başlangıçta `$0/$0` idi (ücretsiz katmanda **gerçek harcama** sıfır olduğu için). Ancak
  bu, admin panelindeki "tahmini maliyet" alanını her mülakat için **$0** gösteriyordu ve
  FR-010'un maliyet görünürlüğü amacını işlevsiz bırakıyordu. Karar güncellendi: `PRICING`
  artık sağlayıcının **liste fiyatını** tutar (Groq `gpt-oss-120b`: **$0.15 girdi /
  $0.75 çıktı** per 1M token). Önemli ayrım korunur — ücretsiz katmanda cebimizden çıkan
  para hâlâ $0'dır; kaydedilen `estimatedCostUsd` ise "aynı kullanım ücretli olsaydı ne
  tutardı" anlamında **liste-fiyatı eşdeğeridir**, böylece token tüketimi izlenebilir ve
  raporlanabilir kalır. Gerçek harcama izlemesi gerekirse sağlayıcı faturası tek doğruluk
  kaynağıdır; bu alan tahminî üst sınırdır.
- **Sözlü mod (Interview dilimi) için ayrı karar gerekir** — bu ADR onu çözmez (R3).
  `docs/PLAN.md` ve Interview diliminin spec'i bunu açık madde olarak taşımalıdır.

**Kaynaklar (Temmuz 2026):**
[Groq Structured Outputs — GroqDocs](https://console.groq.com/docs/structured-outputs) ·
[DeepSeek JSON Output](https://deepseekai.guide/api/deepseek-api-json-mode/) ·
[DeepSeek API Pricing — BenchLM](https://benchlm.ai/deepseek/api-pricing) ·
[DeepSeek API Pricing — TLDL](https://www.tldl.io/resources/deepseek-api-pricing)

---

## ADR-0008 — E-posta Gönderim Yolu: Resend

- **Tarih:** 2026-07-31
- **Durum:** ✅ Kabul edildi
- **Sahibi:** `001-auth-rol`
- **Karar verenler:** Ekip (birlikte)

### Bağlam

Zorunlu e-posta doğrulaması (FR-019) bir gönderim yolu gerektiriyor. `001-auth-rol`
implementasyonu bu karara kadar **bloklanmadı**: geliştirmede doğrulama bağlantısı konsola
log'landı (`tasks.md` T023). Diğer LLM/altyapı kararlarında olduğu gibi (ADR-0007) proje
sıfır/düşük maliyet kısıtı altında; kişisel kredi kartı taahhüdü gerektirmeyen bir
sağlayıcı tercih edilir.

### Karar

**Resend** seçildi. `backend/src/auth/mail/verification-mailer.ts`, `MAIL_TRANSPORT` ortam
değişkenine göre dallanır: `console` (varsayılan, geliştirme — mail hesabı gerekmez) veya
`resend` (production — `RESEND_API_KEY` + resmi `resend` npm paketi).

### Değerlendirilen Alternatifler

| Kriter | A) Resend (SEÇİLEN) | B) Brevo | C) Kendi SMTP (nodemailer) |
|--------|----------------------|----------|------------------------------|
| Maliyet | Ücretsiz katman: 100 mail/gün, 3000/ay, kredi kartı gerekmez | Ücretsiz katman: 300 mail/gün | Ücretsiz (mevcut hesap varsa) ama app-password/hesap yönetimi ek yük |
| Kompleksite | Resmi Node SDK, tek `emails.send()` çağrısı, SMTP config yok | SDK veya SMTP; DX Resend'e göre biraz daha ağır | `nodemailer` + host/port/user/pass yapılandırması, transport hata yönetimi elle |
| Bakım | Transactional mail'e özel, basit API yüzeyi | Benzer ama daha geniş (kampanya vb.) özellik seti | Sağlayıcıya (Gmail vb.) bağımlı, App Password süresi/2FA riskleri |
| Ekip aşinalığı | Yeni ama minimal entegrasyon yüzeyi | Yeni | Yaygın ama kurulum manuel |

### Gerekçe

Resend, en az kodla (tek SDK çağrısı, SMTP yapılandırması yok) ücretsiz ve kredi kartsız
bir yol sunuyor — staj vaka çalışması ölçeğinde bu iş için yeterli kota. Brevo teknik
olarak eşdeğer ama SDK/DX Resend kadar sade değil; kendi SMTP'si üçüncü taraf servis
bağımlılığını kaldırır ama App Password yönetimi ve transport hata yüzeyini takıma yükler
— YAGNI: bu iş için gereğinden fazla operasyonel yük.

### Sonuçlar / Etkiler

- `.env.example`: `MAIL_SMTP_*` alanları kaldırıldı, `RESEND_API_KEY` eklendi.
- `backend/src/config/env.validation.ts`: `MAIL_TRANSPORT` enum'u `console | resend`.
- Test kapsamı: `backend/src/auth/mail/verification-mailer.spec.ts` (Resend SDK mock'lanarak
  hem `resend` hem `console` yollarını doğrular); mevcut `us1-email-verification.spec.ts`
  entegrasyon testi `sendVerificationEmail`'i tamamen mock'ladığı için transport değişiminden
  etkilenmedi, yeşil kaldı.
- `tasks.md` T023/T063 bu kararla tamamlandı olarak işaretlendi.

---

## ADR-0009 — PDF Metin Çıkarma Kütüphanesi: unpdf

- **Tarih:** 2026-07-31
- **Durum:** ✅ Kabul edildi
- **Sahibi:** `002-interview`

### Bağlam

İş ilanı PDF olarak yüklenebiliyor ve metin çıkarımı **server-side** yapılıyor
(`docs/APP_FLOW.md` §5). `PdfExtractionService` arayüzü (`extractText(buffer): Promise<string>`)
somut kütüphaneyi soyutluyor; bu ADR yalnızca arayüzün **arkasındaki** kütüphaneyi seçer,
sözleşmeyi değiştirmez (FR-002: azami 10 MB, yalnızca `application/pdf`, metin
çıkarılamazsa `422`, görüşme oluşturulmaz).

### Karar

**`unpdf`** (UnJS ekibinin PDF.js sarmalayıcısı). Mozilla PDF.js'in aynı ayrıştırma
motorunu kullanır ama sunucu/serverless kullanım için sadeleştirilmiş bir API sunar
(`getDocumentProxy` + `extractText`).

### Değerlendirilen Alternatifler

| Eksen | A) unpdf (SEÇİLEN) | B) pdf-parse | C) pdfjs-dist (doğrudan) |
|-------|---------------------|--------------|---------------------------|
| **Native derleme bağımlılığı** | **Yok** — saf JS | Yok | Yok |
| **Ayrıştırma motoru** | Mozilla PDF.js (aynı motor) | Eski/pinlenmiş bir PDF.js çatalı | Mozilla PDF.js (güncel) |
| **API yüzeyi** | Küçük, tek amaçlı (`extractText`) | Küçük, tek amaçlı | Geniş — worker/canvas/font kurulumu elle yapılır |
| **Bakım durumu** | Aktif (UnJS), sık sürüm | Düşük aktivite; gecmişte ReDoS danışma kaydı (regex tabanlı ayrıştırma) | Aktif (Mozilla) ama Node için sarmalama gerekir |
| **Kurulum ek yükü** | Düşük — tek paket, dogrudan çağrı | Düşük | Yüksek — legacy build / worker path elle seçilir |
| **Bulgu (implementasyon sırasında)** | Bundled motor **yalnızca ESM** dagitiliyor (`unpdf/pdfjs`) — gercek Node calisma zamaninda sorun yok (dogrulandi), yalnizca Jest'in CJS derlemesinde dinamik `import()` kisitina takiliyor (Node ≥24.9 gerektiriyor). Testlerde `PdfExtractionService`'in port sinirinda mock'lanarak asildi (bkz. `test/fakes/fake-unpdf.ts`) — production kodu etkilenmiyor. | — | — |

### Gerekçe (Belirleyici Eksen: Native Bağımlılık Yokluğu + API Sadeliği)

Üç aday da native derleme bağımlılığı getirmiyor (Docker imajı için eleyici bir fark
yok). Ayrıştırıcı eksen **kurulum yükü + motor güncelligi** oldu: `pdfjs-dist`'i doğrudan
kullanmak worker/canvas yapılandırması gerektiriyor — bu projenin ihtiyacı yalnızca düz
metin çıkarmak, sayfa render etmek değil; bu yüzden C) gereksiz karmaşıklık ekliyor.
`pdf-parse` daha basit ama **eski bir PDF.js çatalını** pinliyor ve bakım aktivitesi düşük.
`unpdf`, `pdfjs-dist` ile **aynı güncel motoru** kullanıp `pdf-parse` kadar sade bir API
sunuyor — iki adayın iyi taraflarını birleştiriyor.

### Neden Diğerleri Değil?

- **pdf-parse:** Basit API'si cazip ama pinlenmiş eski motor Türkçe karakter/font
  çeşitliliğinde `pdfjs-dist`'in güncel sürümüne göre daha kırılgan; aktif bakım azlığı
  güvenlik yaması gecikmesi riski taşıyor.
- **pdfjs-dist (doğrudan):** Teknik olarak en olgun seçenek ama bu projede yalnızca
  metin çıkarımı gerektiği için worker/canvas kurulumu **karşılıksız karmaşıklık**
  (Anayasa İlke VII — gerekçesiz karmaşıklık kaçınımı).

### Kararın Yanlış Olacağı Durum

1. **Taranmış (görüntü) PDF desteği talep edilirse** — hiçbir aday OCR yapmaz; bu üçünün
   ortak sınırıdır, karar değişse de çözülmez (kapsam dışı, FR-002 zaten `422` bekliyor).
2. **Node sürümü ≥24.9'a yükseltilirse** — Jest'in ESM dinamik import kısıtı kalkar,
   test mock'u kaldırılıp gerçek kütüphaneyle entegrasyon testi yazılabilir (opsiyonel
   iyileştirme, bloklayıcı değil).

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "PDF processing" satırı **unpdf** olarak güncellenir;
  `_Kararlaştırılacak_` kalkar.
- `backend/src/pdf/pdf-extraction.service.ts` bu kütüphaneyi kullanır; arayüz sözleşmesi
  değişmedi.
- Testlerde gerçek kütüphane yerine port sınırında mock kullanılır
  (`backend/test/fakes/fake-unpdf.ts`) — Jest/Node sürüm kısıtı nedeniyle, bkz. yukarıdaki
  bulgu satırı. Üretim kodu etkilenmez.

---

## ADR-0010 — Sözlü Mod Altyapısı: Tarayıcı Web Speech API

- **Tarih:** 2026-07-30
- **Durum:** ⛔ Kısmen değiştirildi (STT → ADR-0014, TTS aynen kalır)
- **Sahibi:** `002-interview`

### Bağlam

ADR-0007 (Groq + DeepSeek) LLM sağlayıcıyı ücretsizlik kısıtıyla kilitledi ama **sözlü modu
çözmedi** (ADR-0007 / R3): iki sağlayıcının hiçbiri çift yönlü realtime konuşma oturumu
sunmuyor. Sözlü mod anayasanın "Teknoloji ve Kısıtlar" bölümünde **ürün kapsamındadır**;
opsiyonel bir bonus değildir. `docs/PLAN.md` bu karar alınana kadar sözlü modun MVP
sayılmamasını istemişti — bu ADR o maddeyi kapatıyor.

### Karar

**Sözlü mod, tarayıcı tarafı Web Speech API ile uygulanır.** STT (`SpeechRecognition`) ve
TTS (`SpeechSynthesis`) istemcide çalışır; sunucu tarafında ses işleme **yoktur**. Sunucu,
sözlü modda gelen cevabı yazılı moddan **farksız** işler — istemci sesi metne çevirip
gönderir (`Answer.sourceMode = voice` yalnızca köken kaydıdır).

`mode="voice"` MVP kapsamında kalır; `frontend/src/lib/voice-client.ts` soyutlaması
korunur ve arkasına Web Speech implementasyonu geçer.

### Değerlendirilen Alternatifler

| Eksen | A) Web Speech API (SEÇİLEN) | B) Ayrı STT/TTS servisi | C) Sözlü modu kapsam dışına almak | D) Ücretli realtime sağlayıcı |
|-------|------------------------------|--------------------------|-----------------------------------|-------------------------------|
| **Maliyet** | **Sıfır — tarayıcıda çalışır** | Ücretsiz katman aranmalı, kota riski | Sıfır | Sıfır değil |
| **Kompleksite** | Düşük — ikinci entegrasyon yok, sunucu değişmez | Yüksek — ikinci sağlayıcı + ikinci token/maliyet kaynağı | Yok | Orta (LLM ile aynı sağlayıcı) |
| **Anayasa uyumu** | ✅ ürün kapsamı korunur | ✅ | ⛔ **anayasa değişikliği gerekir** | ✅ |
| **Gözlemlenebilirlik (İlke VI)** | Ses için token/maliyet **yok** — kaydedilecek bir şey yok | İkinci maliyet kaynağı — İlke VI'yı zorlar | — | İkinci maliyet kaynağı |
| **Türkçe kalitesi** | Chrome/Edge'de kabul edilebilir; tarayıcıya göre değişir | Genelde daha iyi | — | İyi |
| **Tarayıcı bağımlılığı** | **Var** — Firefox/Safari desteği kısıtlı | Yok | — | Yok |

### Gerekçe (Belirleyici Eksen: Maliyet + Anayasa)

ADR-0007'de eleyici eksen maliyettir ve o kısıt burada da geçerli — bu D)'yi eler.
C) sözlü modu kapsam dışına almak, anayasanın açıkça ürün kapsamına aldığı bir yeteneği
kaldırmak demek: anayasa değişikliği (MINOR sürüm) gerektirir ve vaka çalışmasının
gösterilebilir kapsamını daraltır; gerekçesi yeterli değil. B) ise ikinci bir entegrasyon
ve **ikinci bir token/maliyet kaynağı** getirir — İlke VI'nın tek noktadan maliyet takibi
gereğini zorlar, ücretsizliği de garanti etmez.

A) sunucu tarafında **hiçbir şey değiştirmiyor**: sözlü cevap sunucuya metin olarak gelir,
mevcut `POST /answers` sözleşmesi aynen çalışır. Maliyet sıfır, entegrasyon sayısı sıfır.

### Neden Diğerleri Değil?

- **Ayrı STT/TTS servisi:** Ücretsiz katman bulunsa bile kota ikinci bir sert tavan ekler
  (ADR-0007 / R1 ile aynı risk, iki kat). Tek kazancı Türkçe kalitesi — bu, demo ölçeğinde
  tarayıcı bağımlılığı bedelini haklı çıkarmıyor.
- **Sözlü modu kapsam dışına almak:** Anayasa ihlali; ayrıca `APP_FLOW.md` ekran 7 ve
  interview spec FR-003/FR-004 (sözlü modda yalnızca `open_ended`) yeniden yazılmalıydı.
- **Ücretli realtime (OpenAI Realtime / Gemini Live):** Ücretsizlik kısıtı. ADR-0006
  yeniden geçerli olursa (bütçe/sponsorluk) bu seçenek tek entegrasyonla en iyisidir.

### Kararın Yanlış Olacağı Durum

1. **Web Speech API'nin Türkçe tanıma doğruluğu kabul edilemez çıkarsa** — cevap metni
   LLM'e girdi olduğu için hatalı transkript doğrudan rapor kalitesini bozar.
2. **Demo tarayıcısı Firefox/Safari ise** — destek kısıtlı; sunum ortamı Chrome/Edge
   olmalı, aksi halde sözlü mod gösterilemez.

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | Tarayıcı desteği yok (Firefox/Safari) | `voice-client.ts` yetenek tespiti yapar; desteklenmiyorsa sözlü mod seçeneği UI'da **devre dışı** gösterilir ve kullanıcı yazılı moda yönlendirilir (İlke VII — zarif toparlanma). Sessiz başarısızlık yok. |
| R2 | Türkçe transkript hataları | Kullanıcı gönderim öncesi metne dökülmüş cevabı **görür ve düzeltebilir** (İlke VII — kullanıcı kontrolü). Bu, `Answer` immutability'sini bozmaz: düzeltme gönderim **öncesi** yapılır. |
| R3 | Mikrofon izni reddedilir | Yazılı moda düşülür, görüşme kaybedilmez. |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "Voice / Speech" satırı **Web Speech API (tarayıcı, istemci
  tarafı)** olarak güncellenir; `_Kararlaştırılacak_` kalkar.
- `docs/PLAN.md` → "Açık Karar: Sözlü Mod Altyapısı" bölümü kapanır; sözlü mod **MVP**.
- Sunucu tarafı sözleşme **değişmiyor** — `POST /api/interviews/:id/answers` sözlü/yazılı
  ayrımı yapmaz. `Answer.sourceMode` yalnızca köken kaydıdır.
- Sesli akış için **token/maliyet kaydı yoktur** (LLM çağrısı değil) — `TokenUsage`'a
  sözlü moda özgü satır yazılmaz.
- Yeni bağımlılık **yok** (tarayıcı yerleşik API'si).

---

## ADR-0011 — Grafik / Veri Görselleştirme Kütüphanesi: Recharts

- **Tarih:** 2026-07-31
- **Durum:** ✅ Kabul edildi
- **Sahibi:** `002-interview` (rapor ekranı) + `005-admin` (istatistikler)
- **Karar verenler:** Ekip

### Bağlam

`docs/TECH_STACK.md` "Data Visualization" satırı `_TBD_` idi. Grafik iki yerde gerekiyor:

| Nerede | Ne | Dilim |
|--------|----|-------|
| Değerlendirme raporu ekranı | Teknik/Davranışsal/Genel 3 eksen — **radar** veya bar chart (`APP_FLOW.md` §6) | `002-interview` |
| Admin istatistik ekranı | Meslek bazlı bar chart, tamamlanma oranı pie chart, token zaman serisi (`APP_FLOW.md` §2) | `005-admin` |

> **Sıra notu:** Bu karar ilk olarak **interview** diliminde gerekiyor, admin'de değil —
> rapor ekranı `002-interview` Faz 5 kapsamında ve o fazı **bloklar**.

**Kilitli olan bağlam:** ADR-0001 frontend yığınını **React 19 + Vite + Tailwind CSS 4 +
shadcn/ui** olarak kilitledi. Anayasa "Teknoloji ve Kısıtlar" bölümü bu yığını değiştirilemez
sayar. Dolayısıyla grafik kararı boş bir sayfada değil, **shadcn/ui'ın zaten var olduğu** bir
zeminde alınıyor.

**Veri ölçeği:** Rapor ekranı 3 veri noktalı tek bir radar/bar chart gösterir. Admin ekranı
staj/vaka ölçeğinde (onlarca–yüzlerce görüşme) toplu sayılar ve bir zaman serisi gösterir.
Hiçbir ekranda binlerce noktalı grafik yoktur.

### Karar

Grafik kütüphanesi olarak **Recharts** seçildi (shadcn/ui Charts'ın kullandığı sürüm hattı —
şu an **v3**). Grafikler doğrudan Recharts ile değil, **shadcn/ui'ın `Chart` bileşenleri**
(`ChartContainer`, `ChartTooltip`, `ChartConfig`) üzerinden kurulur.

Radar chart (`RadarChart`) rapor ekranının 3 eksenli görselleştirmesi için, `BarChart` /
`PieChart` / `LineChart` admin istatistikleri için kullanılır.

### Değerlendirilen Alternatifler

| Kriter | A) Recharts (SEÇİLEN) | B) visx | C) Chart.js (react-chartjs-2) |
|--------|------------------------|---------|-------------------------------|
| **shadcn/ui uyumu** | **Yerleşik** — shadcn Charts Recharts v3 üzerine kurulu, hazır bileşen seti var | Yok — sıfırdan tema/stil yazılır | Yok — ayrı bir stil/tema sistemi |
| **Radar chart** (rapor ekranı için **şart**) | **Yerleşik** (`RadarChart`) ve shadcn'de hazır varyantı var | Primitiflerden **elle** kurulur | Var (`radar` tipi) |
| **React 19 uyumu** | Destekli (React 16–19); shadcn Charts v3 hattını kullanıyor | Destekli | `react-chartjs-2` sarmalayıcısı üzerinden |
| **API biçimi** | Deklaratif React bileşenleri; D3 bilgisi gerekmez | Düşük seviye D3 primitifleri — en yüksek esneklik, en yüksek maliyet | Imperatif Canvas API'si + React sarmalayıcı |
| **Render** | SVG — SSR/hidrasyon sorunsuz | SVG | Canvas — **client-only**, dinamik import gerekir |
| **Bundle** | Orta (tam kütüphane) | En küçük (~15KB, modüler) | Orta |
| **Büyük veri performansı** | Bu ölçek için fazlasıyla yeterli | Yeterli | En iyi (1M nokta) — **bu projede gereksiz** |
| **Erişilebilirlik** | `accessibilityLayer` ile klavye + ekran okuyucu desteği | Elle kurulur | Sınırlı (Canvas — DOM'da veri yok) |
| **Mühendislik zamanı** | En düşük (hazır bileşenler) | **En yüksek** | Orta |

### Gerekçe (Belirleyici Eksen: Zaten Kilitli Olan Yığınla Uyum)

Bu kararda ayırt edici eksen performans veya bundle boyutu **değil** — ikisi de bu ölçekte
bağlayıcı değil. Belirleyici olan, **shadcn/ui'ın anayasa ile kilitli olması**:
shadcn/ui'ın chart bileşenleri Recharts üzerine kuruludur. Başka bir kütüphane seçmek,
projede zaten bulunan hazır ve tema-uyumlu grafik bileşenlerini **kullanılamaz** hale getirir
ve ikinci bir görsel dil (renk/tipografi/tooltip stili) getirir. Bu, gerekçesiz karmaşıklıktır
(Anayasa — karmaşıklık kapısı).

İkinci eksen **radar chart**: `APP_FLOW.md` §6 rapor ekranını "3 eksenli radar veya bar chart"
olarak tanımlıyor. Recharts'ta radar yerleşiktir; visx'te primitiflerden elle kurulması
gerekirdi — kısıtlı staj süresinde gerekçesiz mühendislik zamanı.

Üçüncü olarak shadcn Charts **Recharts'ı sarmalamaz** (wrapper değildir); bileşenler doğrudan
Recharts üzerinde çalışır. Bu, ileride Recharts sürüm yükseltmesinin resmî yolunu izlemeyi
mümkün kılar — soyutlama arkasına kilitlenme yoktur.

### Neden Diğerleri Değil?

- **visx:** En küçük bundle ve en yüksek esneklik. Ancak düşük seviye primitif koleksiyonudur;
  radar chart, eksen, tooltip ve tema **elle** kurulur. Bu projede özelleştirilmiş bir görsel
  dil ihtiyacı yok — aksine shadcn/ui'ın hazır dili kullanılacak. Reddedildi: kazanç yok,
  maliyet yüksek.
- **Chart.js (react-chartjs-2):** Canvas render ile en iyi büyük veri performansını verir
  (1M nokta). Bizim en büyük grafiğimiz onlarca veri noktası — bu avantaj **karşılıksız**.
  Bedeli somut: client-only dinamik import zorunluluğu, imperatif API, shadcn tema uyumsuzluğu
  ve Canvas'ta DOM olmadığı için zayıf erişilebilirlik. Reddedildi.

### Kararın Yanlış Olacağı Durum

1. **Veri ölçeği beklenmedik şekilde büyürse** (ör. admin ekranında on binlerce noktalı canlı
   zaman serisi) — SVG render darboğaz olur ve Canvas tabanlı bir çözüm (Chart.js / ECharts)
   yeniden değerlendirilmelidir.
2. **shadcn/ui chart bileşenleri Recharts'tan başka bir tabana geçerse** — bu kararın
   belirleyici ekseni ortadan kalkar; o durumda shadcn'in yeni tabanı izlenir.

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | **React 19 peer dependency uyarısı** — ekosistemde bazı sürümlerde görüldü. | shadcn Charts'ın kullandığı Recharts **v3** hattı kurulur; kurulum `npx shadcn add chart` ile yapılır, sürüm elle pinlenmez. Uyarı çıkarsa `--legacy-peer-deps` ile **zorlamak yerine** peer aralığı doğrulanır (ADR-0005'teki Prisma sürüm kilidi yaklaşımıyla aynı disiplin). |
| R2 | **Erişilebilirlik varsayılan olarak kapalı** — grafik yalnızca görsel kalır. | Rapor ve admin grafiklerinde `accessibilityLayer` **açılır**; ayrıca skorlar grafiğin yanında **metin olarak da** gösterilir (Anayasa İlke VII — belirsizliği/veriyi gizlememe). Grafik tek bilgi kaynağı olmaz. |
| R3 | **Renk seçimi erişilebilir olmayabilir** (renk körlüğü). | Grafik renkleri shadcn `ChartConfig` üzerinden tema değişkenlerine bağlanır; kontrast ve renk-körlüğü güvenliği rapor UI görevinde (`002-interview` T078) doğrulanır. Seri ayrımı yalnızca renge bırakılmaz (etiket/desen de kullanılır). |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "Data Visualization" satırı **Recharts (shadcn/ui Charts üzerinden)**
  olarak güncellenir; `_TBD_` kalkar.
- **Kurulum:** `npx shadcn add chart` (Recharts'ı bağımlılık olarak getirir). Frontend'e
  eklenen tek grafik bağımlılığıdır; ikinci bir görselleştirme kütüphanesi **eklenmez**.
- `002-interview` **Faz 5 blokajı kalkar** — T078 (rapor ekranı radar/bar chart) artık
  uygulanabilir.
- `005-admin` dilimi aynı kütüphaneyi devralır; kendi kararını almaz.
- Grafik **tek başına bilgi taşımaz**: her grafiğin yanında metinsel değer bulunur (İlke VII).

**Kaynaklar (Temmuz 2026):**
[shadcn/ui — Chart bileşeni (Recharts v3)](https://ui.shadcn.com/docs/components/base/chart) ·
[shadcn/ui — Charts galerisi](https://ui.shadcn.com/charts/area) ·
[Recharts — RadarChart API](https://recharts.github.io/en-US/api/RadarChart/) ·
[Recharts — React 19 desteği (issue #4558)](https://github.com/recharts/recharts/issues/4558) ·
[Best React chart libraries in 2026 — LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2026/)

---

## Uygulama Notu — `005-admin` Admin Paneli (2026-08-04)

> ADR değil: kilitli teknoloji yığınında bir değişiklik yok (NestJS, Prisma, React 19,
> Tailwind, shadcn/ui, Recharts aynen devralındı; **yeni bağımlılık 0, yeni migration 0**).
> Aşağıdakiler, `/speckit-analyze` oturumunda tespit edilip implementasyon sırasında
> karara bağlanan **uygulama-yaklaşımı** kararlarıdır (Anayasa İlke VII — gerekçesiz
> kilitlenen karar yasak). Ayrıntı: `specs/005-admin/quickstart.md`.

| Karar | Seçim | Gerekçe |
|-------|-------|---------|
| `pageSize` üst sınırı | **1-100**, varsayılan 20 | `contracts/admin-api.md` §1 "1-100" derken `research.md` §5 "üst sınır 20" diyordu. Varsayılan zaten Clarifications Q4 ile 20'ye kilitliydi; çelişen tek nokta üst sınırdı ve sözleşme dosyası esas alındı (uç noktanın dış yüzeyini o tanımlar). |
| Tablo ve açılır liste bileşenleri | shadcn/ui **`Table` ve `Select` kuruldu** (`npx shadcn add table select`), renk sınıfları projenin token'larına yeniden hedeflendi | İkisi de projede kurulu değildi; ilk uygulamada native `<table>`/`<select>` kullanılmıştı, **kullanıcı kararıyla** (2026-08-04) shadcn'e geçildi — `plan.md` ikisini de öngörüyordu ve ileride sıralama/sütun gizleme (DataTable) yolunu açık tutar. **Yeni npm bağımlılığı yok**: `radix-ui`, `lucide-react`, `class-variance-authority` zaten kuruluydu. **Renk uyarlaması zorunluydu:** shadcn'in semantik renkleri (`bg-muted`, `text-foreground`, `border`) bir `@theme` katmanı gerektirir; bu proje renkleri doğrudan `--color-*` değişkenleriyle taşıyor ve böyle bir katmanı yok. Token katmanı eklemek `--color-accent` / `--color-border` adlarında **uygulama geneli çakışma** riski taşıdığından (shadcn'in `accent`'i "hover zemini", projeninki "marka rengi") bileşenler repoya kopyalanmış hâlleriyle düzenlendi — shadcn'in kendi kullanım modeli budur. Yapı, `data-slot`'lar ve API shadcn ile birebir. |
| Admin vurgu rengi | `--color-admin-accent: #0e7490` (+ `-strong`, `-soft`) | FR-015 "kullanıcı panelinden görsel olarak ayırt edilebilir" istiyordu, ancak tasarım sisteminde tek bir `--color-accent` vardı ve onu kullanıcı paneli kullanıyordu. `AdminShell` bu ağaçta `--color-accent`'i admin token'ına yeniden bağlar; böylece `Logo` dahil hiçbir alt bileşen değiştirilmeden admin temasına geçer. `docs/APP_FLOW.md` §5'teki "beyaz zemin + açık mavi vurgu" kararıyla uyumlu. |
| Salt-okunurluk yaptırımı | Yazma route'u **hiç tanımlanmadı** (403 döndüren bir handler yazılmadı) | FR-008/SC-005 için en güçlü garanti, reddedilen bir yolun değil, **var olmayan** bir yolun kendisidir. `/api/admin/*` altında POST/PATCH/PUT/DELETE router seviyesinde 404 alır. `docs/API_CONVENTIONS.md` §1'e bu netleştirme eklendi. |
| Günlük token serisi sorgusu | Pencere satırları çekilip **uygulama katmanında** günlük toplama | `research.md` §4 "Prisma `groupBy` + `DATE_TRUNC`" öneriyordu, ancak Prisma `groupBy` tarih kırpma desteklemiyor. `$queryRaw`'a gitmek erken optimizasyon olurdu (pencere en fazla 90 gün, hacim düşük); ölçek büyürse geçiş notu kodda `ponytail:` yorumu olarak duruyor. |
| İstatistik sorguları | Dördü tek `prisma.$transaction` içinde | Meslek sayıları / tamamlanma oranı / ortalama süre **aynı anlık görüntüden** gelmeli; aksi halde eşzamanlı yazma sırasında birbirini tutmayan rakamlar dönerdi (SC-006'nın asıl iddiası budur). |

---

## ADR-0012 — Oturum Çerezi Duruşu ve CSRF Savunması

- **Tarih:** 2026-08-06
- **Durum:** ✅ Kabul edildi
- **Sahibi:** `docs/SECURITY.md` S5 (issue #64, Faz 2)
- **Karar verenler:** Ekip

### Bağlam

Uygulamada iki ayrı HTTP yüzeyi var ve ikisi de **aynı oturum çerezini** kullanıyor:

| Yüzey | Kim yazdı | CSRF koruması (karar öncesi) |
|-------|-----------|------------------------------|
| `/api/auth/*` | Better Auth (catch-all mount) | `trustedOrigins` ile origin kontrolü — **var** |
| `/api/interviews`, `/api/pre-assessments`, `/api/users/me`, `/api/admin/*` | Bu proje (NestJS controller'ları) | **Yok** |

İkinci gruptaki uçlar karar anında sömürülebilir **değildi**: Better Auth'un varsayılan
`sameSite=lax` çerezi tarayıcılar tarafından siteler arası POST/DELETE isteklerinde
gönderilmez ve CORS tek origine kapalıdır. Sorun korumanın yokluğu değil, **dayanağının
yokluğuydu** — çerez özniteliği hiçbir yerde açıkça yapılandırılmamıştı, kararın kaydı
yoktu ve bu değerin neyi taşıdığı kodda görünmüyordu.

Bu, deployment topolojisi kararıyla doğrudan çarpışıyor. Frontend ayrı bir alan adına
alınırsa (Vercel + Render gibi) çerezin siteler arası gidebilmesi için `sameSite='none'`
zorunlu olur — ve o değişikliği yapan kişi, aynı hamleyle yukarıdaki dört uç noktayı
CSRF'e açtığını fark ettirecek hiçbir işaretle karşılaşmaz.

`docs/TECH_STACK.md`'nin DevOps/Deployment satırı hâlâ `_TBD_`; yani karar, topoloji
belirlenmeden verilmek zorundaydı.

### Karar

İki katmanlı, **topolojiden bağımsız** savunma:

1. **Çerez duruşu açıkça yapılandırılır.** `advanced.defaultCookieAttributes` ile
   `httpOnly`, `sameSite` ve `secure` verilir. `sameSite` değeri `COOKIE_SAMESITE`
   ortam değişkeninden gelir (varsayılan `lax`); `secure`, `sameSite='none'` iken
   otomatik zorunludur, aksi hâlde `NODE_ENV === 'production'` ölçütüne bağlıdır.
2. **`OriginGuard`** (global `APP_GUARD`) state değiştiren her istekte
   (`POST`/`PUT`/`PATCH`/`DELETE`) `Origin` başlığını izin verilen kümeyle karşılaştırır.

Böylece topoloji kararı ertelenebilir hâle gelir: hangi seçenek seçilirse seçilsin
savunma yerindedir ve geçiş **tek bir ortam değişkeni** değişikliğidir.

### Değerlendirilen Alternatifler

| Seçenek | Güvenlik | Karmaşıklık | Topoloji bağımlılığı | Bakım |
|---------|----------|-------------|----------------------|-------|
| **A. Açık çerez + `OriginGuard`** (seçilen) | İki bağımsız katman; biri gevşetilse diğeri ayakta | Bir guard, ~50 satır | **Yok** | Guard tek yerde, tüm uçlara otomatik |
| B. Yalnızca `sameSite=lax`'ta ısrar | Tek katman, örtük | Sıfır | Tek-origin'e **kilitler** | Değeri değiştiren kişi sessizce korumayı kaldırır |
| C. CSRF token (çift gönderim çerezi) | Güçlü | Frontend'de token yönetimi, her isteğe başlık, Better Auth akışlarıyla ayrı ele alma | Yok | Her yeni uç noktada hatırlanması gereken adım |
| D. Karar topoloji belirlenene kadar ertelensin | Boşluk açık kalır | Sıfır | Tam bağımlı | Deploy anında acele karar riski |

### Gerekçe

**Belirleyici eksen: korumanın deployment kararından bağımsız olması.** B seçeneği bugün
çalışıyor ama yarınki bir altyapı kararının yan etkisiyle sessizce ortadan kalkabilir —
bu tam olarak bulgunun kendisiydi, dolayısıyla onu çözüm diye seçmek anlamsız.
C daha güçlü ama bedeli her yeni uç noktada tekrar eden bir disiplin; `OriginGuard`
global olduğu için yeni uç nokta yazan kişinin hiçbir şey hatırlamasına gerek yok.

`Origin` başlığı bu iş için yeterlidir: tarayıcılar siteler arası state değiştiren her
istekte (fetch **ve** form gönderimi) `Origin` gönderir, ve saldırgan bir sayfa bu başlığı
değiştiremez.

### Neden diğerleri değil

- **B** — korunmanın örtük kalması bulgunun ta kendisiydi.
- **C** — bu ölçekte fazladan karmaşıklık; A zaten aynı sınıf saldırıyı kapatıyor.
  Gerekirse A'nın üstüne sonradan eklenebilir, A onu engellemiyor.
- **D** — bilinen bir boşluğu, ilgisiz bir kararın takvimine bağlamak.

---

## ADR-0013 — Adaptif Uyarlamaya Ön Değerlendirme Bağlamının Genişletilmesi

- **Tarih:** 2026-08-12
- **Durum:** ✅ Kabul edildi
- **Sahibi:** `002-interview` (FR-010, FR-011, FR-030); karşılıklı sözleşme `003-pre-assessment` FR-016
- **Karar verenler:** Kullanıcı talebi + ekip

### Bağlam

`FR-030` (2026-08-04'te MVP'ye yükseltildi), kullanıcının aktif ve tamamlanmış bir
ön değerlendirme (`003-pre-assessment`) kaydı varsa CompetencyReport içeriğinin
yalnızca **baseline soru üretimi** (`question_generation`) prompt'una izole bir
veri bloğu olarak verilmesini öngörüyordu. Aynı oturumda (2026-08-04) alınan ayrı
bir kararda, adaptif uyarlama çağrısının (`adaptive_evaluation`) iş ilanının
tamamını tekrar ALMAMASI — sorulan soru + cevap + taslak sonraki sorunun yeterli
olduğu — gerekçelendirilmişti; bu nedenle adaptif katman o zamana kadar
ön değerlendirme bağlamını da almıyordu.

Kullanıcı, özellikle "deneyimim yok" cevabı verildiğinde sıradaki sorunun hangi
temel/alternatif konuya kayacağına karar verirken adayın ön değerlendirmede beyan
ettiği güçlü/gelişim alanlarının ve çalışma tarzının da dikkate alınmasını istedi.

### Karar

Ön değerlendirme bağlamı **adaptif uyarlama adımına da** eklenir:

- `InterviewService` içindeki sorgu tekilleştirildi: `getActivePreAssessmentContextBlock(userId)`
  artık hem `create()` (baseline) hem `adaptNextQuestion()` (adaptif) tarafından
  çağrılan **tek bir kaynak**.
- Aynı izolasyon disiplini korunur: içerik `<ON_DEGERLENDIRME_BAGLAMI>` etiketli
  ayrı bir VERİ bloğu olarak `userData`'ya eklenir; sistem talimatına yalnızca
  `hasPreAssessmentContext` (var/yok) bilgisi girer, gerçek içerik ASLA (Anayasa
  İlke V — job posting izolasyonuyla aynı disiplin, `adaptive.ts`↔`question-generation.ts`
  arasında `ON_DEGERLENDIRME_ETIKET` sabiti paylaşılarak tek doğruluk kaynağı korunur).
- **2026-08-04 kararıyla çelişmez:** adaptif çağrı hâlâ iş ilanının tamamını
  ALMAZ; yalnızca ek, opsiyonel ve küçük bir veri bloğu (rapor özeti + öz-değerlendirme
  + yetenek etiketleri) eklenir — iş ilanı boyutunda bir veri değildir.
- **Zorunlu bağımlılık DEĞİLDİR:** kayıt yoksa (`hasPreAssessmentContext=false`)
  adaptif akış önceki davranışıyla bire bir aynı çalışır.
- Aday CEVABI ve taslak soru her zaman ÖNCELİKLİDİR; ön değerlendirme bağlamı
  yalnızca tamamlayıcı bir sinyal olarak kullanılabilir (özellikle "deneyimim
  yok" durumunda hangi temel konuya geçileceği kararında).

### Değerlendirilen Alternatifler

| Seçenek | Doğruluk/Faydalılık | Karmaşıklık | Tutarlılık (baseline ile) | Maliyet |
|---------|---------------------|-------------|---------------------------|---------|
| **A. Aynı kaynağı adaptif prompt'a da ekle** (seçilen) | Adaptif karar da adayın beyan ettiği güçlü/gelişim alanlarından yararlanabilir | Düşük — sorgu tekilleştirildi, tek yeni parametre zinciri | Baseline ile AYNI disiplin (izolasyon, var/yok kuralı) | Ekstra DB sorgusu yalnızca `adaptiveEnabled` görüşmelerde, cevap başına 1 kez |
| B. Yalnızca baseline'da bırak (mevcut durum) | Adaptif katman ön değerlendirmeyi hiç görmez | Sıfır | N/A | Sıfır |
| C. Bağlamı Interview kaydına snapshot olarak yaz, adaptif oradan okusun | Kayıt anındaki bağlamı sabitler (kullanıcı sonradan yeniden değerlendirse de değişmez) | Orta — şema migrasyonu gerekir | Baseline ile aynı ama snapshot/canlı farkı | Migrasyon + ekstra sütun |

### Gerekçe

A seçildi çünkü mevcut `create()` sorgusuyla birebir aynı kaynağı, aynı izolasyon
disipliniyle yeniden kullanıyor — yeni bir güven sınırı veya yeni bir prompt-injection
yüzeyi açmıyor. Sorgu tekilleştirmesi (`getActivePreAssessmentContextBlock`) kod
tekrarını da ortadan kaldırdı.

### Neden diğerleri değil

- **B** — kullanıcının açık talebini karşılamıyor; "deneyimim yok" durumunda
  adaptif katmanın elinde ön değerlendirmedeki sinyalleri kullanma imkânı olmazdı.
- **C** — snapshot almak, kullanıcı ön değerlendirmeyi görüşme sırasında yeniden
  değerlendirirse (`003-pre-assessment` FR-009a) hangi versiyonun geçerli olacağı
  sorusunu gündeme getirir; canlı sorgu bunu basitçe önler ve mevcut FR-030
  davranışıyla (her zaman aktif kaydı okur) tutarlıdır. Migrasyon maliyeti de
  gerekçesiz.

### Etkilenen Dosyalar

- `backend/src/interview/interview.service.ts` — `getActivePreAssessmentContextBlock` ortak yardımcı; `adaptNextQuestion()` içinde kullanımı.
- `backend/src/interview/llm/adaptive.ts` — `hasPreAssessmentContext` bayrağı + prompt satırı.
- `backend/src/interview/llm/question-generation.ts` — `ON_DEGERLENDIRME_ETIKET` sabiti dışa açıldı (tek doğruluk kaynağı).
- `backend/test/unit/prompt-isolation.spec.ts` — izolasyon testleri genişletildi.
- `specs/002-interview/spec.md` — FR-030 notu + Oturum 2026-08-12 kaydı.

### Kararın yanlış olacağı durum

- Tarayıcı olmayan mesru istemcilerin (mobil uygulama, resmî CLI) **yanında** tarayıcı
  istemcisi de olur ve `Origin` yokluğunda geçme kuralı fiilen bypass'a dönüşürse —
  o noktada C seçeneğine (token) geçmek gerekir.
- Birden fazla güvenilen frontend origin'i (çoklu alan adı, önizleme dağıtımları) çıkarsa
  izin listesi yapılandırmaya taşınmalıdır; şu anki hâli iki sabit değer + tünel dalıdır.

### Riskler ve Azaltma

| Risk | Azaltma |
|------|---------|
| `Origin` başlığı yoksa istek geçer | Bilinçli: tarayıcı dışı istemcilerde CSRF kavramı yoktur, başlığı zorunlu kılmak tarayıcı saldırısını engellemez yalnızca mesru istemcileri kırardı. Tarayıcı saldırısı her zaman `Origin` taşır. |
| `sameSite='none'` yanlışlıkla `secure` olmadan verilir | Kod `sameSite='none'` iken `secure`'ü **zorunlu** kılar; aksi hâlde tarayıcı çerezi sessizce düşürür ve oturum hiç kurulmazdı. |
| Tünel akışı (`ALLOW_TUNNEL_HOSTS`) origin kontrolüne takılır | Guard, bayrak **açıkken** `*.trycloudflare.com` origin'lerini kabul eder; bayrak kapalıyken (üretim varsayılanı) bu dal hiç çalışmaz. |
| Test koşucusu `Origin` göndermez | supertest başlığı göndermez; "başlık yoksa geç" kuralı mevcut 98 entegrasyon paketini olduğu gibi bırakır. |

### Sonuçlar / Etkiler

- `backend/src/auth/better-auth.config.ts` — `advanced.defaultCookieAttributes`
- `backend/src/common/guards/origin.guard.ts` — yeni
- `backend/src/app.module.ts` — `OriginGuard` global `APP_GUARD` olarak
- `backend/src/config/env.validation.ts`, `.env.example` — `COOKIE_SAMESITE`
- `backend/test/integration/security.spec.ts` — S5 regresyon testleri
- Deployment topolojisi seçildiğinde değişecek **tek** şey `COOKIE_SAMESITE` değeridir.


---

## ADR-0014 — Sözlü Mod STT: Groq Whisper

- **Tarih:** 2026-08-24
- **Durum:** ✅ Kabul edildi
- **Sahibi:** brainstorming diyaloğu (bkz. `docs/superpowers/specs/2026-08-24-stt-whisper-design.md`)

### Bağlam

ADR-0010, sözlü modun STT ve TTS ikisini de tarayıcı Web Speech API ile
çözdüğüne karar vermişti; kayıtlı risk R2 "Türkçe transkript hataları"ydı,
mitigasyonu "kullanıcı gönderim öncesi metni görüp düzeltebilir"di. Bu ADR o
riski mitigasyonla değil kaynağında çözüyor: **yalnızca STT** tarafı
tarayıcıdan alınıp Groq Whisper'a taşınıyor. **TTS aynen kalıyor.**

### Karar

**Sözlü modun STT kısmı Groq Whisper (`whisper-large-v3-turbo`) ile
uygulanır.** İstemci `MediaRecorder`+`getUserMedia` ile ses kaydeder, ses
seviyesi analiziyle (`AnalyserNode`) otomatik durur, kayıt backend'e
yüklenir (`POST /api/interviews/:id/transcribe`), backend Groq'a iletir ve
dönen metni geri verir. Whisper TOPLU çalışır — canlı/akan transkript YOK,
kullanıcı yalnızca kayıt sırasında ses seviyesi göstergesi görür, metin
kayıt bitince gelir. TTS (`SpeechSynthesis`) DEĞİŞMEDİ.

### Değerlendirilen Alternatifler

| Eksen | A) Groq Whisper (SEÇİLEN) | B) Tarayıcı STT (mevcut, ADR-0010) | C) Whisper başarısızsa tarayıcıya otomatik düş |
|-------|---------------------------|--------------------------------------|--------------------------------------------------|
| **Türkçe kalitesi** | Yüksek (motivasyon) | Tarayıcıya göre değişken | Yüksek (çoğu durumda) |
| **Maliyet** | Groq ücretsiz katman (ADR-0007 ile aynı desen) | Sıfır | Sıfır + ücretsiz katman |
| **Karmaşıklık** | Orta — yeni backend ucu + kota, `MediaRecorder` tabanlı kayıt | Yok | Yüksek — iki motor da kodda tutulur |
| **Tarayıcı bağımlılığı** | Düşük (`MediaRecorder`/`getUserMedia` Firefox/Safari'de de var) | Yüksek (`SpeechRecognition` yok) | Düşük |
| **Kota riski** | Var (Groq ücretsiz katman); ayrı `stt` kovası ilk savunma katmanı | Yok | Var, iki kat karmaşıklıkla |

### Gerekçe (Belirleyici Eksen: Türkçe Kalitesi)

ADR-0010'un R2 riski gerçek: transkript hatası doğrudan LLM girdisine gider
ve rapor kalitesini bozar. Kullanıcı düzeltebilse de bu bir MİTİGASYONDUR,
kaynağı çözmez. Groq zaten ADR-0007'nin LLM sağlayıcısı — aynı ekosistemde
ikinci bir entegrasyon (ayrı hesap/fatura yok), ücretsiz katmanı var.

C) (otomatik motor değişimi) reddedildi: iki motoru aynı anda kodda tutmak
karmaşıklığı ikiye katlıyor, kazancı marjinal.

### Riskler ve Azaltma

| # | Risk | Azaltma |
|---|------|---------|
| R1 | Groq Whisper ücretsiz katman kota tavanı (ADR-0007 TPM riskiyle aynı desen) | Kullanıcı başına `stt` kovası (30/saat) ilk savunma katmanı; sağlayıcı 429 dönerse kullanıcı yazılıya düşer |
| R2 | Mikrofon izni / `MediaRecorder` desteği yok | `voiceSupport()` kontrolü — desteklenmiyorsa sözlü mod UI'da devre dışı (FR-025, sessiz başarısızlık yok) |
| R3 | `GROQ_API_KEY` yapılandırılmamış | Sağlayıcı hatasıyla AYNI yoldan geçer (bilinçli, ayrı bir durum eklenmedi) |

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → "Voice / Speech" satırı güncellendi.
- Yeni env: `GROQ_API_KEY` (opsiyonel).
- Sesli akış için artık bir maliyet/kota YÜZEYİ var (LLM'den bağımsız);
  kalıcı maliyet KAYDI yok (bilinçli, spec kapsamı dışı — istenirse ayrı iş).
- Sunucu tarafı `POST /api/interviews/:id/answers` sözleşmesi DEĞİŞMEDİ —
  transkript istemcide `content` alanına yazılıp normal cevap gibi gönderilir.

