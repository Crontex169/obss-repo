# Phase 0 Araştırma: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Dilim**: `003-pre-assessment` | **Tarih**: 2026-07-30

Bu belge, `plan.md` Teknik Bağlam bölümündeki çözülmemiş teknik bilinmeyenleri karara
bağlar. §1 çıktısı `docs/DECISIONS.md`'ye **ADR-0007** olarak taşınmıştır.

> **ADR numarası notu:** Numaralandırmanın tek doğru kaynağı `docs/DECISIONS.md` içindeki
> **ADR Kayıt Defteri** tablosudur; spec dosyaları numara rezerve edemez. LLM sağlayıcı için
> önce ADR-0006 (OpenAI) yazıldı; ekip "LLM maliyeti sıfır olmalı" kısıtını netleştirince
> **ADR-0007** (Groq + DeepSeek) ile değiştirildi. ADR-0006 tarihsel kayıt olarak
> korunmaktadır. E-posta gönderim yolu **ADR-0008**'e rezervedir (bu dilimi etkilemez).

---

## §1 — LLM Sağlayıcı Seçimi *(→ ADR-0007)*

### Bağlam

`docs/TECH_STACK.md`'de LLM sağlayıcı `_Kararlaştırılacak_` durumdaydı. Bu dilim, **LLM
sözleşmesinin tasarım sahibi** olduğu için kararı vermek zorunda kaldı (karar tarihinde bu
dilim implementasyon sırasında da ilkti; sıra sonradan Auth → Interview → Pre-assessment
olarak değişti, karar sahipliği değişmedi). Sonuç `docs/TECH_STACK.md`'ye işlendi.

**Eleyici kısıt: LLM maliyeti sıfır olmalı.** Bu bir staj vaka çalışmasıdır; kurumsal LLM
bütçesi ve ödemeli API anahtarı yoktur. Bu kısıt, ücretli sağlayıcıları (OpenAI, Gemini,
Anthropic) teknik yeterliliklerinden bağımsız olarak en baştan eler. Bu kısıt netleşmeden
önce yazılan ADR-0006 (OpenAI) bu nedenle değiştirilmiştir.

Değişmeyen teknik ihtiyaçlar:

| Dilim | LLM ihtiyacı | Kritik yetenek |
|-------|--------------|----------------|
| Pre-assessment (bu dilim) | Kısa prompt → yapılandırılmış JSON rapor | Şema garantili çıktı |
| Interview — soru üretimi | İş ilanı metni (uzun, PDF'ten çıkarılmış) → N soru | Uzun bağlam + şema |
| Interview — **sözlü mod** | Gerçek zamanlı sesli asistan (`docs/APP_FLOW.md` ekran 7) | Realtime ses — **hiçbir ücretsiz seçenekte yok**, ayrı karar (bkz. aşağıda) |
| Interview — değerlendirme raporu | Tüm soru-cevaplar → Teknik/Davranışsal/Genel rapor | Şema + uzun bağlam |

### Değerlendirilen Alternatifler

| Eksen | A) Groq — birincil (SEÇİLEN) | B) DeepSeek — yedek (SEÇİLEN) | C) Ücretli (OpenAI / Gemini) |
|-------|------------------------------|-------------------------------|------------------------------|
| **Maliyet** | **Ücretsiz katman** (kota sınırlı) | ~$0.14/$0.28 per 1M (V4 Flash) | En düşük $0.10/$0.40 — sıfır değil |
| **Performans** | LPU tabanlı, çok yüksek token/sn | İyi | İyi |
| **Şema garantisi** | `json_schema` + `strict: true` → constrained decoding (**yalnızca desteklenen modellerde**) | Yalnızca `json_object` — **şema garantisi YOK** | Strict Structured Outputs / responseSchema |
| **Kompleksite** | OpenAI-uyumlu → `openai` SDK, `baseURL` değişimi | OpenAI-uyumlu → **aynı** SDK | Kendi resmî SDK'sı |
| **Ölçeklenebilirlik** | Ücretsiz kota **sert tavan** | Ödemeli, tavansız | Ödemeli, tavansız |
| **Bakım** | Açık kaynak model kataloğu; adlar/destek değişebilir | Tek sağlayıcı takibi | En olgun |
| **Realtime ses** | Çift yönlü oturum **yok** | **Yok** | Var |

