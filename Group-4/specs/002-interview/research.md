# Phase 0 Araştırma: Görüşme (Interview)

**Dilim**: `002-interview` | **Tarih**: 2026-07-30

Bu belge, Teknik Bağlam'daki bilinmeyenleri çözer. Her başlık **Karar / Gerekçe /
Değerlendirilen Alternatifler** biçimindedir. Frontend/backend/veritabanı teknoloji
yığını ADR-0001…0003 (`docs/DECISIONS.md`) ile kilitlidir ve burada yeniden
tartışılmaz. Bu dilim, **001-auth-rol** dilimindeki Kullanıcı/Auth altyapısına
(`User`, `SessionGuard`, oturum) bağımlıdır ve onu yeniden üretmez.

---

## 1. LLM Sağlayıcı Entegrasyon Mimarisi (Provider Soyutlaması)

> ⚠️ **Çapraz analiz güncellemesi:** Bu bölüm başlangıçta `LlmService`'i **domain metotlarıyla**
> (`generateQuestions`, `evaluateAnswer`, `generateReport`) tanımlıyordu ve sağlayıcıyı
> kararsız sayıyordu. İki sorun tespit edildi: (a) sağlayıcı **ADR-0007** ile karara
> bağlanmıştı, (b) domain metotları altyapı katmanına sızdığı için `003-pre-assessment` aynı
> dizinde uyumsuz bir ikinci tasarım kuruyordu. Bölüm, `docs/API_CONVENTIONS.md` §3 ve
> `specs/003-pre-assessment/contracts/llm-contract.md` sözleşmesine hizalandı.

- **Karar**: LLM erişimi **iki katmana** ayrılır:

  1. **`backend/src/llm/` — sağlayıcı-agnostik motor.** Tek genel yüzey:
     `generateStructured({ schema, systemPrompt, userData, timeoutMs?, operation, userId, interviewId? })`.
     İçinde: `LlmProvider` port arayüzü, **tek** OpenAI-uyumlu adapter (Groq + DeepSeek,
     ADR-0007), Zod → JSON Schema dönüştürücü (katman-1), runtime Zod doğrulaması
     (katman-2), hata sınıfları, çağrı başına timeout ve `TokenUsage` yazımı.
     **Domain bilmez.**
  2. **`backend/src/interview/llm/` — bu dilimin domain katmanı.** Her etkileşim için
     bir Zod şeması + bir prompt: `question-generation.ts`, `adaptive.ts`, `report.ts`.
     Bunlar motoru **çağırır**, değiştirmez.

- **Bu dilim motoru İNŞA EDER.** Implementasyon sırası Auth → **Interview** →
  Pre-assessment olduğundan projedeki ilk LLM entegrasyonu bu dilimdir; motoru bu dilim
  kurar, `003-pre-assessment` devralır. **Tasarımın sahibi bu dilim değildir** —
  sözleşme `003-pre-assessment/contracts/llm-contract.md` + `API_CONVENTIONS.md` §3'tedir.

- **Sağlayıcı kararı (ADR-0007)**: Groq birincil (ücretsiz katman, `json_schema` +
  `strict: true` ile constrained decoding), DeepSeek yedek (`json_object` + prompt'a
  gömülü şema). İkisi de OpenAI-uyumlu → **tek `openai` npm SDK**, yalnızca `baseURL`
  ve `apiKey` değişir. İkinci bir adapter sınıfı **yazılmaz**; fark yapılandırma verisidir.

- **Otomatik yeniden deneme YOK** (`maxRetries: 0`). *Önceki taslak "şema uyuşmazsa 1 kez
  yeniden dene" diyordu — cross-cutting sözleşmeyle (§3.4) ve `003-pre-assessment`
  FR-008b ile çelişiyordu; kaldırıldı.* Şema uyuşmazlığı doğrudan `LlmSchemaError` fırlatır
  ve çağıran akışa özgü graceful hata uygulanır (§4, §5); her tekrar **kullanıcı tetiklidir**.

- **Timeout çağrı başına**: varsayılan `LLM_REQUEST_TIMEOUT_MS` = **30 sn**; rapor üretimi
  **60 sn** ile override eder (SC-005 tüm soru-cevap setini gönderiyor ve 60 sn hedefliyor —
  sabit 30 sn onu keserdi; çapraz analiz bulgusu).

- **Test sınırı**: mock, **port sınırında** takılır (`LlmProvider`), servis sınırında değil.
  Paylaşılan fake `backend/test/fakes/fake-llm.provider.ts`'te durur ve
  `003-pre-assessment` onu da devralır. Bu dilim kendine ayrı bir mock LLM **yazmaz**.

