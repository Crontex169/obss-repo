# Implementasyon Günlüğü: Görüşme (Interview)

**Dilim**: `002-interview` | **Dal**: `005-interview-dikeyi-implementasyon`

Bu belge, `tasks.md`'deki fazların **fiilen nasıl uygulandığını**, yol boyunca bulunan
sapmaları ve alınan ara kararları kaydeder. `tasks.md` "ne yapılacak"ı, bu belge
"ne yapıldı ve neden farklı yapıldı"yı tutar.

> **Neden ayrı bir belge?** Faz sonu raporları oturum bağlamında kalıyordu; spec'e
> yansımayan sapmalar (test altyapısı kısıtları, sözleşme yorumları, erken kapatılan
> ADR'ler) kayboluyordu. Anayasa İlke VII (kararların gerekçelendirilmesi) gereği
> bunlar kalıcı hale getirildi.

---

## Özet Durum

| Faz | Kapsam | Görevler | Durum |
|-----|--------|----------|-------|
| 1 | Kurulum (bağımlılıklar, env, iskelet) | T001-T009 | ✅ Tamam |
| 2 | Temel altyapı (veri katmanı + LLM motoru) | T010-T040 | ✅ Tamam |
| 3 | US1 — İş ilanı girişi + soru üretimi | T041-T056 | ✅ Tamam |
| 4 | US2 — Soru-cevap akışı (sıralı kilit) | T057-T067 | ✅ Tamam |
| 5 | US5 — Değerlendirme raporu üretimi | T068-T079 | ✅ Tamam — **MVP tamam** |
| 6 | US3 — Resume + liste | T080-T086 | ✅ Tamam |
| 7 | US4 — Adaptif soru akışı (bonus) | T087-T093 | ✅ Tamam |
| 8 | Cila & kesişen konular | T094-T102 | ⏳ Sırada |

**Test durumu (Faz 7 sonu)**: 55 birim + 63 entegrasyon testi yeşil.
Backend `nest build` + `tsc` temiz, frontend `vite build` temiz.

---

## Faz 1 — Kurulum (T001-T009)

**Yapılanlar**: `openai`, `unpdf`, `@nestjs/throttler`, `@types/multer` kurulumu;
`.env.example` + `env.validation.ts` genişletildi (LLM_*, `PDF_MAX_SIZE_MB`);
backend/frontend klasör iskeleti.

### Sapmalar ve bulgular

| # | Bulgu | Sonuç |
|---|-------|-------|
| 1 | **`@nestjs/throttler` auth diliminden GELMİYOR** — `tasks.md` T002 "auth dilimi getiriyor" diyordu; auth aslında Better Auth'un yerleşik `rateLimit`'ini kullanmış (`backend/src/auth/rate-limit.config.ts`). | Bu dilimde kuruldu. |
| 2 | **`@types/multer` eksikti** — `multer` `@nestjs/platform-express` üzerinden dolaylı geliyordu ama tipleri yoktu (`FileInterceptor` için gerekli). | devDependency olarak eklendi. |
| 3 | **`zod-to-json-schema` gereksiz çıktı** — proje Zod **4** kullanıyor, `z.toJSONSchema()` yerleşik. `zod-to-json-schema` Zod 3 hedefli. | Paket **kaldırıldı**; katman-1 üretici yerleşik API'yi kullanıyor (`schema-to-provider.ts`). |
| 4 | T001 spike'ı otomatik script yerine **Groq Console'da manuel** doğrulandı. | `LLM_MODEL = openai/gpt-oss-120b`; `spike/model-spike.mjs` gerektiğinde koşulabilir durumda bırakıldı. |

---

## Faz 2 — Temel Altyapı (T010-T040)

**Yapılanlar**: Prisma şeması (`Interview`/`Question`/`Answer`/`Report` +
cross-cutting `TokenUsage`), migration; ortak yardımcılar (dil çözümleyici, hata
zarfı filtresi, LLM hız sınırı guard'ı); **sağlayıcı-agnostik `LlmModule`**
(port, tek OpenAI-uyumlu adapter, iki katmanlı şema doğrulama, hata sınıfları,
çağrı başına timeout, `TokenUsage` yazımı); `PdfExtractionService`; `voice-client.ts`;
`InterviewModule` iskeleti + `InterviewOwnershipGuard`.

### Ara kararlar (spec'te belirtilmemiş, burada gerekçelendiriliyor)

| Karar | Gerekçe |
|-------|---------|
| **LLM hata sınıfları `HttpException`'dan türüyor** (`llm.errors.ts`) | Global hata zarfı filtresi HTTP eşlemesini (504/502) kendiliğinden yapıyor; her çağıran dikeyde `try/catch → map` tekrarı olmuyor. Sağlayıcı yanıtı `cause` içinde kalıyor, kullanıcıya sızmıyor. |
| **`Question.options` / `Report.additionalNotes` `String[]` (nullable değil)** | Prisma skaler listeler opsiyonel **olamaz**. `data-model.md` `String[]?` diyordu — mekanik kısıt, `multiple_choice` dışında boş dizi. |
| **`TokenUsage.preAssessmentId` FK'sız `String?`** | `PreAssessment` modeli henüz yok (`003-pre-assessment`). Kolon şimdi açıldı ki veri kaybı olmasın; FK o dilim geldiğinde bağlanacak. |
| **`InterviewOwnershipGuard` ayrı bir guard** | Auth dilimindeki `OwnershipGuard` route param `:ownerId` karşılaştırıyor ve **403** dönüyor. Interview'da sahip kimliği kaydın içinde ve `API_CONVENTIONS.md` §1 "yabancı kayıt → **404**" kuralını kapatmış (403 kaydın var olduğunu sızdırır). Sözleşme yeniden kullanıldı, kod kopyalanmadı. |
| **`ZodValidationPipe`** (`common/`) | Proje zaten Zod'u env ve LLM şemalarında zorunlu kullanıyor; HTTP DTO'ları için `class-validator` eklemek ikinci bir doğrulama kütüphanesi ve tutarsızlık getirirdi. → `TECH_STACK.md`'ye işlendi. |
| **Jest kök config `rootDir: "."`** | Birim testler `backend/test/unit/` altında; eski config yalnızca `src/`'yi tarıyordu, testler hiç koşmuyordu. |

---

## Faz 3 — US1: İş İlanı Girişi + Soru Üretimi (T041-T056)

**Yapılanlar**: `POST /api/interviews` (multipart + JSON), soru üretimi domain
katmanı, PDF/metin akışı, dil çözümlemesi, pozisyon çıkarımı, hız sınırı (3/saat);
frontend yeni görüşme formu + PDF yükleme + mod seçici.

### Ara kararlar

| Karar | Gerekçe |
|-------|---------|
| **Soru üretimi şeması bir FABRİKA** (`buildQuestionGenerationSchema(N, mode)`) | `N` ve `mode` çağrı bazında değişiyor. `.length(N)` ve "sözlü modda hepsi `open_ended`" kuralları katman-2 Zod'a gömülünce, sayı/tip uyumsuzluğu **doğrudan** `LlmSchemaError`'a düşüyor — servis kodunda ayrı kontrol gerekmiyor (`API_CONVENTIONS.md` §3.3). |
| **LLM çağrısı transaction'dan ÖNCE** | Hata/timeout/şema uyumsuzluğunda hiçbir yarım kayıt oluşmuyor (FR-019, T053). |

### Sapmalar ve bulgular

| # | Bulgu | Sonuç |
|---|-------|-------|
| 1 | **`unpdf`'in PDF.js motoru yalnızca ESM** (`unpdf/pdfjs`). Gerçek Node çalışma zamanında sorun yok (doğrulandı); yalnızca Jest'in CJS derlemesinde dinamik `import()` kısıtına takılıyor (Node ≥24.9 gerektiriyor). | Testlerde port sınırında mock: `test/fakes/fake-unpdf.ts`. `PdfExtractionService`'in **sözleşmesi** (tip/boyut/boş-metin) test ediliyor; PDF.js'in ayrıştırma doğruluğu onun sorumluluğu. **Üretim kodu etkilenmiyor.** → ADR-0009'a işlendi. |
| 2 | **`LlmRateLimitGuard` DTO doğrulamasından ÖNCE çalışıyor** (guard → pipe sırası) — yani 400 dönecek istekler de kotayı tüketiyor. | Doğru davranış (§3.5 "başarılı + başarısız birlikte sayılır") ama testleri etkiliyordu: aynı kullanıcıyla >3 istek atan test dosyaları her `it()` için ayrı kullanıcı kullanacak şekilde düzeltildi. |
| 3 | **ADR-0009 planlanandan erken kapatıldı** (T096 → Faz 3). | PDF entegrasyonu sırasında karar zaten verilmişti; ertelemek yapay olurdu. `DECISIONS.md` + `TECH_STACK.md` güncellendi, T096 `[X]`. |

---

## Faz 4 — US2: Soru-Cevap Akışı (T057-T067)

**Yapılanlar**: `POST /api/interviews/:id/answers` — sıralı kilit, çoktan seçmeli
doğrulama, cevap değişmezliği, tamamlanma geçişi; frontend soru-cevap ekranı +
sözlü mod kontrolleri.

### Ara kararlar

| Karar | Gerekçe |
|-------|---------|
| **Sıralı kilidin TEK kaynağı `currentQuestionOrder` karşılaştırması** | Ayrıca `status` kontrolü gerekmiyor: tamamlanmış görüşmede `currentQuestionOrder` zaten `N+1`'e ilerlemiş olur ve her deneme "zaten cevaplanmış" (`<`) dalına düşer. |
| **`sourceMode` istek gövdesinde TAŞINMIYOR** | `Interview.mode`'dan türüyor — bir görüşme içinde yazılı/sözlü karışık olamaz; istemciye bırakmak gereksiz bir güven yüzeyi olurdu. |
| **`@HttpCode(200)`** cevap uç noktasında | NestJS POST varsayılanı 201; sözleşme (§4) 200 diyor. |

### Sapmalar

| # | Bulgu | Sonuç |
|---|-------|-------|
| 1 | **T084'ün (Faz 6) bir parçası öne alındı**: `GET /api/interviews/:id` artık `currentQuestion` da dönüyor. | Session ekranı sayfa yenilendiğinde aktif soruyu alamıyordu — T066 bozuk teslim edilecekti. **Yalnızca aktif soru** eklendi; geçmiş soru-cevap çiftleri ve `completed` rapor bilgisi Faz 6'da. `tasks.md` T084'e not düşüldü. |
| 2 | **`.env`'de `MAIL_TRANSPORT="resend"`** (auth dilimi tarafından eklendi) `env.validation.ts` şemasında yok (`console|smtp`) → uygulama açılışta patlıyor, **tüm** entegrasyon testleri düşüyor. | Bu dilimin kapsamı dışı (ADR-0008 sahibi `001-auth-rol`). Testler `MAIL_TRANSPORT=console` override'ıyla koşuldu. **Auth dilimi şemayı güncellemeli.** |

---

## Faz 5 — US5: Değerlendirme Raporu Üretimi (T068-T079) 🎯 MVP

**Yapılanlar**: Rapor domain katmanı (Zod şeması + prompt + 60 sn timeout),
rapor orkestrasyonu (`pending → ready | failed`), `GET /:id/report` +
`POST /:id/report/retry`; frontend rapor ekranı (Recharts radar) + hata/bekleme
durumları.

### Ara kararlar

| Karar | Gerekçe |
|-------|---------|
| **`additionalNotes` `.nullable()`, `.optional()` DEĞİL** | Groq `strict: true` opsiyonel alan kabul etmiyor (`API_CONVENTIONS.md` §3.3). Model not üretmezse `null` dönüyor, DB'ye boş dizi yazılıyor. |
| **Otomatik akışta rapor hatası FIRLATILMIYOR** | Son cevap zaten kaydedildi; kullanıcı onu kaybetmemeli. Hata `reportStatus='failed'` olarak yansıyor + loglanıyor (sessiz yutma yok, İlke VI) ve `retry` ile telafi ediliyor (FR-015, SC-008). |
| **`retryReport` orijinal hata sınıfını yeniden fırlatıyor** | Retry **kullanıcı tetikli**; sessizce "failed" dönmek yanıltır. Böylece 502 (sağlayıcı/şema) ↔ 504 (timeout) ayrımı korunuyor (§3.4). `generateReport` bu yüzden `{ interview, error }` dönüyor. |
| **Timeout entegrasyon testi 45 sn beklemiyor** | Çağrıya **geçen** `timeoutMs` değeri doğrulanıyor; 45sn/60sn yarışı zaten `llm-timeout.spec.ts`'te sahte zamanlayıcıyla test edilmiş durumda. Gerçek bekleme test süresini anlamsızca uzatırdı. |

### Sapmalar

| # | Bulgu | Sonuç |
|---|-------|-------|
| 1 | **T058'in `reportStatus="pending"` beklentisi geçersiz kaldı.** Sözleşme (§4) rapor üretimini **eşzamanlı** tanımlıyor; `pending` istemcinin gördüğü yanıtta hiç oluşmayan geçici bir durum. | `us2-completion.spec.ts` `"ready"` bekleyecek şekilde güncellendi; `tasks.md` T058'e sapma notu düşüldü. |
| 2 | **`npx shadcn add chart` dosyaları literal `@/` klasörüne yazdı** (Windows alias çözümleme sorunu). | `src/components/ui/`'ya taşındı, artık klasör silindi. Recharts + lucide-react bağımlılık olarak eklendi. |
| 3 | **Frontend bundle 322 kB → 622 kB** (Recharts). | Bloklayıcı değil; code-splitting Faz 8 (cila) kapsamında değerlendirilecek. |

---

## Faz 6 — US3: Resume + Liste (T080-T086)

**Yapılanlar**: `GET /api/interviews/:id` sözleşmenin tamamına çıkarıldı (cevaplanmış
çiftler + aktif soru + `ready` ise rapor); `GET /api/interviews` liste uç noktası
(soft-delete filtresi + admin okuma baypası); frontend görüşme listesi + kart bileşeni,
session ekranında geçmiş soru-cevap akışı.

### Ara kararlar

| Karar | Gerekçe |
|-------|---------|
| **Liste uç noktasında kaynak bazlı guard YOK** | `GET /api/interviews` zaten kullanıcıya göre filtreliyor (`userId` veya admin ise tümü); `InterviewOwnershipGuard` tekil kaynak içindir, listede anlamsız olurdu. |
| **Admin-özel alanlar (`deletedAt`, `userId`) `select` düzeyinde koşullu** | Alanları çekip sonra silmek yerine sorgudan hiç istememek: kullanıcıya sızma yüzeyi kalmıyor. Test bunu ayrıca doğruluyor. |
| **Sonraki soruların sızmadığı testte metin araması ile doğrulanıyor** | `JSON.stringify(body)` içinde soru `N+1`'in metni aranıyor — alan bazlı kontrol, yanıt şekli değişirse sessizce geçebilirdi (FR-006 kritik kural). |
| **Liste kartı `ready` raporu olan görüşmede doğrudan rapora yönlendiriyor** | Tamamlanmış görüşmede oturum ekranının gösterecek bir şeyi yok; kullanıcıyı ara adımdan geçirmemek. |

### Sapmalar

| # | Bulgu | Sonuç |
|---|-------|-------|
| 1 | **Faz 4'te öne alınan T084 parçası tamamlandı.** Faz 4'te yalnızca `currentQuestion` dönüyordu (session ekranı bozulmasın diye). | Artık `answeredPairs` + `report` da dönüyor; `tasks.md`'deki "kısmen yapıldı" notu kaldırıldı. |

---

## Faz 7 — US4: Adaptif Soru Akışı (T087-T093, bonus)

**Yapılanlar**: `llm/adaptive.ts` (şema fabrikası + prompt + veri izolasyonu);
`adaptNextQuestion()` — cevaptan sonra henüz gösterilmemiş sıradaki soruyu uyarlıyor,
hata durumunda baseline korunuyor.

### Ara kararlar

| Karar | Gerekçe |
|-------|---------|
| **Adaptif şema da FABRİKA** (`buildAdaptiveSchema(targetType)`) — `type` `z.literal()` ile sabitleniyor | Uyarlama sorunun **biçimini değiştirmemeli**: hedef `open_ended` ise model `multiple_choice` döndüremez. Aksi halde sözlü modda çoktan seçmeli soru sızardı (FR-004 ihlali). `options` da tipe göre kısıtlanıyor (`min(2)` ↔ `max(0)`). |
| **Uyarlama hatası `logger.warn`, `error` değil** | Bu **beklenen ve tolere edilen** bir durum (FR-011: baseline'a düş). Rapor hatası `error` seviyesinde çünkü orada kullanıcıya bir şey eksik kalıyor; burada akış tam olarak devam ediyor. |
| **`if (!target \|\| target.answer) return;` savunması** | Normal akışta buraya cevaplanmış soru gelmez, ama "gösterilmemiş olma" garantisi **tek yerde** durmalı — çağıran tarafa güvenmek bu kuralı dağıtırdı (data-model.md: cevaplanmış soru donar). |
| **`adaptedFromAnswerId` ayrı sorguyla çözülüyor** | Cevap az önce aynı transaction'da yazıldı; ilişkiyi gerçek `Answer.id`'ye bağlamak izlenebilirlik için gerekli (test bunu doğruluyor). |

### Sapmalar

Yok — sözleşme (contracts §3, §4.2) doğrudan uygulanabildi.

---

## Devam Eden Açık Konular

| Konu | Sahibi | Not |
|------|--------|-----|
| `MAIL_TRANSPORT="resend"` env şemasında yok | `001-auth-rol` | Entegrasyon testleri override olmadan koşmuyor (Faz 4 / sapma 2) |
| `backend/test/integration/us4-admin-login.spec.ts` + `us5-roles-guard.spec.ts` tip hataları | `001-auth-rol` | Bu dilimden önce vardı, ertelendi |
| Frontend bundle boyutu | Bu dilim, Faz 8 | Recharts sonrası 622 kB |
| Silme uç noktası + meslek filtresi | `004-history` | Bu dilim yalnızca `deletedAt` alanını ve görünürlük kuralını hazırladı |