### Belirleyici Eksen: Maliyet (eleyici)

Maliyet burada bir ödünleşim ekseni değil, bir **kapı**: sıfır olmayan her seçenek elenir.
Bu, C) grubunu tümüyle dışarıda bırakır.

Kalan iki seçenek arasında **Groq'un birincil** olmasının nedeni şema garantisidir —
FR-007 "doğrulamayı geçmeyen yanıt kaydedilmez" diyor ve Groq `strict: true` ile bunu
sağlayıcı düzeyinde sağlıyor. **DeepSeek'in tümüyle elenmemesinin** nedeni Groq'un ücretsiz
katman kotası: kota dolduğunda tek sağlayıcılı kurulum tamamen durur.

Yedek yolun **maliyeti neredeyse sıfır**, çünkü her iki sağlayıcı da OpenAI-uyumlu API
sunuyor: tek `openai` npm SDK'sı, yalnızca `baseURL` + `apiKey` + `model` değişerek ikisine
de bağlanıyor. İkinci bir SDK, ikinci bir istemci katmanı veya ayrı adapter sınıfı gerekmiyor.
Bu teknik gerçek olmasaydı tek sağlayıcıda kalınırdı.

Diğer eksenler ayrıştırıcı olmadı: performans üçünde de 30 sn bütçesinin çok altında;
ölçeklenebilirlik bu ölçekte bağlayıcı değil; kompleksite iki ücretsiz seçenekte eşit.

### Sözlü Mod — Bu Kararın Kabul Edilmiş Bedeli

Ne Groq ne DeepSeek çift yönlü realtime konuşma oturumu sunuyor. ADR-0006'te belirleyici
eksen tam da buydu; ücretsizlik kısıtı o ekseni **karşılanamaz** hâle getirdi.

Sözlü mod bu dilimin kapsamında **değil**. ✅ **Karara bağlandı — ADR-0010:** tarayıcı
Web Speech API (istemci tarafı STT + TTS), `002-interview` kapsamında. Maliyet sıfır,
sunucu sözleşmesi değişmiyor, ikinci token/maliyet kaynağı doğmuyor. Bedeli tarayıcı
bağımlılığıdır (Chrome/Edge); desteklenmeyen tarayıcıda sözlü mod UI'da devre dışı
gösterilir. `docs/PLAN.md` ve `docs/TECH_STACK.md` güncellendi.

### Sonuçlar / Etkiler

- `docs/TECH_STACK.md` → **Groq (birincil) + DeepSeek (yedek)**. Sözlü mod bu ADR'de
  çözülmedi; ✅ ayrıca **ADR-0010** (tarayıcı Web Speech API) ile `002-interview`
  kapsamında karara bağlandı.
- **Tek SDK:** `openai` npm. `.env`: `LLM_PROVIDER` (`groq` | `deepseek`), `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL`. Anahtarlar koda gömülmez; `.env.example` paylaşılır.
- Tek OpenAI-uyumlu adapter yeterli; sağlayıcı farkı **yapılandırma verisidir**, ayrı sınıf
  değil. Yalnızca şema iletim biçimi dallanır (`json_schema+strict` ↔ `json_object`).
- `TokenUsage.provider` → `groq` / `deepseek`.
- **Model seçimi henüz açık:** implementasyon başlarken spike ile (a) `strict` desteği ve
  (b) Türkçe rapor kalitesi ölçülecek. `LLM_MODEL` `.env`'den geldiği için değişim tek satır.

