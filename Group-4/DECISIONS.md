# DECISIONS.md — Çözüm Mimarisi ve Alınan Kararlar

> Bu doküman, **AI Destekli Deneme Mülakatı** projesinin üst seviye tasarımını, mantıksal
> ve fiziksel diyagramlarını ve proje boyunca aldığımız kararları gerekçeleriyle bir arada
> anlatır. Amacımız "hangi teknolojiyi seçtik" listesinden çok, **neden onu seçtik ve neyi
> göze aldık** sorusunun cevabını bırakmak.
>
> **İlgili dokümanlar:**
> - [`docs/DECISIONS.md`](docs/DECISIONS.md) — kararların uzun hâli (ADR-0001…ADR-0013), her biri
>   alternatifler / riskler / "bu karar ne zaman yanlış olur" bölümleriyle. Bu dosya onun özeti
>   ve mimari çerçevesidir; **çelişki olursa `docs/DECISIONS.md` esastır.**
> - [`docs/TECH_STACK.md`](docs/TECH_STACK.md) — kilitlenen teknolojiler ve sürümleri
> - [`docs/APP_FLOW.md`](docs/APP_FLOW.md) — ekran ekran kullanıcı akışları
> - [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) — dosya/klasör haritası
> - [`docs/SECURITY.md`](docs/SECURITY.md) — güvenlik bulguları ve iyileştirme planı

---

## 1. Üst Seviye Tasarım

### 1.1 Ürün ne yapıyor?

Kullanıcı bir iş ilanı (metin ya da PDF) veriyor, sistem o ilana göre **yapay zekâ ile mülakat
soruları üretiyor**, kullanıcı yazılı veya sesli olarak cevaplıyor ve sonunda **teknik /
davranışsal / genel** eksenlerinde puanlı bir değerlendirme raporu çıkıyor. Yanında iki şey daha
var: mülakattan bağımsız çalışan bir **ön değerlendirme** (adayı tanıyan, puansız yetkinlik
raporu) ve tüm kullanımı görebilen bir **admin paneli** (kimin kaç mülakat yaptığı, ne kadar
token harcandığı).

### 1.2 Mimarinin özeti

Sistem üç parçadan oluşuyor: **React tabanlı web arayüzü, NestJS ile yazılmış REST API ve
PostgreSQL veritabanı.** Mikroservis, mesaj kuyruğu veya ayrı bir yapay zekâ servisi
kullanmadık; bu sadeliği bilinçli olarak tercih ettik.

Gerekçe basit: bu bir staj vaka çalışması ve gerçek darboğazımız trafik değil, **süre**. Üç
kişilik bir ekibin sınırlı sürede bitirmesi gereken bir işte, dağıtık mimarinin getireceği
operasyon yükünün karşılığı yok.

**Sistemi ayakta tutan dört tasarım kuralı:**

| Kural | Ne demek | Neden |
|-------|----------|-------|
| **Dikey dilim** | Her özellik (auth, interview, pre-assessment, admin) kendi modülünde; controller + service + DTO + test aynı klasörde | Üç kişi aynı anda farklı dilimlerde çalışabildi, merge çakışması neredeyse hiç olmadı |
| **Sunucu tarafı yetki** | Tarayıcıdan gelen hiçbir "ben adminim" iddiasına güvenilmez; yetki her istekte guard zincirinde kontrol edilir | Frontend kontrolü sadece kullanıcı deneyimidir, güvenlik değildir |
| **LLM tek kapıdan** | Tüm yapay zekâ çağrıları `llm/` modülünden geçer; hiçbir dilim doğrudan sağlayıcıya bağlanmaz | Sağlayıcı değiştirmek tek dosyalık iş oldu (ve gerçekten değiştirdik — bkz. ADR-0006 → ADR-0007) |
| **Her çağrı ölçülür** | Her LLM çağrısında token ve tahmini maliyet `TokenUsage` tablosuna yazılır | Admin panelindeki maliyet raporu sonradan eklenen bir şey değil, en baştan verinin içinde |

