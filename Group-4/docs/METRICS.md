# Performans ve Bakım Kolaylığı Metrikleri

> Ölçüm tarihi: **2026-08-06** · Ölçülen sürüm: `main` + `chore/performans-ve-bakim-metrikleri`
> Bu doküman iddia değil **ölçüm** içerir. Her satırın altında onu yeniden
> üretecek komut vardır; sayılar o komutların çıktısıdır.

Case study değerlendirme tablosunda bu iki başlık 8 puan tutuyor
(Performans 3, Bakım Kolaylığı 5). Aşağıdakiler o iki başlığın kanıtıdır.

## Bu iki başlık ne demek, neden önemli?

- **Performans** = uygulama kullanıcıya ne kadar hızlı yanıt veriyor?
  (sayfa açılışı, API isteği, LLM'den cevap dönüşü). Yavaş bir uygulama
  kullanıcıyı kaybettirir; bu yüzden "hızlı mı?" sorusunun sayıyla
  cevaplanması gerekir, göz kararıyla değil.
- **Bakım kolaylığı** = 6 ay sonra bu kodu başka biri (ya da unutan biz)
  açtığında; bir hatayı bulmak, yeni bir özellik eklemek veya bir şeyi
  bozmadan değiştirmek ne kadar zor? Test kapsamı düşükse, dosyalar
  devasa büyükse veya kod tekrarı çoksa, her değişiklik risklidir ve
  yavaşlar. Bu bölüm o riski sayıyla gösterir.

## Ölçümler nasıl yapıldı? İki farklı yöntem var

1. **Hazır araçlarla ölçülenler** — kendi yazmadığımız, npm paketi olarak
   kurulup çalıştırılan araçlar. Biz sadece bir komut çalıştırıyoruz, o
   araç kod tabanını tarayıp rapor üretiyor. Örnek: test kapsamı için
   `jest --coverage`, kod kalitesi için `eslint`, tip hataları için `tsc`,
   kopya-yapıştır kod için `jscpd`, döngüsel bağımlılık için `madge`,
   güvenlik açığı için `npm audit`. Bu araçlar **kod yazmayı gerektirmez**,
   sadece proje kök dizininde çalıştırılır (`package.json` → `scripts`).
2. **Bizim özel olarak yazdığımız ölçüm kodu** — bu projeye özgü, "şu an
   ölçülmüyor ama ölçülmesi gerekiyor" dediğimiz iki noktayı biz kodla
   ekledik. Bu dosyalar **uygulamanın çalışması sırasında** veri üretir
   (loglara veya veritabanına yazar), hazır bir araç değildir:

   | Ne ölçülüyor | Dosya | Ne yapıyor |
   |---|---|---|
   | Her HTTP isteğinin süresi | `backend/src/common/request-timing.interceptor.ts` | Her API isteğinin ne kadar sürdüğünü otomatik loglar |
   | Bu ölçümün testleri | `backend/test/unit/request-timing.spec.ts` | Loglama mantığının bozulmadığını garanti eder |
   | Her LLM (yapay zeka) çağrısının süresi | `backend/src/llm/llm.service.ts`, `backend/src/llm/token-usage.service.ts` | LLM'e her istek atıldığında süreyi ölçüp veritabanına yazar |
   | Süre verisinin veritabanı sütunu | `backend/prisma/migrations/20260806120000_add_token_usage_duration` | `TokenUsage` tablosuna `durationMs` (milisaniye) sütunu ekleyen migration |

   Aşağıdaki 1.3 ve 1.4 numaralı bölümler bu kendi yazdığımız kodu
   anlatıyor; geri kalan tüm bölümler hazır araçların çıktısıdır.

---

## 1. Performans

### 1.1 Frontend ilk yükleme boyutu — ölçülen iyileştirme

**Ne ölçülüyor?** Kullanıcı siteyi ilk açtığında tarayıcının indirmek zorunda
olduğu JavaScript miktarı (kilobayt, kB). Bu sayı ne kadar büyükse, kullanıcı
o kadar uzun süre boş/yüklenen bir ekrana bakar — özellikle mobil veya yavaş
internette. **Nasıl ölçülüyor?** `npm run build` komutu (Vite) üretilen
dosyaların boyutunu raporda listeler; "ham" boyut dosyanın gerçek boyutu,
"gzip" ise tarayıcının indirirken kullandığı sıkıştırılmış boyut (gerçek
kullanıcı deneyimine daha yakın olan budur).

Tüm sayfalar `App.tsx`'te statik olarak import ediliyordu; `recharts`, `jspdf`
ve i18n paketleri **giriş ekranında bile** indiriliyordu. Sayfalar
`React.lazy` + tek bir `Suspense` sınırına alındı.

| | Önce | Sonra | Değişim |
|---|---:|---:|---:|
| İlk yükleme JS (ham) | 1.557,20 kB | **426,71 kB** | **−%72,6** |
| İlk yükleme JS (gzip) | 481,32 kB | **135,93 kB** | **−%71,8** |
| Entry chunk (ham) | 1.557,20 kB | 334,03 kB | −%78,5 |
| Üretilen JS chunk sayısı | 4 | 46 | rota başına ayrı chunk |
| Vite ">500 kB chunk" uyarısı | var | **yok** | — |

İlk yükleme = `index.html`'in `<script>` + `modulepreload` ile çektiği dosyalar:
entry chunk (334,03 kB) + `language-provider` (102,23 kB) + rolldown runtime
(0,69 kB). Geri kalan 43 chunk yalnızca ilgili rotaya girildiğinde iner.

`HomePage` bilinçli olarak eager bırakıldı: açılış rotasında spinner
flash'ı yaşanmasın.

```bash
cd frontend && npm run build       # chunk tablosu build çıktısında
```

> **Not:** Bu ölçüm alınabilmesi için önce prod build'in kendisi onarıldı —
> `tsc -b`, better-auth 1.6.25'in `oneTapClient` tip uyumsuzluğu yüzünden
> hata veriyordu ve `npm run build` **hiç çalışmıyordu**.

### 1.2 Veritabanı

**Ne ölçülüyor?** Veritabanı sorgularının hızlı kalıp kalmayacağı. Bir tabloda
"indeks" yoksa, veritabanı her sorguda tüm satırları tek tek tarar (buna
**seq scan / full table scan** denir) — tablo büyüdükçe bu orantısız
yavaşlar. İndeks varsa veritabanı doğrudan ilgili satırlara atlar. **Nasıl
ölçülüyor?** `prisma/schema.prisma` dosyasındaki `@@index` tanımları elle
okunarak, hangi sorgunun hangi indeksle karşılandığı eşleştirildi (bir araç
çıktısı değil, kod incelemesi).

Şema, ölçüm öncesi de doğru indekslenmişti; aşağıdakiler listeleme ve
istatistik sorgularının seq scan'e düşmemesi için bilinçli konmuş indekslerdir:

| Tablo | İndeks | Hangi sorguyu korur |
|---|---|---|
| `Interview` | `(userId, createdAt DESC)` | kullanıcının görüşme geçmişi listesi |
| `Interview` | `(deletedAt)` | admin "silinmiş" filtresi (soft-delete) |
| `TokenUsage` | `(userId, createdAt)` | kullanıcı bazlı maliyet dökümü |
| `TokenUsage` | `(operation, createdAt)` | admin token/maliyet trend grafiği |
| `TokenUsage` | `(interviewId)` | görüşme detayında token toplamı |
| `PreAssessment` | `(userId, createdAt DESC)` | ön değerlendirme listesi |
| `Question` | `(interviewId, order)` UNIQUE | sıralı soru akışında sıra kilidi |

Admin listeleme `skip`/`take` ile sayfalanır (`admin.service.ts`) — tablo
büyüdükçe yanıt boyutu sabit kalır.

**Döngüsel bağımlılık nedir?** A dosyası B'yi, B de A'yı import ediyorsa
buna döngü denir; kodun hangi parçasının nereden başladığını anlamayı
zorlaştırır, test yazmayı ve yeniden düzenlemeyi zorlaştırır. `madge` aracı
tüm import zincirlerini tarayıp böyle bir döngü var mı diye kontrol eder.
Sonuç **0** = hiç döngü yok, bu iyi bir sonuçtur.

Döngüsel bağımlılık: **0** (`npx madge --circular --extensions ts src`,
66 dosya tarandı).

### 1.3 LLM çağrı süresi — yeni ölçüm noktası

**Ne ölçülüyor?** Yapay zeka (LLM) sağlayıcısına (Groq/DeepSeek) yapılan her
istek — soru üretimi, cevap değerlendirmesi, rapor üretimi — ne kadar sürede
cevap dönüyor. Bu, kullanıcının "bekleme süresi" hissettiği en büyük
kaynaktır; ölçülmeden iyileştirilemez. **Nasıl ölçülüyor?** Kendi
yazdığımız kod: `backend/src/llm/llm.service.ts` her çağrının başlangıç ve
bitiş zamanını kaydeder, süreyi `backend/src/llm/token-usage.service.ts`
üzerinden `TokenUsage` tablosundaki `durationMs` (milisaniye) sütununa yazar.
Bu sütun önceden yoktu, migration ile eklendi (bkz. üstteki tablo).

`TokenUsage` tablosu token ve maliyeti tutuyordu ama **süreyi tutmuyordu**;
"rapor üretimi ne kadar sürüyor" sorusunun ölçülebilir bir cevabı yoktu.

- `TokenUsage.durationMs` eklendi (migration `20260806120000`).
- Yalnızca sağlayıcı çağrısını kapsar; `JSON.parse` ve Zod doğrulaması dışarıda
  kalır — yani "LLM ne kadar bekletti" sorusunu yanıtlar.
- **Başarısız çağrılarda da yazılır**: en uzun bekleme genelde timeout'a giden
  çağrıdır, onu ölçüm dışı bırakmak ortalamayı yanıltıcı biçimde iyileştirirdi.

Aşağıdaki SQL sorgusu bu veriyi okuyup işlem tipine göre özetler
(`ort_ms` = ortalama süre, `max_ms` = görülen en kötü/en yavaş süre —
"tipik durum" ile "en kötü durum"u ayırt etmek için ikisi de gösterilir):

```sql
-- İşlem tipine göre ortalama ve en kötü durum
SELECT operation, count(*), round(avg("durationMs")) AS ort_ms,
       max("durationMs") AS max_ms,
       count(*) FILTER (WHERE NOT succeeded) AS basarisiz
FROM "TokenUsage" WHERE "durationMs" IS NOT NULL GROUP BY operation;
```

### 1.4 HTTP endpoint süreleri — yeni ölçüm noktası

**Ne ölçülüyor?** Backend'e gelen her API isteğinin (örn. `GET
/interviews/:id`) ne kadar sürede yanıtlandığı. Amaç "hangi endpoint yavaş"
sorusunu somut sayılarla cevaplayabilmek. **Nasıl ölçülüyor?** Kendi
yazdığımız kod: `backend/src/common/request-timing.interceptor.ts` adlı
NestJS interceptor'ı, sunucudaki **her** isteği otomatik olarak sarmalar,
isteğin başlangıcından yanıt dönene kadar geçen süreyi hesaplar ve loglar.
Geliştirici hiçbir şey yapmasa bile her endpoint için bu ölçüm otomatik
üretilir.

`RequestTimingInterceptor` (global) her isteği sabit, ayrıştırılabilir bir
formatta loglar:

```
[timing] GET /interviews/:id 200 143ms
```

Ham URL değil **route şablonu** yazılır — aksi halde her `id` ayrı bir satır
olur ve endpoint bazlı p50/p95 çıkarılamazdı. 1000 ms üzeri istekler `warn`
seviyesine yükselir. Hata yolunda da ölçer (`429`, `500` dahil).

> **p50/p95 nedir?** 100 istek olsa, p50 (medyan) bunların yarısının o
> süreden hızlı olduğu değerdir — "tipik" kullanıcı deneyimini gösterir.
> p95 ise isteklerin %95'inin bu süreden hızlı, geri kalan %5'inin daha
> yavaş olduğu değerdir — "kötü günde ne kadar bekleniyor" sorusunu
> yanıtlar. Ortalamadan daha güvenilirdir çünkü birkaç aşırı yavaş istek
> ortalamayı yanıltabilir ama p95'i az etkiler.

```bash
# p50/p95 çıkarmak için:
npm run start:dev 2>&1 | grep "\[timing\]" > timing.log
```

6 birim testi bu sözleşmeyi korur (`test/unit/request-timing.spec.ts`):
route şablonu yazılması, hata yolunda ölçüm, yanıtın değiştirilmemesi.

### 1.5 Halihazırda var olan performans/dayanıklılık kararları

Bunlar bu çalışmada eklenmedi, önceden vardı ve gerekçeleri kodda yazılı:

- **Çağrı başına timeout** (`LLM_REQUEST_TIMEOUT_MS`, varsayılan 30 s; rapor
  60 s): `Promise.race` ile SDK timeout'una ek üst sınır garantisi.
- **Otomatik retry YOK** (`maxRetries: 0`): başarısız LLM çağrısı sessizce
  tekrar denenmez — maliyet ve gecikme öngörülebilir kalır, tekrar deneme
  kullanıcı tetiklidir.
- **LLM uçlarında rate limit** (`LlmRateLimitGuard`): kota kullanıcı başınadır,
  başarılı ve başarısız istekler birlikte sayılır.
- **Rapor önbelleği**: `reportStatus = ready` ise LLM'e tekrar gidilmez.

---

## 2. Bakım Kolaylığı

### 2.1 Test kapsamı

**Ne ölçülüyor?** Kodun yüzde kaçının en az bir test tarafından
çalıştırıldığı ("coverage"). Yüksek kapsam, bir değişiklik yapıldığında
"bir şeyi bozdum mu?" sorusuna testlerin otomatik cevap verebileceği
anlamına gelir — düşük kapsamda bunu ancak elle deneyerek (veya
üretimde hatayla) anlarsınız. **Nasıl ölçülüyor?** Hazır araç: Jest'in
`--coverage` bayrağı, testler çalışırken hangi satırın/dalın/fonksiyonun
çalıştığını izler ve yüzde olarak raporlar. Komut: `npm run test:cov:all`.

| | Değer |
|---|---:|
| Backend test suite | **112** (96 integration + 16 unit) |
| Backend test | **407 geçiyor**, 4 todo |
| Backend statement coverage | **%91,56** (933/1019) |
| Backend branch coverage | **%77,26** (445/576) |
| Backend function coverage | **%93,85** (183/195) |
| Frontend test dosyası | **30**, hepsi geçiyor |
| Frontend test | **230 geçiyor** |
| Playwright E2E senaryosu | 33 |
| Test kodu / üretim kodu | 15.610 / 14.837 satır (**1,05×**) |

> **Statement / branch / function coverage farkı ne?** *Statement* = kod
> satırlarının kaçı çalıştı. *Branch* = `if/else` gibi her karar dalının
> (hem doğru hem yanlış tarafının) kaçı test edildi — genelde en düşük ve
> en anlamlı sayı budur, çünkü bir satır çalışsa bile o satırın içindeki
> "hata durumu" dalı hiç tetiklenmemiş olabilir. *Function* = fonksiyonların
> kaçı en az bir kez çağrıldı. "Test kodu / üretim kodu" oranı ise ne kadar
> emek test yazmaya harcandığının kaba bir göstergesidir; 1,0'a yakın olması
> testlerin ihmal edilmediğini gösterir.

```bash
cd backend && npm run test:cov:all   # unit + integration, birleşik coverage
cd frontend && npm test
```

Modül bazında backend statement coverage:

| Modül | % | Modül | % |
|---|---:|---|---:|
| `llm` | 98,93 | `interview/llm` | 98,43 |
| `pre-assessment/llm` | 100 | `pre-assessment` | 97,50 |
| `users` | 100 | `pdf` | 96,42 |
| `auth/ownership` | 100 | `auth/guards` | 96,15 |
| `interview` | 94,52 | `common` | 62,16 |

> `test:cov:all` bu çalışmada eklendi. Öncesinde unit ve integration ayrı
> koşuyor, coverage raporları birleşmiyordu; tek başına unit koşusu **%28,31**
> gösteriyordu ve "gerçek kapsam" hiçbir yerde görünmüyordu.

### 2.2 Statik analiz

**Ne ölçülüyor?** Kod hiç çalıştırılmadan (statik olarak) tespit edilebilen
hatalar ve riskli kalıplar: kullanılmayan değişkenler, tip uyuşmazlıkları,
`any` tipinin güvensiz kullanımı vb. Bunlar "gelecekte bug olma ihtimali
yüksek" noktalardır. **Nasıl ölçülüyor?** Hazır araçlar: backend'de
`eslint` (kural tabanlı kod tarayıcı) ve `tsc --noEmit` (TypeScript
derleyicisinin sadece tip kontrolü yapıp dosya üretmeyen modu); frontend'de
`oxlint` ve `tsc -b`. Sayı = bulunan hata/uyarı adedi; 0 = temiz.

| | Önce | Sonra |
|---|---:|---:|
| Backend `src/` lint hatası | 18 | **0** |
| Backend `src/` lint uyarısı | 1 | **0** |
| Backend `test/` lint hatası | 268 | **0** |
| Backend `tsc --noEmit` | temiz | temiz |
| Frontend `oxlint` hatası | 0 | 0 |
| Frontend `tsc -b` | **2 hata (build kırık)** | **0** |
| Frontend kırık test | 9 | **0** |

Test dosyalarındaki 268 "hata"nın tamamı `no-unsafe-*` sınıfındandı: supertest
`res.body`, Prisma ham sonuçları ve jest mock kayıtları tip sisteminde `any`
gelir. Bunları hata saymak, üretim kodundaki **gerçek 18 hatayı görünmez
kılıyordu**. Test kapsamında uyarıya çekildi; `src/` tarafında kurallar aynen
sıkı kaldı.

```bash
cd backend  && npx eslint "src/**/*.ts" "test/**/*.ts" && npx tsc --noEmit -p tsconfig.build.json
cd frontend && npm run lint && npm run build
```

### 2.3 Kod tekrarı ve dosya boyutu

**Ne ölçülüyor?** İki ayrı şey: (1) Aynı kodun birden fazla yerde
kopyalanıp yapıştırılmış olması (kod tekrarı) — bir hata düzeltildiğinde
diğer kopyalarda unutulma riski taşır. (2) Dosyaların ne kadar büyük olduğu
— çok satırlı bir dosya, tek bir yerde çok fazla sorumluluk biriktiği ve
okuması/değiştirmesi zorlaştığı anlamına gelir. **Nasıl ölçülüyor?** Hazır
araç: `jscpd` kod tabanını tarayıp birebir/benzer kod bloklarını bulur ve
yüzde olarak raporlar; dosya boyutu ise satır sayan basit bir sayım.

| Metrik | Değer |
|---|---:|
| Kod tekrarı (jscpd, 169 dosya) | **%0,81** — 12 klon / 131 satır |
| Backend `src/` | 65 dosya, 4.877 satır (**ort. 75 satır/dosya**) |
| Frontend `src/` | 94 dosya, 9.960 satır (**ort. 106 satır/dosya**) |
| 300 satırı aşan üretim dosyası | 7 |
| En büyük dosya | `interview.service.ts` (629 satır) |

> **%0,81 kod tekrarı ne demek?** Sektörde %5 altı genelde "iyi" kabul
> edilir; %0,81 çok düşük, yani kopyala-yapıştır alışkanlığı neredeyse yok.

```bash
npx jscpd backend/src frontend/src --min-lines 5 --min-tokens 50
```

300+ satırlık yedi dosya bölünmeye aday; en belirgini `interview.service.ts`
(soru üretimi, cevap akışı ve rapor üretimi aynı sınıfta).

### 2.4 Mimari — değiştirme maliyeti

**Ne ölçülüyor?** "Bir şeyi değiştirmek isteseydik kaç dosyaya dokunmamız
gerekirdi?" sorusu. Bu, kod kapsamı veya lint gibi bir araçla otomatik
üretilmez; kod tabanına bakılıp gerçek/örnek bir değişikliğin kaç dosyayı
etkileyeceği elle takip edilir. Az dosya = düşük bağlantılı (loosely
coupled), esnek mimari; çok dosya = değişikliklerin kod tabanına yayıldığı,
riskli bir mimari.

Bakım kolaylığının asıl testi "bir şeyi değiştirmek kaç dosyaya dokunmayı
gerektiriyor". Ölçülebilir örnekler:

| Değişiklik | Dokunulan dosya |
|---|---|
| LLM sağlayıcısını değiştirmek (Groq ↔ DeepSeek) | **1 dosya + env** — `llm/providers/openai-compatible.provider.ts` tek adaptör; ikisi de OpenAI-uyumlu |
| Yeni LLM işlemi eklemek | prompt + şema (dikey klasöründe); motor `llm.service.ts` domain bilmez |
| Arayüz metni değiştirmek | `lib/i18n/locales/{tr,en}/*.json` — bileşenlerde gömülü metin yok |
| Yeni sayfa eklemek | `App.tsx`'e bir `lazy(...)` satırı; bundle otomatik bölünür |

Yapısal sayılar: **8 NestJS modülü**, 19 HTTP endpoint, 8 veritabanı indeksi,
**11 ADR** (`docs/DECISIONS.md`), 6 dikey dilim spec'i (`specs/`).

Katmanlama tutarlı: her dikey `controller / service / dto / guard` ayrımını
izler; token/maliyet kaydı tek tabloda (`TokenUsage`) toplanır, dikey başına
ayrı maliyet tablosu yoktur.

### 2.5 Süreç

**Ne ölçülüyor?** Ekip çalışma disiplini — kod incelemesinden geçip
geçmediği, kaç kişinin katkı verdiği, her değişikliğin otomatik kontrolden
geçip geçmediği. **Nasıl ölçülüyor?** `git log` üzerinden commit/PR/katkıcı
sayımı (hazır araç: git). Lint, tip denetimi ve testler yereldeki npm
script'leriyle çalıştırılır.

| | Değer |
|---|---:|
| Commit | 227 |
| Merge edilmiş PR | 42 |
| Katkıcı | 7 |

### 2.6 Bağımlılık sağlığı

**Ne ölçülüyor?** Projenin kullandığı üçüncü parti paketlerde bilinen
güvenlik açığı olup olmadığı. **Nasıl ölçülüyor?** Hazır araç: `npm audit`,
npm'in güvenlik açığı veritabanına (GitHub Advisory Database) karşı yüklü
paketleri kontrol eder.

| | Sonuç |
|---|---|
| `npm audit --omit=dev` (backend) | **0 açık** |
| `npm audit --omit=dev` (frontend) | 2 high — `react-router-dom` 7.18.2 |

Frontend'deki iki uyarı **aynı** açığa işaret ediyor:
[GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2),
React Router'ın **RSC modunda** CSRF bypass. Bu uygulama RSC modu kullanmıyor
(düz SPA, `BrowserRouter`), dolayısıyla açık bu kod tabanında sömürülebilir
değil. 7.18.2 zaten en güncel sürüm; ileri yönde yamalı sürüm henüz yok,
`npm audit fix --force` 7.11.0'a **geri** düşürüyor. Bilinçli olarak
güncellenmedi, yamalı sürüm çıktığında geçilmeli.

---

## 3. Bu ölçümlerden çıkan, henüz yapılmamış işler

Dürüstlük payı — ölçüm bunları da gösterdi:

1. **`common` modülü %62 coverage** ile en düşük kapsamlı yer
   (`http-exception.filter.ts` hata dalları).
2. **`auth/mail` %56** — Resend transport yolu test edilmiyor, yalnızca
   console transport'u kapsanıyor.
3. **`interview.service.ts` 646 satır** — soru üretimi / cevap akışı / rapor
   üretimi ayrı servislere bölünebilir.
4. **Lighthouse ölçümü yapılmadı** — bundle boyutu ölçüldü ama LCP/TBT/CLS
   gerçek tarayıcıda ölçülmedi.
5. **Yük testi yapılmadı** — endpoint p50/p95 için altyapı (interceptor)
   kuruldu, ancak `autocannon`/`k6` ile eşzamanlı yük altında ölçüm alınmadı.
6. **`react-router-dom` açığı** yamalı sürüm çıkınca güncellenmeli.