- **[NETLEŞTİRİLECEK] — `LLM_MODEL`**: ADR-0007 sağlayıcıyı kilitledi, modeli değil.
  (a) Groq'ta hangi modellerin `strict` desteklediği ve (b) Türkçe üretim kalitesi bir
  **spike** ile ölçülüp `.env`'e yazılacak (ADR-0007 / R4, R5). Bloklayıcı değildir ama
  `tasks.md`'de **ilk görev** olmalıdır.

- **Değerlendirilen Alternatifler**:
  - *Sağlayıcıya doğrudan bağımlılık (soyutlama yok)*: ADR-0007 iki sağlayıcı tanımlıyor
    ve yedek yola geçiş `.env` değişikliği olmalı; ayrıca test fake'i için servisin
    kendisini değiştirmek gerekirdi. Reddedildi.
  - *Domain metotlarını motora koymak* (`generateQuestions` vb. `llm.service.ts` içinde):
    Her yeni LLM dikeyi altyapıyı değiştirmek zorunda kalır — bu dilim ile
    `003-pre-assessment` arasındaki çakışmanın tam nedeni. Reddedildi.
  - *Birden fazla sağlayıcıyı aynı anda destekleme (çoklu-sağlayıcı yönlendirme)*:
    Bu ölçekte gereksiz karmaşıklık (Anayasa — karmaşıklık kapısı); yedek yol `.env` ile
    elle devreye alınır. Reddedildi.
  - *Bu dilime özgü ayrı maliyet tablosu* (`LlmUsageLog`): `005-admin`'in tek sorguyla
    toplam maliyet raporlamasını iki tablonun `UNION`'ına çeviriyordu. Reddedildi — tek
    `TokenUsage` tablosu (§8, `API_CONVENTIONS.md` §4.1).

---

## 2. Girdi İzolasyonu ve Prompt Injection Savunması

- **Karar**: İş ilanı metni (serbest metin veya PDF'ten çıkarılan) ve kullanıcı
  cevapları, LLM'e her zaman ayrı bir **"veri" bölümü** olarak (sistem talimatından
  açıkça sınırlandırılmış, örn. sabit sistem promptu + rol ayrılmış
  `user`/`data` mesajı) gönderilir; kullanıcı girdisi asla sistem talimatı
  olarak birleştirilmez. Girdi uzunluğu üst sınırla kısılır (iş ilanı metni için
  makul karakter sınırı — PDF 10 MB/metne çevrilmiş içerik dahil) ve İlke V
  gereği ayrıştırma yapılmadan ham biçimde modele talimat gibi geçirilmez.
- **Gerekçe**: Anayasa İlke V, kullanıcı sağlı iş ilanı/serbest metin girdisinin
  LLM'e "veri" olarak izole edilmesini zorunlu kılar; bu dilim güvenilmeyen dış
  metni (ilan/PDF) doğrudan LLM'e taşıyan birincil yüzeydir.
- **Değerlendirilen Alternatifler**:
  - *Kullanıcı girdisini doğrudan sistem promptuna ekleme*: Injection riskini
    artırır; İlke V'yi ihlal eder, reddedildi.

---

## 3. PDF Metin Çıkarma Yaklaşımı

- **Karar**: Sunucu tarafında bir `PdfExtractionService` arayüzü tanımlanır
  (`extractText(buffer): Promise<string>`); somut kütüphane bu arayüzün arkasına
  yerleştirilir. Kabul kriterleri (FR-002): dosya azami **10 MB**, yalnızca
  `application/pdf`, metin çıkarılamazsa (taranmış görüntü/bozuk dosya → boş/hatalı
  sonuç) istek `422` ile anlaşılır bir hata mesajıyla reddedilir ve görüşme kaydı
  **oluşturulmaz**.
- **Gerekçe**: `docs/TECH_STACK.md`'de "PDF processing" satırı henüz
  **_Kararlaştırılacak_**. Arayüz soyutlaması, somut kütüphane seçimini
  bloklamadan sözleşmeyi (girdi: PDF buffer, çıktı: düz metin veya hata) sabitler.
- **[NETLEŞTİRİLECEK] — Somut PDF kütüphanesi**: Ayrı küçük bir **ADR-0009**
  ile kararlaştırılacaktır (öneri: hafif, saf Node.js kütüphanesi — ör.
  `pdf-parse` veya `pdfjs-dist`; native derleme bağımlılığı olmayan bir seçenek
  tercih edilir). Bloklayıcı değildir; arayüz sözleşmesi tasarımı etkilemez.