### 1.3 Sistem bağlam diyagramı

Sistemin dış dünyayla ilişkisi — kim kullanıyor, hangi dış servislere bağlıyız:

```mermaid
flowchart TB
    User["👤 Kullanıcı<br/>(aday)"]
    Admin["👤 Admin<br/>(seed ile tanımlı)"]

    subgraph System["Mock Interview Sistemi"]
        FE["Web Arayüzü<br/>React SPA"]
        BE["API<br/>NestJS"]
        DB[("PostgreSQL")]
        FE -->|"HTTPS / JSON<br/>(oturum çerezi)"| BE
        BE --> DB
    end

    Groq["Groq<br/>(LLM — birincil, ücretsiz katman)"]
    DeepSeek["DeepSeek<br/>(LLM — yedek)"]
    Google["Google OAuth<br/>(giriş)"]
    Resend["Resend<br/>(doğrulama e-postası)"]
    Speech["Tarayıcı Web Speech API<br/>(sesli mod — istemcide çalışır)"]

    User --> FE
    Admin --> FE
    BE -->|"soru üretimi,<br/>adaptif uyarlama,<br/>rapor"| Groq
    BE -.->|"kota dolarsa"| DeepSeek
    BE --> Google
    BE --> Resend
    FE <-->|"ses ↔ metin"| Speech
```



### 1.4 Ana akış: bir mülakat baştan sona

```mermaid
sequenceDiagram
    participant U as Kullanıcı
    participant FE as React SPA
    participant BE as NestJS API
    participant LLM as Groq LLM
    participant DB as PostgreSQL

    U->>FE: İş ilanı (metin veya PDF) + soru sayısı + mod
    FE->>BE: POST /api/interviews
    BE->>BE: PDF ise metne çevir (unpdf)
    BE->>DB: Aktif ön değerlendirme var mı? (varsa bağlam olarak ekle)
    BE->>LLM: Soru üretimi (şema garantili JSON)
    LLM-->>BE: N adet soru
    BE->>DB: Interview + Question kayıtları
    BE->>DB: TokenUsage (token + tahmini maliyet)
    BE-->>FE: Görüşme başladı

    loop Her soru için
        U->>FE: Cevap (yazılı veya sesli→metin)
        FE->>BE: POST /api/interviews/:id/answers
        BE->>DB: Answer kaydı (değiştirilemez)
        opt Adaptif mod açıksa
            BE->>LLM: Cevaba göre sıradaki soruyu uyarla
            BE->>DB: Güncellenen soru + TokenUsage
        end
    end

    U->>FE: Görüşmeyi bitir
    FE->>BE: GET /api/interviews/:id/report
    BE->>LLM: Tüm soru-cevaplar → değerlendirme
    LLM-->>BE: Teknik / Davranışsal / Genel skorlar + geri bildirim
    BE->>DB: Report + TokenUsage
    BE-->>FE: Rapor (radar grafik + metin + PDF indirme)
```

**Buradaki üç tasarım kararı:**

- **Cevaplar değiştirilemez (immutable).** Bir cevap gönderildikten sonra düzenlenemiyor —
  raporun neye dayandığı belirsizleşmesin diye. Sesli modda kullanıcı, metne dökülen cevabı
  *göndermeden önce* düzeltebiliyor; yani kontrol kullanıcıda ama kayıt sonrası sabit.
- **Rapor ayrı bir çağrı.** Soru üretimi ve rapor iki farklı LLM çağrısı. Rapor çağrısı daha
  uzun (60 sn timeout, diğerleri 30 sn) çünkü tüm görüşmeyi okuyor.
- **İş ilanı metni prompt'ta "veri" olarak izole ediliyor**, talimat olarak değil. İlanın içine
  gizlenmiş bir komut ("önceki talimatları unut") sistem davranışını değiştiremesin diye
  (prompt injection savunması). Aynı disiplin ön değerlendirme bağlamı için de geçerli
  (ADR-0013).

