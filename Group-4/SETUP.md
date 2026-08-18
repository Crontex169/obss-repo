# SETUP — Kurulum ve Çalıştırma

Projeyi sıfırdan ayağa kaldırmanın **en kısa yolu**. Ayrıntı, sorun giderme ve
ortam değişkenlerinin tam tablosu için kök dizindeki [`README.md`](../README.md)
esas alınır — bu dosya onun özetidir, çeliştiğinde `README.md` geçerlidir.

## Ön koşullar

- **Node.js** 20 LTS veya 22+
- **Docker Desktop** (çalışır durumda — local PostgreSQL için)
- **Git**

## 1. Veritabanı

Repo kökünden:

```bash
docker compose up -d
```

PostgreSQL 16 `localhost:5432` üzerinde `mock_interview` veritabanıyla açılır.

## 2. Ortam değişkenleri

> ⚠️ `.env` dosyası repo kökünde **değil**, `backend/` içinde olmalıdır — backend
> süreci o dizinden çalışır ve ortam değişkenlerini oradan okur.

```bash
cp .env.example backend/.env
```

`backend/.env` içinde en az şunları doldurun:

| Değişken | Not |
|----------|-----|
| `BETTER_AUTH_SECRET` | en az 32 karakter, rastgele |
| `LLM_API_KEY` | **`.env.example`'da boş gelir** — Groq anahtarı ([console.groq.com](https://console.groq.com), ücretsiz katman). Doldurulmadan backend başlamaz. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed edilecek admin hesabı (şifre en az 8 karakter) |

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` zorunludur ama `.env.example`'daki
yer tutucular kurulum için yeterlidir (uygulama açılır, backend testleri geçer;
yalnızca tarayıcıdan Google girişi çalışmaz). Diğer alanların varsayılanları
local kurulum için hazırdır.

## 3. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev     # tum semayi uygular (auth + interview + pre-assessment + token usage)
npm run db:seed            # admin hesabi (idempotent)
npm run start:dev          # http://localhost:3000
```

Ortam değişkeni eksik/hatalıysa uygulama **başlamaz** ve hangi alanın sorunlu
olduğunu konsola yazar (zod ile fail-fast).

## 4. Frontend

Ayrı bir terminalde:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:5173
```

Frontend, backend API adresini `VITE_API_URL` ile bulur; `.env.example`'daki
varsayılan `http://localhost:3000` local kurulum için yeterlidir. `VITE_API_URL`
**dolu** olduğu sürece istemciler backend'e doğrudan gider; `vite.config.ts`'teki
`/api` proxy'si yalnızca bu değer boş bırakıldığında (tek-origin tünel/deploy)
devreye girer.

Uygulamayı `http://localhost:5173` üzerinden açın. Admin girişi:
`http://localhost:5173/admin/login` (`backend/.env`'deki bilgilerle).

## 5. Doğrulama e-postası

Varsayılan `MAIL_TRANSPORT=console` modunda gerçek e-posta gönderilmez; kayıt
sonrası doğrulama bağlantısı **backend'in çalıştığı terminale** loglanır:

```
[mail] E-posta dogrulama baglantisi (...): http://localhost:5173/verify-email?token=...
```

Linki oradan kopyalayıp tarayıcıda açın. Gerçek gönderim için
`MAIL_TRANSPORT=resend` + `RESEND_API_KEY` (bkz. [ADR-0008](../docs/DECISIONS.md#adr-0008--e-posta-gönderim-yolu-resend)).

## 6. Testler

Backend entegrasyon testleri **gerçek PostgreSQL'e** bağlanır (mock yok) —
önce `docker compose up -d` çalışır durumda olmalı.

```bash
cd backend
npm run test               # birim testler
npm run test:e2e           # entegrasyon testleri

cd ../frontend
npm run test               # Vitest (birim/component)
npm run test:e2e           # Playwright — backend AYRICA calisiyor olmali + db:seed yapilmis olmali
```

Playwright yalnızca frontend'i otomatik başlatır; backend ve Postgres'i siz
ayakta tutmalısınız.

## Takıldığınızda

Sık karşılaşılan hatalar ve çözümleri kök `README.md` içindeki
[Sorun Giderme](../README.md#sorun-giderme) bölümündedir (env doğrulama hatası,
Prisma bağlantı hatası, port çakışması, seed hatası).