- **Değerlendirilen Alternatifler**:
  - *İstemci tarafında PDF metin çıkarma*: Sunucu tarafı doğrulama/güvenlik
    ilkesiyle (İlke V) çelişir; istemciden gelen "metin" güvenilmez sayılır ve
    yine sunucuda yeniden işlenmesi gerekirdi. Reddedildi.

---

## 4. Soru Üretimi, Sıralı Kilit ve Sabit/Adaptif Akış Uygulaması

- **Karar**: Görüşme oluşturulurken (mod ve N ne olursa olsun) LLM'den **N adet
  temel (baseline) soru** tek seferde üretilir ve `Question` kayıtları olarak
  sırayla (`order` alanı) saklanır — bu küme, adaptif akış etkinken bile
  **varsayılan/yedek soru havuzu** görevi görür (FR-011'in "önceden
  planlanmış/varsayılan soruya geri dönüş" gereksinimini karşılar). Sıralı kilit,
  sunucu tarafında şu kuralla uygulanır: bir cevap yalnızca, ilgili görüşmede
  **`order`'ı en küçük ve henüz cevaplanmamış** soru için kabul edilir; zaten
  cevaplanmış veya sıradaki değilse istek `409`/`400` ile reddedilir (FR-006,
  FR-007). Soru `i+1`, soru `i` cevaplanana kadar istemciye **hiç gönderilmez**
  (API yalnızca aktif soruyu döner).
  - **Adaptif akış etkinse**: soru `i` cevaplandığında, sistem eşzamanlı olarak
    `evaluateAnswer` ile cevabı değerlendirir ve LLM'den soru `i+1` için
    güncellenmiş bir zorluk/odak talep eder; başarılı olursa `Question[i+1]`
    kaydı bu yeni içerikle **güncellenir** (henüz kullanıcıya gösterilmediği
    için değişiklik güvenlidir). LLM hata/zaman aşımı verirse (§ile aynı
    yeniden deneme kuralı) **hiçbir güncelleme yapılmaz**; önceden üretilmiş
    baseline soru olduğu gibi sunulur (FR-011).
  - **Adaptif akış kapalıysa**: baseline sorular hiç değiştirilmeden sırayla
    sunulur (Hikâye 4, kriter 4).
  - Toplam soru sayısı her koşulda **N'de sabit** kalır (uyarlama yalnızca
    içerik/zorluk değiştirir, soru eklemez/çıkarmaz — FR-010).
- **Gerekçe**: Tüm N sorunun baştan üretilmesi, hem sabit modda basit bir
  sözleşme sağlar hem de adaptif modda "varsayılana geri dönüş" için hazır bir
  yedek oluşturur; ayrı bir "just-in-time üretim + fallback şablonu" mekanizması
  kurmaktan daha az karmaşıktır (Anayasa — karmaşıklık kapısı). Sıralı kilidin
  sunucu tarafında (yalnızca en küçük cevaplanmamış `order`) uygulanması,
  istemci baypasına karşı FR-006/FR-007'yi garanti eder.
- **Değerlendirilen Alternatifler**:
  - *Adaptif modda soruları tamamen just-in-time (önceden hiç üretmeden)
    üretme*: Fallback için ayrı bir "varsayılan soru şablonu" sistemi
    gerektirir ve LLM hatasında gösterilecek hazır bir soru olmayabilir; FR-011
    riskini artırır. Reddedildi.
  - *İstemci tarafında sıra takibi (yalnızca UI kontrolü)*: İlke V'yi ihlal eder;
    sunucu tarafı zorunlu kılındı.

---

## 5. Rapor Üretimi ve Ara Durum Yönetimi

- **Karar**: Son soru cevaplanınca `Interview.status` **`completed`** olur ve
  `Interview.reportStatus` **`pending`** ile rapor üretimi **eşzamanlı** olarak
  tetiklenir. `generateReport` başarılı olursa `Report` kaydı oluşturulur ve
  `reportStatus` **`ready`** olur. LLM hata/zaman aşımı verirse `reportStatus`
  **`failed`** olur; görüşme **`completed`** durumunda kalır (cevaplanmış
  soru/cevaplar kaybolmaz — FR-015), kullanıcıya yeniden deneme imkânı
  (`POST /api/interviews/:id/report/retry`) sunulur. Rapor bir kez **`ready`**
  olduktan sonra tekrar görüntüleme **LLM'i yeniden çağırmaz** (kaydedilmiş
  `Report` doğrudan döner — FR-014, SC-007).