---

## 2. Mantıksal Tasarım Diyagramı

Kodun mantıksal olarak nasıl bölündüğü — hangi parça neyi biliyor, kim kime bağlı:

```mermaid
flowchart TB
    subgraph Frontend["FRONTEND — React 19 + Vite + TypeScript"]
        direction TB
        Pages["Sayfalar<br/>login · dashboard · interview<br/>pre-assessment · admin · settings"]
        Comps["Bileşenler<br/>shadcn/ui + Tailwind<br/>Recharts grafikler"]
        Clients["API istemcileri<br/>interview-client · admin-client<br/>auth-client · pre-assessment-client"]
        Libs["Yardımcı katmanlar<br/>voice-client (Web Speech)<br/>report-pdf (jsPDF) · i18n · tema"]
        Pages --> Comps
        Pages --> Clients
        Pages --> Libs
    end

    subgraph Backend["BACKEND — NestJS"]
        direction TB

        subgraph Cross["Kesişen katman (her istek buradan geçer)"]
            Guards["Guard zinciri<br/>Throttle → Origin (CSRF)<br/>Session → Roles → Ownership"]
            Valid["Zod doğrulama + hata filtresi<br/>+ helmet güvenlik başlıkları"]
        end

        subgraph Slices["Dikey dilimler (özellik modülleri)"]
            Auth["auth/<br/>Better Auth köprüsü<br/>e-posta doğrulama · OAuth"]
            Users["users/<br/>profil · KVKK onayı<br/>hesap silme"]
            Interview["interview/<br/>soru üretimi · cevaplar<br/>adaptif · rapor"]
            PreAsm["pre-assessment/<br/>ön sorular<br/>yetkinlik raporu"]
            AdminM["admin/<br/>salt okunur liste<br/>+ istatistikler"]
        end

        subgraph Shared["Paylaşılan servisler"]
            LlmM["llm/<br/>LlmProvider arayüzü<br/>+ TokenUsage kaydı"]
            PdfM["pdf/<br/>unpdf ile metin çıkarma"]
            PrismaM["prisma/<br/>tek DB erişim noktası"]
        end

        Guards --> Valid --> Slices
        Interview --> LlmM
        PreAsm --> LlmM
        Interview --> PdfM
        Slices --> PrismaM
        LlmM --> PrismaM
    end

    DB[("PostgreSQL 16")]
    LLMApi["Groq / DeepSeek<br/>(OpenAI-uyumlu API)"]

    Clients -->|"REST /api/*<br/>httpOnly oturum çerezi"| Guards
    PrismaM --> DB
    LlmM --> LLMApi
```

### 2.1 Katmanların sorumlulukları