**Kaynaklar (Temmuz 2026):**
[Groq Structured Outputs — GroqDocs](https://console.groq.com/docs/structured-outputs) ·
[DeepSeek JSON Output](https://deepseekai.guide/api/deepseek-api-json-mode/) ·
[DeepSeek API Pricing — BenchLM](https://benchlm.ai/deepseek/api-pricing) ·
[DeepSeek API Pricing — TLDL](https://www.tldl.io/resources/deepseek-api-pricing).
Elenen ücretli sağlayıcıların fiyat karşılaştırması: `docs/DECISIONS.md` ADR-0006.

---

## §2 — LLM Yanıt Şeması: Doğrulama Yaklaşımı

### Karar

**Zod şeması tek kaynak (single source of truth).** Aynı şemadan iki çıktı türetilir:

1. `zod-to-json-schema` ile JSON Schema üretilip sağlayıcının structured-output
   parametresine verilir (sağlayıcı üretim sırasında şemaya uymaya zorlanır).
2. Dönen yanıt **aynı Zod şemasıyla** `safeParse` edilerek runtime'da doğrulanır.

Doğrulama başarısızsa yanıt kaydedilmez; `SchemaError` fırlatılır ve FR-008 gereği kullanıcıya
hata + "tekrar dene" sunulur.

### Gerekçe

- **Tek tanım, iki kullanım.** Şemayı bir kez yazıyoruz; prompt tarafı ile doğrulama tarafı
  yapısal olarak ayrışamaz. Elle yazılmış JSON Schema + ayrı doğrulama kodu, iki tanımın
  zamanla birbirinden kopmasına açıktır.
- **TypeScript tipi bedava gelir.** `z.infer<typeof schema>` ile rapor tipi otomatik türer;
  servis, controller ve frontend istemcisi aynı tipi paylaşır.
- **Sağlayıcı garantisi tek başına yeterli değildir.** Structured output "genelde uyar"
  garantisidir; ağ hatası, kesilmiş yanıt veya sağlayıcı tarafı değişiklik hâlâ mümkün.
  İlke VI "dönen yanıt bu şemaya göre doğrulanır" diyor — sunucu tarafı doğrulama zorunlu.
- `zod` auth diliminde zaten bağımlılık; eklenen tek yeni paket `zod-to-json-schema`.

### Değerlendirilen Alternatifler

| Alternatif | Neden seçilmedi |
|-----------|-----------------|
| Elle yazılmış JSON Schema + `ajv` | İki ayrı tanım (şema + TS tipi) senkron tutulmalı; yeni bir doğrulama kütüphanesi eklenir |
| Sadece sağlayıcı garantisine güvenmek, doğrulama yok | İlke VI'ya aykırı; kesilmiş/bozuk yanıt sessizce kaydedilir |
| Sadece runtime doğrulama, sağlayıcıya şema vermemek | Şema uyumsuzluk oranı ve dolayısıyla boşa giden çağrı/maliyet artar |

---

## §3 — Hız Sınırı Uygulaması (FR-013: 5 çağrı / saat / kullanıcı)

### Karar

`@nestjs/throttler` üzerine kurulu, **kullanıcı kimliğiyle anahtarlanan** özel bir guard:
`ttl: 3600`, `limit: 5`, `getTracker()` → `request.user.id`. Guard yalnızca üretim
uç noktasına (`POST /pre-assessments`) uygulanır; okuma uç noktaları sınırsızdır (FR-013
"mevcut aktif rapora erişimi engellenmez").

Sayaç **çağrı denemesi** üzerinden artar — sonuç başarılı da olsa başarısız da (FR-013
"maliyeti doğuran çağrının kendisidir"). Sınır aşıldığında `429` + `details.retryAfterSeconds`
döner; frontend bu değeri kullanıcıya "X dakika sonra tekrar deneyebilirsiniz" olarak gösterir.

### Gerekçe

- `@nestjs/throttler`, auth dilimi FR-017 (başarısız giriş throttling) için **zaten
  ekleniyor** — yeni bağımlılık yok.
- Varsayılan throttler IP bazlıdır; bu gereksinim kullanıcı bazlı olduğu için tek yapılan
  `getTracker()` metodunu override etmek — birkaç satır.
- Bellek içi depolama bu ölçek için yeterli. Çok örnekli (multi-instance) dağıtımda sayaç
  örnek başına tutulur; kullanıcı teorik olarak örnek sayısı kadar çağrı yapabilir.
  Şu anki dağıtım tek örnek olduğu için kabul edilebilir.

> `ponytail:` Bellek içi throttler depolaması — tek örnekli dağıtım varsayımı. Yatay
> ölçeklemeye geçilirse `@nest-lab/throttler-storage-redis` ile Redis'e taşınmalı.

### Değerlendirilen Alternatifler

| Alternatif | Neden seçilmedi |
|-----------|-----------------|
| `TokenUsage` tablosunu sayarak DB tabanlı sayaç | Her istekte ek sorgu; throttler zaten mevcut |
| Redis tabanlı sayaç | Bu ölçekte gereksiz altyapı; Redis şu an projede yok |
| Sınır koymamak | FR-013'ü ihlal eder; yeniden değerlendirme + tekrar dene maliyeti açık uçlu bırakır |

---

## §4 — Eşzamanlı Gönderim Koruması (FR-004: kullanıcı başına tek aktif kayıt)

### Karar

**PostgreSQL partial unique index** — veritabanı düzeyinde garanti:

```sql
CREATE UNIQUE INDEX pre_assessment_one_active_per_user
  ON "PreAssessment" ("userId")
  WHERE "isActive" = true;
```

Prisma karşılığı `data-model.md`'de. Uygulama katmanı ikinci eşzamanlı yazma denemesinde
gelen unique-violation hatasını (`P2002`) yakalar ve `409 Conflict` döner. Yeniden
değerlendirmede eski kaydın `isActive = false` yapılması ile yeni kaydın eklenmesi **tek
transaction** içinde yapılır.

### Gerekçe

- **Doğruluk uygulamada değil, veritabanında.** Uygulama düzeyinde "önce kontrol et, sonra
  yaz" mantığı iki eşzamanlı istekte yarış koşuluna (race condition) açıktır — SC-007
  "hiçbir koşulda" diyor.
- Partial index, arşivlenmiş (pasif) kayıtların sınırsız olmasına izin verirken yalnızca
  aktif olanı tekilleştirir — FR-009a'nın arşiv gereksinimiyle birebir örtüşür.
- Ek kod, ek kütüphane, ek altyapı gerektirmez; tek migration satırı.

### Değerlendirilen Alternatifler

| Alternatif | Neden seçilmedi |
|-----------|-----------------|
| Uygulama düzeyinde mutex/kilit | Yarış koşulu tek örnekte çözülür, çok örnekte çözülmez |
| Postgres advisory lock | Partial index zaten yeterli; ek karmaşıklık |
| `SELECT ... FOR UPDATE` | Aktif kayıt hiç yokken (ilk değerlendirme) kilitlenecek satır yok — koruma sağlamaz |
| Kuyruk (BullMQ vb.) ile tekilleştirme | Redis + worker altyapısı; bu ölçekte aşırı |

---

## Özet — Karara Bağlananlar

| # | Bilinmeyen | Karar |
|---|-----------|-------|
| 1 | LLM sağlayıcı | **Groq (birincil) + DeepSeek (yedek)** — eleyici eksen: maliyet sıfır olmalı. Tek `openai` SDK, iki `baseURL`. **ADR-0007** (ADR-0006'in yerine geçti). Model seçimi spike'a bağlı. |
| 2 | Şema doğrulama | Zod tek kaynak → `zod-to-json-schema` ile sağlayıcıya; yanıt aynı şemayla runtime doğrulanır |
| 3 | Hız sınırı | `@nestjs/throttler` + `getTracker()` override (userId), 5/3600 sn, yalnızca üretim uç noktasında |
| 4 | Eşzamanlılık | PostgreSQL partial unique index (`WHERE isActive`), `P2002` → `409` |

Açık `[NETLEŞTİRİLECEK]` kalmadı.
