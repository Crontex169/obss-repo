# Mock Interview — AI Destekli Deneme Mülakatı

Bu depo, Mock Interview projesinin case-study çalışmasıdır.

Proje **spec-driven** ve **test-driven** bir akışla geliştirilir; kod yazmadan
önce spesifikasyon ve görev listesi hazırlanır. Bu döküman yalnızca **kurulum
ve çalıştırma** talimatlarını içerir — mimari/karar detayları için aşağıdaki
[Dokümantasyon Referansları](#dokümantasyon-referansları) bölümüne bakın.

---

## İçindekiler

- [Proje Yapısı](#proje-yapısı)
- [Ön Koşullar](#ön-koşullar)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Çalıştırma](#çalıştırma)
- [Test Çalıştırma](#test-çalıştırma)
- [Lint & Format](#lint--format)
- [Prisma / Veritabanı Komutları](#prisma--veritabanı-komutları)
- [Proje Durumu](#proje-durumu)
- [Sorun Giderme](#sorun-giderme)
- [Dokümantasyon Referansları](#dokümantasyon-referansları)

---

## Proje Yapısı

```
Group-4/
├── backend/            NestJS API (Better Auth köprüsü /api/auth/*)
│   ├── prisma/         schema.prisma + migrations
│   ├── src/            auth, users, interview, pre-assessment, admin, llm, pdf, common
│   └── test/           unit + integration testler (Jest + Supertest)
├── frontend/            React 19 + Vite SPA
│   ├── src/pages/       sayfalar (login, dashboard, interview/*, pre-assessment/*, admin/*)
│   ├── src/components/  UI bileşenleri (shadcn/ui tabanlı)
│   └── test/            Vitest + RTL birim testleri, test/e2e/ Playwright
├── docs/                 TECH_STACK.md, DECISIONS.md (ADR'ler), APP_FLOW.md, PLAN.md,
│                         API_CONVENTIONS.md, METRICS.md (performans/bakım ölçümleri),
│                         PROJECT_MAP.md (kod haritası + durum)
├── specs/                Dikey dilimler: 001-auth-rol … 006-sifre-sifirlama
├── SETUP.md · AI-DEVLOG.md · DECISIONS.md   (kökte teslim edilen 3 dosya)
├── .specify/              Spec Kit (spec-driven workflow) yapılandırması + anayasa
├── docker-compose.yml     Local PostgreSQL 16
└── .env.example           Örnek ortam değişkenleri (gerçek .env değil!)
```

> Hangi dosyanın ne yaptığını, hangi ADR'nin neyi etkilediğini ve her dilimin
> durumunu tek yerden görmek için: [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md).

## Ön Koşullar

Aşağıdakiler makinenizde kurulu olmalı:

- **Node.js** 20 LTS veya 22+ (bkz. `specs/001-auth-rol/quickstart.md`; backend
  bağımlılıkları `node ^18.19.1 || ^20.11.1 || >=22.0.0` gerektirir)
- **npm** (Node ile birlikte gelir)
- **Docker Desktop** (local PostgreSQL için — Docker daemon çalışır durumda olmalı)
- **Git**

Google OAuth ile test edecekseniz ayrıca bir Google Cloud OAuth istemci
kimliği/sırrı gerekir (bkz. [Ortam Değişkenleri](#ortam-değişkenleri)); bu
olmadan e-posta/şifre akışları sorunsuz çalışır.

## Kurulum

### 1) Depoyu klonlayın

```bash
git clone https://github.com/OBSS-AI-Summer-Internship-2026/Group-4.git
cd Group-4
```

### 2) PostgreSQL'i başlatın (Docker)

Repo kökünden çalıştırın:

```bash
docker compose up -d
```

Bu, `postgres:16-alpine` imajıyla `auth-postgres` adlı bir container'ı
`localhost:5432` üzerinde, `mock_interview` veritabanıyla ayağa kaldırır
(bkz. `docker-compose.yml`). Verileri kalıcı tutan `postgres-data` adında bir
Docker volume oluşturulur.

Durdurmak için: `docker compose down` (veriyi de silmek isterseniz
`docker compose down -v`).

### 3) Ortam değişkenlerini ayarlayın

> **Önemli**: `.env` dosyası repo kökünde **değil**, `backend/` klasörünün
> içinde olmalıdır. NestJS backend'i `backend/` dizininden çalıştığı için
> ortam değişkenlerini oradan okur.

```bash
cp .env.example backend/.env
```

Ardından `backend/.env` içindeki değerleri doldurun. **`.env.example`'da boş
gelen ve doldurulmadan uygulamanın başlamayacağı alanlar:**

- `BETTER_AUTH_SECRET` — en az 32 karakter rastgele dize
- `LLM_API_KEY` — Groq API anahtarı ([console.groq.com](https://console.groq.com), ücretsiz katman)

`ADMIN_EMAIL` / `ADMIN_PASSWORD` değerlerini de kendinize göre değiştirin.
Diğer alanların `.env.example`'daki varsayılanları local kurulum için hazırdır.
Detaylar için [Ortam Değişkenleri](#ortam-değişkenleri) bölümüne bakın.
`backend/.env` git'e girmez (`.gitignore` içinde `.env*` kalıbı hariç tutulur)

### 4) Backend kurulumu

```bash
cd backend
npm install
npx prisma generate         # Prisma Client üretir
npx prisma migrate dev      # tum semayi uygular (auth + interview + pre-assessment + token usage)
npm run start:dev           # http://localhost:3000 üzerinde baslar
```

`start:dev` watch modunda çalışır; kod değiştikçe otomatik yeniden başlar.
Backend ayağa kalktığında `/api/auth/*` altında Better Auth uç noktaları
kullanılabilir olur (ör. `GET http://localhost:3000/api/auth/get-session`).

Ardından admin hesabını seed edin (idempotenttir, birden fazla kez
çalıştırılabilir — zaten varsa atlar):

```bash
npm run db:seed             # backend/.env'deki ADMIN_EMAIL/ADMIN_PASSWORD ile admin olusturur
```

Admin girişini `http://localhost:5173/admin/login` üzerinden test edebilirsiniz
(`backend/.env`'deki `ADMIN_EMAIL`/`ADMIN_PASSWORD` ile).

### 5) Frontend kurulumu

Backend ayaktayken, **ayrı bir terminalde**:

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173 üzerinde baslar
```

Frontend `.env` dosyasını oluşturun:

```bash
cp frontend/.env.example frontend/.env
```

| Değişken | Ne işe yarar |
|----------|--------------|
| `VITE_API_URL` | Backend adresi. **Dolu ise** istemciler o adrese **mutlak URL** ile gider (local varsayılan: `http://localhost:3000`). **Boş bırakılırsa** istekler göreli `/api/...` yoluna gider ve `vite.config.ts`'teki proxy devreye girer — tek origin gerektiren tünel/deploy senaryosu için. |
| `VITE_GOOGLE_CLIENT_ID` | Google One Tap girişi için. Kök `.env`'deki `GOOGLE_CLIENT_ID` ile **aynı** değer olmalıdır; client ID Google tarafında kamuya açık kabul edilir, tarayıcıya gitmesi sorun değildir. |

> **Vite proxy hakkında:** `vite.config.ts` `/api` için bir proxy **tanımlar**, ama
> local geliştirmede fiilen kullanılmaz — `VITE_API_URL` dolu geldiği için istemciler
> backend'e doğrudan bağlanır. Proxy, Cloudflare quick tunnel gibi tek-origin gereken
> durumlar için eklenmiştir (`changeOrigin: false`, çünkü backend `baseURL`'i isteğin
> `Host` başlığından çözüyor; aksi hâlde Google `redirect_uri` ve doğrulama maili
> linki yanlış host'a gider). Backend'in `Host`'tan çözme davranışı `ALLOW_TUNNEL_HOSTS`
> bayrağına bağlıdır ve **varsayılan olarak kapalıdır**; tünel kullanacaksanız
> `backend/.env` içinde `true` yapın.

## Ortam Değişkenleri

Tüm anahtarlar `.env.example`'da örneklenmiştir; `backend/.env` içine
kopyalayıp doldurun. Zorunlu olanlar backend başlangıcında `zod` ile
doğrulanır (`backend/src/config/env.validation.ts`) — eksik/hatalıysa uygulama
**başlamaz** ve hangi alanın sorunlu olduğunu konsola yazar.

| Değişken | Zorunlu mu | Açıklama |
|----------|:----------:|----------|
| `DATABASE_URL` | ✅ | PostgreSQL bağlantı dizesi. Local Docker için `.env.example`'daki değer `docker-compose.yml` ile birebir uyumludur, değiştirmenize gerek yok. |
| `BETTER_AUTH_SECRET` | ✅ | Oturum/imzalama sırrı, **en az 32 karakter**. Rastgele üretin, paylaşmayın. |
| `BETTER_AUTH_URL` | ✅ | Backend'in kendi adresi (local: `http://localhost:3000`). Geçerli bir URL olmalı. |
| `FRONTEND_URL` | ✅ | CORS ve OAuth yönlendirmeleri için frontend adresi (local: `http://localhost:5173`). Geçerli bir URL olmalı. |
| `ALLOW_TUNNEL_HOSTS` | opsiyonel (varsayılan `false`) | Cloudflare quick tunnel (`npm run tunnel`) ile çalışırken `true` yapın: `Host` `*.trycloudflare.com` ise `baseURL` istekten çözülür, rastgele tünel adresi için `.env` düzenlemek gerekmez. **Üretimde asla `true` olmamalıdır** — joker host, `Host` başlığı üzerinden şifre sıfırlama bağlantısının saldırganın alan adına yönlendirilmesine izin verir (bkz. [`docs/SECURITY.md`](docs/SECURITY.md) S1). |
| `ADMIN_EMAIL` | ✅ | Seed edilecek admin hesabının e-postası (FR-018). Geçerli bir e-posta formatı olmalı. `npm run db:seed` ile oluşturulur. |
| `ADMIN_PASSWORD` | ✅ | Seed admin şifresi, **en az 8 karakter**. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth (Hikâye 3). Backend başlangıçta bunları zorunlu kılar (boşsa hata verir). Gerçek bir Google Cloud OAuth istemcisi kaydedilene kadar `.env.example`'daki yer tutucu değerleri kullanabilirsiniz — tarayıcıda Google girişi çalışmaz ama uygulama açılır ve backend testleri (sahte imzalı id-token ile) bağımsız çalışır. **`GOOGLE_CLIENT_ID`, `frontend/.env`'deki `VITE_GOOGLE_CLIENT_ID` ile aynı olmalıdır** (Google One Tap). |
| `MAIL_TRANSPORT` | opsiyonel (varsayılan `console`) | `console` veya `resend` (ADR-0008). `console`: doğrulama bağlantısı backend konsoluna loglanır, mail hesabı gerekmez — geliştirme için yeterli. `resend`: gerçek e-posta gönderilir, `RESEND_API_KEY` zorunlu olur. |
| `RESEND_API_KEY` | `MAIL_TRANSPORT=resend` ise zorunlu | [resend.com](https://resend.com) API anahtarı (ücretsiz katman: 100 mail/gün, kredi kartı gerekmez). `console` modunda boş bırakılabilir. |
| `MAIL_FROM` | opsiyonel | Gönderen adresi. `.env.example` `onboarding@resend.dev` (Resend'in doğrulama gerektirmeyen test alan adı) verir; hiç tanımlanmazsa kod içi varsayılan `no-reply@example.com`'dur. |
| `LLM_PROVIDER` | opsiyonel (varsayılan `groq`) | `groq` veya `deepseek` (ADR-0007). İkisi de OpenAI-uyumlu API sunar, tek `openai` SDK kullanılır. |
| `LLM_BASE_URL` | ✅ | Sağlayıcı API kökü — Groq için `https://api.groq.com/openai/v1`. `.env.example`'da dolu gelir. |
| `LLM_API_KEY` | ✅ | **`.env.example`'da BOŞ gelir — doldurmadan backend başlamaz.** Groq anahtarını [console.groq.com](https://console.groq.com) üzerinden ücretsiz alabilirsiniz. |
| `LLM_MODEL` | ✅ | Seçilen model: `openai/gpt-oss-120b` (T001 spike kararı). Groq'ta `strict` şema yalnızca `gpt-oss-20b`/`120b`'de desteklenir — başka modele geçmeden önce `docs/API_CONVENTIONS.md` §3.3'ü okuyun. |
| `LLM_ALT_PROVIDER` / `LLM_ALT_BASE_URL` / `LLM_ALT_API_KEY` / `LLM_ALT_MODEL` | opsiyonel — **ya dördü birden ya hiçbiri** | Yedek sağlayıcı (ADR-0007 R1). Birincil cevap veremezse (kota, 5xx, ağ hatası, timeout) aynı çağrı **bir kez** burada tekrarlanır; operasyon ayrımı yoktur. Şema hatasında geçilmez (`docs/API_CONVENTIONS.md` §3.4). Boşsa yedek yol kapalıdır. Yarım bırakılırsa `env.validation.ts` başlangıçta hata verir (sessizce devre dışı kalması kafa karıştırırdı). |
| `LLM_REQUEST_TIMEOUT_MS` | opsiyonel (varsayılan `30000`) | LLM çağrı zaman aşımı. Görüşme raporu çağrısı kod içinde 60 sn ile override eder (SC-005). |
| `PDF_MAX_SIZE_MB` | opsiyonel (varsayılan `10`) | İş ilanı PDF yükleme üst sınırı (`002-interview` FR-002). |
| `PORT` | opsiyonel (varsayılan `3000`) | Backend dinleme portu. |
| `CAPTCHA_SITE_KEY` / `CAPTCHA_SECRET_KEY` | opsiyonel | Kullanılmıyor — gerçek bir CAPTCHA sağlayıcısı entegre edilmedi (kullanıcı kararı, bkz. `AI-DEVLOG.md`); throttling yalnızca sayaç + artan gecikme ile çalışır. `env.validation.ts` bunları doğrulamaz. |

> **Sözlü mod için ortam değişkeni gerekmez.** STT/TTS tarayıcının Web Speech
> API'siyle istemci tarafında çalışır (ADR-0010); sunucuda ses işleme ve
> sağlayıcı anahtarı yoktur.

**E-posta doğrulama bağlantısını nasıl bulurum?** Varsayılan
`MAIL_TRANSPORT=console` modunda kayıt sonrası doğrulama linki backend'in
çalıştığı terminale `[mail] E-posta dogrulama baglantisi (...): ...`
formatında loglanır — gerçek e-posta gönderilmez. Gerçek gönderim için
`MAIL_TRANSPORT=resend` + `RESEND_API_KEY` gerekir.

## Çalıştırma

Geliştirme için iki servis + veritabanı ayrı ayrı çalışmalı:

```bash
docker compose up -d          # 1) PostgreSQL (repo kökünde)
cd backend && npm run start:dev   # 2) API — http://localhost:3000
cd frontend && npm run dev        # 3) SPA — http://localhost:5173 (ayrı terminal)
```

Uygulamayı `http://localhost:5173` üzerinden tarayıcıda açın.

## Test Çalıştırma

### Backend (`backend/`)

Entegrasyon/e2e testleri **gerçek bir PostgreSQL'e** bağlanır (mock kullanılmaz)
— önce `docker compose up -d` ile veritabanının ayakta ve migration'ların
uygulanmış olduğundan emin olun.

```bash
cd backend
npm run test              # birim testler (src/**/*.spec.ts)
npm run test:e2e          # entegrasyon/e2e testler (test/**/*.spec.ts + *.e2e-spec.ts)
npm run test:cov          # kapsam raporu
```

Tek bir test dosyası çalıştırmak için:

```bash
npx jest <dosya-yolu> --config ./test/jest-e2e.json    # test/integration/*.spec.ts icin
npx jest <dosya-yolu>                                    # src/**/*.spec.ts (birim) icin
```

### Frontend (`frontend/`)

```bash
cd frontend
npm run test              # Vitest (birim/component)
npm run test:e2e          # Playwright — backend AYRICA calisiyor olmali (bkz. asagi)
```

**Not:** `playwright.config.ts`'in `webServer`'ı yalnızca frontend'i (`npm run dev`)
otomatik başlatır. `test:e2e`'den önce backend'in (`cd backend && npm run start:dev`)
ve Postgres'in (`docker compose up -d`) ayrı ayrı ayakta olması gerekir — aksi
halde testler backend'e bağlanamaz. E2e testleri ayrıca `backend/.env`'i doğrudan
okur (`ADMIN_EMAIL`/`ADMIN_PASSWORD`/`BETTER_AUTH_SECRET`) — admin girişi (S4)
için önce `npm run db:seed` çalıştırılmış olmalı.

## Lint & Format

```bash
cd backend && npm run lint     # ESLint --fix
cd frontend && npm run lint    # oxlint
```

## Prisma / Veritabanı Komutları

Hepsi `backend/` dizininden çalıştırılır:

```bash
npx prisma generate      # Prisma Client'i sema degisikliginden sonra yeniden uretir
npx prisma migrate dev   # yeni migration olusturur ve uygular (gelistirme)
npx prisma studio        # veritabanini tarayicida incelemek icin GUI acar
```

> **Prisma sürümü kilitli**: `backend/package.json` içinde `prisma` ve
> `@prisma/client` `6.19.3` olarak **exact pin**'lidir (`^` yok). `npm update`
> veya benzer bir komutla bunu Prisma 7'ye yükseltmeyin — Better Auth Prisma
> adaptörüyle uyumsuzluk yaşanır (bkz. ADR-0005). Sürüm değişikliği gerekiyorsa
> önce yeni bir ADR açın.

## Proje Durumu

Uygulama **altı dikey dilimin tamamıyla** çalışır durumdadır. İlerleme her
dilimin `tasks.md` dosyasındaki `[X]`/`[ ]` işaretlerinden okunur; dosya/karar
haritası ve ayrıntılı durum için [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md).

| Dilim | Kapsam | Durum |
|-------|--------|:-----:|
| `001-auth-rol` | Kayıt, e-posta doğrulama, giriş/çıkış, Google OAuth, guard zinciri, admin seed, KVKK onayı | ✅ 102/106 |
| `002-interview` | İş ilanı (metin/PDF) → LLM soru üretimi → sıralı cevap akışı → değerlendirme raporu; sözlü/yazılı mod, adaptif akış | ✅ 142/142 |
| `003-pre-assessment` | Meslek-bağımsız ön yetkinlik değerlendirmesi → skorsuz yetkinlik raporu | ✅ 66/99 |
| `004-history` | Geçmiş görüşmeler, devam ettirme, soft-delete, PDF dışa aktarım, skor trendi | ✅ 50/57 |
| `005-admin` | Admin paneli: görüşme listesi + filtre, detay, token/maliyet istatistikleri | ✅ 52/52 |
| `006-sifre-sifirlama` | Şifre sıfırlama: tek-kullanımlık süreli link, enumeration koruması, hız sınırı | ✅ 26/26 |

Açık kalan maddeler kasıtlıdır: `001` T068 (auth formlarının shadcn'e geçişi —
UI tasarımı bekleniyor), `001` T081/T081b (Better Auth `admin` plugin'i + ban
zorlaması — ayrı oturuma bırakıldı), `004`'te 7 madde (Playwright e2e senaryoları
ve süre ölçümü — gerçek tarayıcı/dev-server gerektirir). `003`'te açık görünen
33 satırın çoğu, meslek-bağımsızlık pivotunun (Faz 11/12) geride bıraktığı bayat
görev metinleridir — gerçek bir eksik değil.

**Bilinen sınırlamalar** (kasıtlı, ADR ile izlenen):
- Google ile giriş için gerçek bir Google Cloud OAuth istemcisi henüz
  kaydedilmedi — `.env`'deki `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  yer tutucu değerlerdir; gerçek değerlerle değiştirilmeden Google girişi
  tarayıcıda tamamlanmaz (backend testleri sahte imzalı id-token ile,
  e2e testler ise yalnızca OAuth kickoff'unu doğrular).
- Gerçek e-posta gönderimi varsayılan olarak **kapalı**: `MAIL_TRANSPORT=console`
  ile doğrulama bağlantısı yalnızca backend konsoluna loglanır. Sağlayıcı kararı
  alındı (ADR-0008 — **Resend**, kabul edildi) ve kod yolu hazır; üretimde
  `MAIL_TRANSPORT=resend` + `RESEND_API_KEY` ile etkinleşir.

## Sorun Giderme

**`Ortam degisken dogrulamasi basarisiz: ...` hatasıyla backend başlamıyor**
`backend/.env` dosyasının var olduğundan ve hata mesajında belirtilen alanın
(`ADMIN_EMAIL`, `BETTER_AUTH_SECRET` vb.) `.env.example`'daki kurallara uygun
doldurulduğundan emin olun (bkz. [Ortam Değişkenleri](#ortam-değişkenleri)).

**`prisma migrate dev` bağlantı hatası veriyor**
Docker Desktop'ın açık ve `docker compose up -d` ile `auth-postgres`
container'ının çalışır durumda olduğundan emin olun (`docker ps` ile
kontrol edin). `DATABASE_URL`'in `docker-compose.yml`'daki `POSTGRES_USER` /
`POSTGRES_PASSWORD` / `POSTGRES_DB` değerleriyle eşleştiğini doğrulayın.

**`npm run db:seed` "ADMIN_EMAIL ve ADMIN_PASSWORD ortam degiskenleri
zorunludur" hatası veriyor**
`backend/.env` dosyasının var olduğundan ve `ADMIN_EMAIL`/`ADMIN_PASSWORD`
alanlarının doldurulduğundan emin olun.

**Kayıt oldum ama doğrulama e-postası gelmiyor**
Varsayılan `MAIL_TRANSPORT=console` modundasınız (bilinçli tasarım — bkz.
[Ortam Değişkenleri](#ortam-değişkenleri)). Doğrulama linki backend'in
çalıştığı terminale loglanır; oradan kopyalayıp tarayıcıda açın. Gerçek mail
istiyorsanız `MAIL_TRANSPORT=resend` + `RESEND_API_KEY` ayarlayın.

**Port çakışması (`3000` veya `5432` kullanımda)**
Başka bir servis o portu kullanıyor olabilir. Backend için `backend/.env`'e
`PORT=<farklı-port>` ekleyip `BETTER_AUTH_URL`'i buna göre güncelleyin;
Postgres için `docker-compose.yml`'daki `ports` eşlemesini değiştirin (ve
`DATABASE_URL`'i buna göre güncelleyin).

**`npx prisma` sürümü otomatik güncellendi / şema hatası alıyorum**
`package-lock.json` ile `npm install` (sadece `npm install`, `npm update`
değil) kullandığınızdan emin olun; Prisma sürümü `package.json`'da kilitlidir
(bkz. yukarıdaki Prisma bölümü).

## Dokümantasyon Referansları

- `.specify/memory/constitution.md` — proje anayasası (test-öncelik, spec-öncelik, güvenlik ilkeleri; tüm çalışma biçimini bağlar)
- `docs/PROJECT_MAP.md` — **buradan başlayın**: kod haritası, hangi ADR neyi etkiliyor, dilim durumları
- `docs/TECH_STACK.md` — kilitli teknoloji tablosu
- `docs/DECISIONS.md` — ADR'ler (teknik kararlar + gerekçeler)
- `docs/API_CONVENTIONS.md` — dikeyler arası HTTP/veri sözleşmeleri (hata zarfı, LLM sözleşmesi, hız sınırları)
- `docs/METRICS.md` — performans ve bakım kolaylığı ölçümleri (bundle boyutu, coverage, lint, kod tekrarı) + her sayıyı yeniden üretecek komutlar
- `docs/APP_FLOW.md`, `docs/PLAN.md` — ürün akışı ve genel plan
- `specs/<dilim>/spec.md` — kullanıcı hikâyeleri + Gherkin kabul kriterleri
- `specs/<dilim>/plan.md`, `data-model.md`, `contracts/` — teknik tasarım
- `specs/<dilim>/tasks.md` — görev listesi ve ilerleme durumu
- `specs/<dilim>/quickstart.md` — uçtan uca manuel doğrulama senaryoları
- `AI-DEVLOG.md` — AI destekli geliştirme süreç kaydı