| Katman | Sorumluluk | Bilmediği şey |
|--------|-----------|---------------|
| **Frontend sayfaları** | Ekran, form, kullanıcı etkileşimi | Yetkinin nasıl kontrol edildiği (sadece UI'ı gizler, güvenliği sağlamaz) |
| **Guard zinciri** | Sırayla: hız sınırı → origin → oturum → rol → kaynak sahipliği | İş kuralları |
| **Dikey dilimler** | Kendi özelliklerinin iş kuralları | Diğer dilimlerin iç yapısı (birbirlerinin servisini doğrudan çağırmıyorlar) |
| **`llm/`** | Sağlayıcıya bağımsız çağrı + şema doğrulama + token kaydı | Hangi dilimin çağırdığı |
| **`prisma/`** | Tek veritabanı erişim noktası | İş kuralları |

### 2.2 Veri modeli (ana varlıklar)

```mermaid
erDiagram
    User ||--o{ Session : "oturumları"
    User ||--o{ Account : "OAuth bağlantıları"
    User ||--o{ Interview : "mülakatları"
    User ||--o{ PreAssessment : "ön değerlendirmeleri"
    User ||--o{ TokenUsage : "LLM harcaması"

    Interview ||--o{ Question : "soruları"
    Question ||--o| Answer : "cevabı"
    Interview ||--o| Report : "değerlendirme raporu"
    Interview ||--o{ TokenUsage : "çağrı kayıtları"

    PreAssessment ||--o| CompetencyReport : "yetkinlik raporu"

    User {
        string id PK
        string email
        string role "user veya admin"
        bool emailVerified
        datetime deletedAt "soft-delete"
    }
    Interview {
        string id PK
        string profession
        enum mode "written veya voice"
        enum status "in_progress, completed, abandoned"
        datetime deletedAt "soft-delete"
    }
    Question {
        int order
        enum type "multiple_choice veya open_ended"
        string text
    }
    Answer {
        string text "gönderildikten sonra değişmez"
        enum sourceMode "written veya voice"
    }
    Report {
        int technicalScore
        int behavioralScore
        int overallScore
        string feedback
    }
    TokenUsage {
        enum operation
        string provider "groq veya deepseek"
        string model
        int inputTokens
        int outputTokens
        decimal estimatedCostUsd
    }
```

**Veri modelindeki üç bilinçli karar:**

1. **Soft-delete.** Kullanıcı bir mülakatı sildiğinde satır gerçekten silinmiyor, `deletedAt`
   damgalanıyor. Kullanıcı onu bir daha görmüyor ama admin "Silindi" etiketiyle görebiliyor.
   Sebep: admin istatistiklerinin geçmişe dönük tutarlı kalması. Aksi hâlde kullanıcı geçmişini
   temizledikçe raporlardaki toplamlar değişirdi.
2. **`TokenUsage` ayrı bir tablo.** Maliyeti mülakat kaydının içine bir sütun olarak koymadık;
   her LLM çağrısı ayrı satır. Böylece "hangi işlem (soru üretimi mi rapor mu) ne kadar tüketti"
   sorusunu cevaplayabiliyoruz ve sağlayıcı değişse bile eski kayıtlar `provider`/`model`
   alanları sayesinde anlamlı kalıyor.
3. **Ön değerlendirme mülakattan bağımsız.** Aralarında zorunlu bir ilişki yok — ön değerlendirme
   yapmadan da mülakata girilebiliyor. Aktif bir kayıt varsa mülakat prompt'una **ek bağlam**
   olarak giriyor, yoksa akış hiç değişmiyor (ADR-0013).

---

## 3. Fiziksel Deployment Diyagramı

### 3.1 Şu anki durum: geliştirme ortamı



```mermaid
flowchart TB
    subgraph Dev["Geliştirici Makinesi (localhost)"]
        direction TB
        Browser["Tarayıcı<br/>Chrome / Edge<br/>(Web Speech API burada çalışır)"]
        Vite["Vite Dev Server<br/>:5173<br/>(HMR + /api proxy)"]
        Nest["NestJS<br/>node :3000"]
        subgraph Docker["Docker Desktop"]
            PG[("postgres:16-alpine<br/>:5432<br/>volume: postgres-data")]
        end
        Browser --> Vite
        Vite -->|"proxy /api/*"| Nest
        Browser -.->|"VITE_API_URL doluysa<br/>doğrudan"| Nest
        Nest --> PG
    end

    Tunnel["Cloudflare Quick Tunnel<br/>(npm run tunnel — demo paylaşımı)"]
    GroqApi["api.groq.com"]
    ResendApi["Resend API"]
    GoogleApi["Google OAuth"]

    Tunnel -.->|"geçici public URL"| Vite
    Nest --> GroqApi
    Nest --> ResendApi
    Nest --> GoogleApi
```


---

## 4. Çözüm Mimarisi: Yapılan Seçimler ve Gerekçeleri

Aşağıda projede aldığımız kararların özeti ve **belirleyici eksen** — yani seçimi asıl yapan
gerekçe. Her karar için tam analiz (değerlendirilen alternatifler, riskler, "bu karar ne zaman
yanlış olur" bölümleri) [`docs/DECISIONS.md`](docs/DECISIONS.md) içinde.

| # | Karar | Seçim | Belirleyici eksen |
|---|-------|-------|-------------------|
| ADR-0001 | Frontend framework | React 19 + Vite + TS + Tailwind + shadcn/ui | Ekosistem genişliği — grafik, chat UI, PDF için hazır ve olgun kütüphane bolluğu |
| ADR-0002 | Backend + veritabanı | NestJS + PostgreSQL 16 | Frontend ile **tek dil (TS)**; guard/DI yapısı rol ayrımına birebir oturuyor. Postgres: admin paneli ilişkisel sorgu ve agregasyon istiyor |
| ADR-0003 | Kimlik doğrulama | Better Auth (self-hosted) | **Veri sahipliği** — kullanıcı verisi kendi Postgres'imizde; admin istatistikleri ve soft-delete tek DB'den çalışıyor |
| ADR-0004 | Test araçları | Jest+Supertest / Vitest+RTL / Playwright | Her framework'ün kendi resmî aracı — sıfır adapter maliyeti |
| ADR-0005 | ORM sürüm kilidi | Prisma **6.19.3** (exact pin) | Prisma 7 yeni config modeli Better Auth adaptörüyle uyumsuz çıktı; rework riski |
| ADR-0006 | LLM sağlayıcı (ilk) | OpenAI | ⛔ **Değiştirildi** — bkz. ADR-0007 |
| ADR-0007 | LLM sağlayıcı | **Groq** (birincil) + DeepSeek (yedek) | **Maliyet sıfır olmalı** — eleyici kısıt. İkisi de OpenAI-uyumlu, tek SDK yetti |
| ADR-0008 | E-posta gönderimi | Resend | Ücretsiz katman, kredi kartı istemiyor, tek SDK çağrısı |
| ADR-0009 | PDF metin çıkarma | unpdf | `pdfjs-dist` ile aynı güncel motor, `pdf-parse` kadar sade API |
| ADR-0010 | Sesli mod | Tarayıcı **Web Speech API** | Maliyet sıfır + sunucu sözleşmesi hiç değişmiyor |
| ADR-0011 | Grafik kütüphanesi | Recharts (shadcn/ui Charts üzerinden) | shadcn/ui zaten kilitli ve chart bileşenleri Recharts üstüne kurulu |
| ADR-0012 | Çerez duruşu + CSRF | Açık yapılandırma + `OriginGuard` | Korumanın **deployment kararından bağımsız** olması |
| ADR-0013 | Adaptif uyarlama bağlamı | Ön değerlendirme bağlamı adaptif adıma da eklendi | "Deneyimim yok" cevabında sıradaki sorunun daha isabetli kayması |

**Kararlardan en çok şey öğrendiğimiz an**, LLM sağlayıcısını proje ortasında değiştirmek zorunda
kalmamız oldu (ADR-0006 → ADR-0007). Önce OpenAI'yi seçmiştik; sonra ekip "LLM maliyeti sıfır
olmalı" kısıtını netleştirince maliyet, "ayırt edici olmayan bir eksen"den **eleyici bir eksene**
dönüştü ve ücretli olan her seçenek elendi. Bu değişimin ucuz olmasının tek sebebi, sağlayıcıya
özgü kodu en baştan tek bir adapter dosyasında izole etmiş olmamızdı — ADR-0006'da "tek
sağlayıcıya bağımlılık" riski için yazdığımız azaltma, risk gerçekleştiğinde tuttu. Eski kararı
silmedik de: ADR-0006 dosyada "değiştirildi" etiketiyle duruyor, böylece bütçe kısıtı kalkarsa
hangi seçeneğin doğru olduğu zaten yazılı.