- **Gerekçe**: Ayrı bir durum alanı (`reportStatus`), görüşmenin "tamamlandı"
  (soru-cevap akışı bitti) ile "rapor hazır" durumlarını birbirinden ayırır ve
  spec'in "tamamlandı ancak rapor bekleniyor/başarısız ara durum" gereksinimini
  (FR-015) veri kaybı olmadan modellemeyi sağlar.
- **Değerlendirilen Alternatifler**:
  - *Rapor üretimini arka planda asenkron kuyruk (job queue) ile yapma*: Bu
    ölçekte (SC-005: %95'i <60 sn) ek altyapı (kuyruk/worker) gerektirmeden
    eşzamanlı istek/yanıt + `retry` uç noktası yeterli; kuyruk gelecekte
    ölçek ihtiyacı doğarsa eklenebilir. Şimdilik reddedildi (karmaşıklık kapısı).
  - *Tek durum alanı (`status`) ile "rapor bekleniyor" ayrı bir enum değeri*:
    Soru-cevap tamamlanma durumu ile rapor durumu farklı yaşam döngülerine
    sahip (rapor yeniden denenebilir, soru-cevap akışı denenemez); iki alan
    daha açık, reddedilmedi ama ayrı alan tercih edildi.

---

## 6. Sözlü Mod (Voice) Mimarisi

> ⚠️ **Çapraz analiz güncellemesi:** STT/TTS sağlayıcısı artık **[NETLEŞTİRİLECEK] değil** —
> **ADR-0010** ile tarayıcı Web Speech API seçildi.

- **Karar**: Sözlü mod **tamamen istemci tarafındadır** (ADR-0010): `SpeechRecognition`
  (STT) ve `SpeechSynthesis` (TTS) tarayıcı yerleşik API'leri kullanılır. Sunucuda **ses
  işleme yoktur**; istemci sesi metne çevirip gönderir. `POST /api/interviews/:id/answers`
  sözleşmesi sözlü/yazılı ayrımı **yapmaz** — `Answer.sourceMode` yalnızca köken kaydıdır.
- **Gerekçe**: Maliyet sıfır (ADR-0007'nin ücretsizlik kısıtı burada da geçerli), yeni
  bağımlılık yok, sunucu sözleşmesi değişmiyor, ikinci bir token/maliyet kaynağı doğmuyor
  (İlke VI korunur). Anayasanın sözlü modu ürün kapsamına alan kısıtı da bozulmuyor.
- **Frontend soyutlaması**: `frontend/src/lib/voice-client.ts` korunur; arkasına Web Speech
  implementasyonu geçer. Soyutlama **yetenek tespiti** için de gereklidir (aşağı).
- **Zarif bozulma (FR-025, ADR-0010 / R1-R3)**:
  - Tarayıcı desteklemiyorsa (Firefox/Safari) sözlü mod seçeneği UI'da **devre dışı**
    gösterilir ve kullanıcı yazılı moda yönlendirilir. Sessiz başarısızlık yasak.
  - Mikrofon izni reddedilirse yazılı moda düşülür; görüşme kaybedilmez.
  - Metne dökülen cevap kullanıcıya **gönderim öncesi** gösterilir ve düzeltilebilir
    (İlke VII — kullanıcı kontrolü). Bu, `Answer` immutability'sini bozmaz: kayıt
    gönderimden **sonra** oluşur.
- **Soru tipi kısıtı**: Sözlü modda yalnızca `open_ended` soru üretilir (FR-004,
  Netleştirmeler) — sesli akışta çoktan seçmeli seçenek okuma/seçme etkileşimi tanımlı değil.
- **Değerlendirilen Alternatifler**:
  - *Ayrı STT/TTS servisi (sunucu tarafı)*: İkinci entegrasyon + ikinci maliyet kaynağı;
    ücretsizlik garanti değil. Reddedildi (ADR-0010).
  - *Ücretli realtime API (OpenAI Realtime / Gemini Live)*: Tek entegrasyonla en iyi çözüm
    ama ücretsizlik kısıtına takılıyor. Reddedildi (ADR-0006 yeniden geçerli olursa yeniden
    değerlendirilir).
  - *Sözlü modu kapsam dışına almak*: Anayasa "Teknoloji ve Kısıtlar" bölümü sözlü modu ürün
    kapsamına almış; kaldırmak anayasa değişikliği gerektirir. Reddedildi.

---

## 7. Yetkilendirme (001-auth-rol Altyapısının Yeniden Kullanımı)

- **Karar**: Bu dilim, kendi auth/oturum mekanizmasını **kurmaz**; 001-auth-rol
  dilimindeki `SessionGuard`'ı (oturum doğrulama) doğrudan yeniden kullanır ve
  o dilimde sözleşmesi kurulan `OwnershipGuard`'ı somut kaynağa (`Interview`)
  bağlar: `Interview.userId === request.user.id` değilse `404` (admin okuma
  için baypas — 001-auth-rol contracts/authz-rules.md R2/R3 ile birebir).
  Her görüşme, soru, cevap ve rapor uç noktası bu iki guard zinciriyle korunur
  (FR-017; SC-006).
- **Gerekçe**: 001-auth-rol dilimi bu guard'ları "sonraki dilimler kaynaklarına
  bağlar" notuyla önceden hazırlamıştı (bkz. 001-auth-rol/research.md §5); bu
  dilim o sözleşmeyi ilk kez somut bir kaynağa (Interview) bağlayan dilimdir.
  Auth mantığını tekrar yazmak Anayasa İlke IV'ü (dikey dilim tekrarını önleme)
  ihlal eder.
- **Değerlendirilen Alternatifler**:
  - *Interview için ayrı/özel bir yetki katmanı yazmak*: Var olan guard
    sözleşmesiyle işlevsel olarak aynı; tekrar niteliğinde, reddedildi.

---

## 8. Token/Maliyet Takibi

> ⚠️ **Çapraz analiz güncellemesi:** Bu bölüm `Interview.totalTokens`/`totalCostUsd` toplam
> alanları + bu dilime özgü `LlmUsageLog` tablosu öneriyordu. `003-pre-assessment` ise aynı
> amaç için cross-cutting `TokenUsage` tablosunu tanımlamıştı — kolonları uyumsuzdu
> (`tokens` ↔ `inputTokens`/`outputTokens`), `userId`/`provider`/`model` yoktu ve
> `005-admin`'in sorgusunu iki tablonun `UNION`'ına çeviriyordu. **Karar değişti.**

- **Karar**: Tek cross-cutting tablo: **`TokenUsage`**. Şema sahibi
  `specs/003-pre-assessment/data-model.md`, cross-cutting kural
  `docs/API_CONVENTIONS.md` §4.1. Bu dilim tabloyu **inşa eder** (sıra gereği ilk gelen
  LLM dikeyi) ve şu alanlarla yazar: `operation` ∈ {`question_generation`,
  `adaptive_evaluation`, `interview_report`}, `interviewId`, `userId`, `provider`, `model`,
  `inputTokens`, `outputTokens`, `estimatedCostUsd`, `succeeded`.

- **Yazım noktası**: `generateStructured()` **motorun içinde** yazar (§1). Çağıran servis
  unutamaz; bu yüzden `operation` ve `userId` imzada zorunludur. **Başarısız çağrılar da
  kaydedilir** (`succeeded: false`) — sağlayıcı token tüketmiş olabilir, maliyet takibinde
  boşluk oluşmaz (İlke VI).

- **Denormalize toplam alanı YOK**: `Interview.totalTokens`/`totalCostUsd` **kaldırıldı**.
  Görüşme başına toplam `SUM()` ile hesaplanır (`@@index([interviewId])` mevcut). Bu
  ölçekte (onlarca–yüzlerce kullanıcı, görüşme başına ≤22 LLM çağrısı) rollup'ın ölçülebilir
  kazancı yok; bedeli iki kaynağı senkron tutma borcu ve tutarsızlık riski.
  FR-016 ("token/maliyet ilgili görüşme kaydına kaydedilir") `TokenUsage.interviewId` FK'sı
  ile karşılanır.

- **Gerekçe**: `005-admin` "toplam tüketilen token — zaman serisi" (tüm dikeyler),
  "görüşme başına maliyet" ve kullanıcı bazlı döküm raporlayacak
  (`docs/APP_FLOW.md` §2). Tek tablo + üç index bunu tek sorguyla verir.

- **Değerlendirilen Alternatifler**:
  - *Bu dilime özgü `LlmUsageLog` + `Interview` üzerinde toplam alanlar* (önceki karar):
    Admin sorgusunu `UNION`'a çeviriyor, `userId`/`provider` taşımıyor ve rollup senkron
    tutma borcu yaratıyordu. Reddedildi.
  - *Yalnızca toplam alanlar, ayrıntı kaydı olmadan*: Çağrı bazlı döküm geriye dönük
    üretilemez; admin `operation` bazlı kırılım istiyor. Reddedildi.
  - *Toplam alanları da tutmak (hem satır hem rollup)*: İki kaynağın tutarlılığını her
    yazımda garanti etmek gerekir; bu ölçekte gerekçesiz karmaşıklık (Anayasa —
    karmaşıklık kapısı). Reddedildi.

---

## 9. Ortam Değişkenleri (.env.example ekleri)

Bu dilim, `.env.example`'a aşağıdaki ek değişkenleri getirir (gerçek değerler
`.env`'de, git'e girmez — İlke V). `003-pre-assessment` bu değişkenleri **devralır**,
yenisini eklemez.

| Değişken | Açıklama |
|----------|----------|
| `LLM_PROVIDER` | `groq` (birincil) \| `deepseek` (yedek) — ADR-0007 |
| `LLM_BASE_URL` | Sağlayıcı OpenAI-uyumlu endpoint'i (sağlayıcı farkı yapılandırmadır) |
| `LLM_API_KEY` | LLM sağlayıcı API anahtarı |
| `LLM_MODEL` | Model kimliği — **spike çıktısı** (ADR-0007 / R4, R5) |
| `LLM_REQUEST_TIMEOUT_MS` | Varsayılan timeout, `30000`. Rapor çağrısı kodda `60000` ile override eder (§1, §5, SC-005) |
| `PDF_MAX_SIZE_MB` | PDF azami boyutu (varsayılan 10 — FR-002) |

**`VOICE_*` değişkeni YOKTUR** — sözlü mod tarayıcı Web Speech API ile çalışır (ADR-0010);
sunucu tarafında sağlayıcı anahtarı gerekmez.

---

## Kalan Belirsizlikler Özeti

| Konu | Durum | Çözüm yolu |
|------|-------|-----------|
| LLM sağlayıcı | ✅ **KARARA BAĞLANDI** | **ADR-0007** — Groq birincil + DeepSeek yedek, tek `openai` SDK |
| Sözlü mod (STT/TTS) | ✅ **KARARA BAĞLANDI** | **ADR-0010** — tarayıcı Web Speech API, istemci tarafı, maliyet sıfır |
| `LLM_MODEL` değeri | [NETLEŞTİRİLECEK] (bloklamaz) | Spike: Groq'ta `strict` desteği + Türkçe kalite ölçümü (ADR-0007 / R4, R5). `.env`'den gelir; `tasks.md`'de **ilk görev** |
| Somut PDF metin çıkarma kütüphanesi | [NETLEŞTİRİLECEK] (bloklamaz) | **ADR-0009**; `PdfExtractionService` arayüzü sözleşmeyi sabitler, geçici hafif kütüphaneyle ilerlenir |
| Grafik kütüphanesi (rapor ekranı) | ✅ **KARARA BAĞLANDI** | **ADR-0011** — Recharts, shadcn/ui `Chart` bileşenleri üzerinden; `RadarChart` yerleşik, `accessibilityLayer` açılır |

Tüm bloklayıcı NEEDS CLARIFICATION'lar (soru sayısı aralığı, rapor skor ölçeği,
adaptif akış kapsamı, sözlü mod çoktan seçmeli davranışı, PDF azami boyutu)
spec'in "Netleştirmeler" bölümünde çözülmüştür.

**Çapraz analiz sonrası eklenen kararlar** (`docs/API_CONVENTIONS.md`):

| Konu | Karar | Bölüm |
|------|-------|-------|
| Token/maliyet tablosu | Tek cross-cutting `TokenUsage`; `LlmUsageLog` kaldırıldı | §4.1, §8 |
| Yabancı kayıt hata kodu | **`404`** (403 değil — varlık gizliliği) | §1 |
| Hata zarfı | `{ statusCode, error, message, details? }` | §2 |
| Üretim dili | `Accept-Language` → `tr`\|`en`, kayıtta saklanır (FR-020) | §4.2 |
| LLM hız sınırı | 3/saat (oluşturma), 5/saat (rapor retry), 60/saat (cevap) — FR-022 | §3.5 |
| Soft-delete görünürlüğü | Sahibinde gizli, admin'de "silindi" işaretli | §4.3 |
| Admin için zorunlu alanlar | `position` (FR-023), `completedAt` (FR-024) — sonradan eklenemez | §4.1 |
