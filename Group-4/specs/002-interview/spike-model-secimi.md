# T001 — LLM Model Seçimi Spike'ı

**Dilim**: `002-interview` · **Görev**: T001 (Faz 1, ilk görev) · **İlgili**: ADR-0007 / R4, R5

**Durum**: ✅ **TAMAMLANDI (2026-07-31)** — (a) `strict` desteği araştırmayla netleşti,
(b) Türkçe kalite **Groq Console üzerinden manuel** doğrulandı.

**KARAR: `LLM_MODEL = openai/gpt-oss-120b`**

**Amaç**: `LLM_MODEL` değerini netleştirmek. ADR-0007 sağlayıcıyı kilitledi (Groq birincil +
DeepSeek yedek), **modeli değil**. İki bilinmeyen vardı:

| # | Bilinmeyen | Kaynak | Durum |
|---|------------|--------|-------|
| a | Groq'ta hangi modeller `json_schema` + `strict: true` destekliyor? | ADR-0007 / R5 | ✅ **Cevaplandı** (aşağıda) |
| b | Seçilen modelin **Türkçe** üretim kalitesi yeterli mi? | ADR-0007 / R4 | ✅ **Doğrulandı** — `gpt-oss-120b` kalitesi kabul edildi |

---

## (a) `strict` desteği — CEVAPLANDI

Groq dokümantasyonuna göre constrained decoding (`strict: true`) **yalnızca iki modelde** var:

| Model | `strict: true` | Not |
|-------|:--------------:|-----|
| `openai/gpt-oss-20b` | ✅ | Daha küçük/hızlı aday |
| `openai/gpt-oss-120b` | ✅ | Daha güçlü aday |
| `openai/gpt-oss-safeguard-20b` | ❌ (yalnızca `strict: false`) | Aday değil |
| Diğer tüm Groq modelleri | ❌ | "En iyi çaba" — şema garantisi yok |

> **Sonuç:** `LLM_MODEL` adayları **`openai/gpt-oss-20b`** ve **`openai/gpt-oss-120b`** ile
> sınırlıdır. Bunların dışına çıkılırsa Groq yolu da DeepSeek yolu gibi davranır: sağlayıcı
> garantisi kaybolur, **tek garanti katman-2 Zod doğrulaması** kalır (ADR-0007 / R2, R5).

### Şema tasarımını etkileyen kısıtlar (önemli)

`strict: true` şemaya sert kurallar dayatıyor — **bu proje için yeni bir bulgu**:

| Kural | Bizdeki karşılığı |
|-------|-------------------|
| Tüm alanlar `required`; opsiyonel alan **desteklenmiyor** | Zod'da `.optional()` **kullanılmaz** |
| Opsiyonellik union ile: `"type": ["string","null"]` | Zod'da `.nullable()` (`z.string().nullable()`) |
| Her nesnede `additionalProperties: false` | Katman-1 üreticisi ekler (`schema-to-provider.ts`) |
| Desteklenen: primitifler, `object`, `array`, `enum`, `anyOf` | Başka JSON Schema yapısı kullanılmaz |
| `minLength`/`minItems`/`maxItems` güvenilmez | Zaten katman-1'den çıkarılıyor; sayı garantisi **katman-2'de** |
| Structured output + **streaming/tool-use birlikte çalışmaz** | İkisi de bu projede kullanılmıyor — bağlayıcı değil |

**Etkilenen görevler:** `002-interview` T050 (soru üretimi şeması), T075 (rapor şeması —
`additionalNotes` `.optional()` **değil** `.nullable()` olmalı), `003-pre-assessment` T019.
Kural `docs/API_CONVENTIONS.md` §3.3'e işlendi.

---

## (b) Türkçe kalite — DOĞRULANDI

### Nasıl doğrulandı

Ekip, **Groq Console** üzerinden `openai/gpt-oss-120b` modelini bu dilimin soru üretimi
senaryosuyla denedi ve üretilen Türkçe soruların kalitesini **kabul edilebilir buldu**
(2026-07-31, kullanıcı değerlendirmesi).

> **Kapsam notu:** Yukarıdaki 2026-07-31 kaydı manuel gözlemdir. Script **2026-08-04'te
> koşuldu** ve ölçüm aşağıya eklendi — manuel kararı bağımsız olarak doğruladı.

### Otomatik ölçüm (2026-08-04)

`model-spike.mjs`, `backend/.env` üzerinden iki bağımsız koşumda çalıştırıldı (`RUNS=1`).
Ham çıktı: `spike/sonuc-2026-08-04.json`.

| Model | gecerli-ilan | kisa-ilan | tarif (ret) | enjeksiyon (ret) | ort. süre |
|-------|--------------|-----------|-------------|------------------|-----------|
| `gpt-oss-120b` | ✅ ✅ | ✅ ✅ | ✅ ✅ | ✅ (2. koşum kotaya takıldı) | ~2,0-2,4 sn |
| `gpt-oss-20b` | ✅ ✅ | ❌ ❌ | ✅ ✅ | ✅ (2. koşum kotaya takıldı) | ~0,9-1,7 sn |

**Yanlış ret 0, kaçan ret 0** — her iki modelde, her koşumda. FR-028 ret eşiği doğru
kalibre; talimat enjeksiyonu vakası da reddedildi (Anayasa İlke V tuttu). Token sayıları
yanıtta döndü (`TokenUsage` alanları dolar). Türkçe akıcı ve ilana bağlı; 120b muhasebe
ilanında alan değiştirmeyi doğru yaptı (KDV/tahakkuk/bordro).

**`gpt-oss-20b` neden düştü (2/2 koşumda aynı vaka):**

```
code: json_validate_failed
failed_generation: max completion tokens reached before generating a valid document
```

Constrained decoding çökmedi — model **completion token tavanına çarptı**, JSON yarım
kaldı. `strict: true` altında yarım JSON kısmi sonuç değil, komple `400`.

### Bu ölçümün ortaya çıkardığı iki yeni iş

1. **`max_tokens` hiçbir yerde tanımlı değil** (`docs/`, `specs/` genelinde geçmiyor).
   N=6'da 120b `kisa-ilan` için 1682 output token harcadı — ilan kısa olunca model her
   şeyi uydurmak zorunda kaldığı için çıktı **uzuyor**. Spec N için 5-20 izin veriyor;
   doğrusal tahminle N=20 ≈ 5600 output token. Varsayılan tavan altında bu çağrı komple
   `400` döner ve **SC-002 (%100 N eşleşmesi) düşer**. Adapter ve `generateStructured`
   sözleşmesine açık `max_tokens` girmeli.
2. **Groq ücretsiz katman 8000 TPM, organizasyon geneli.** Sistem prompt'u tek başına
   ~1450 input token; bir N=6 üretimi ~3000-5000 token. Yani dakikada ~2 görüşme
   başlatma, **tüm uygulama için**. FR-022'nin "kullanıcı başına 3/saat" sınırı bu
   paylaşılan tavanı korumuyor. (`RUNS=3` bu yüzden koşulamıyor — kotaya takılıyor.)

### Karar

- **Seçilen `LLM_MODEL`:** **`openai/gpt-oss-120b`**
- **Gerekçe:**
  1. Groq'ta `strict: true` destekleyen iki modelden biri (şema garantisi — FR-007 için şart)
  2. Türkçe üretim kalitesi manuel değerlendirmede kabul edildi (ADR-0007 / R4 kapandı)
  3. İki aday arasında **daha güçlü** olanı; rapor metni kullanıcıya doğrudan gösterildiği
     için kalite tarafında hata payı bırakmak istenmedi
- **Yedek yol:** Groq ücretsiz katman kotası dolarsa veya servis erişilemezse `.env`
  üzerinden DeepSeek'e geçilir (ADR-0007 / R1). **DeepSeek'te `strict` yoktur** — o yolda
  tek garanti katman-2 Zod doğrulamasıdır.
- **İkincil aday:** `openai/gpt-oss-20b` — 2026-08-04 ölçümünde **elendi**: kısa ilan
  vakasında 2/2 koşumda completion token tavanına çarpıp `400` döndürdü. Daha hızlı
  (~0,9-1,7 sn) ve daha ucuz olduğu için kota baskısı doğarsa yeniden değerlendirilebilir,
  ancak **önce `max_tokens` açıkça ayarlanmalıdır** — o yapılmadan güvenilir değil.

### Script kullanımı (yeniden koşmak için)

```bash
# varsayılan: iki model x dört vaka, model başına tek koşum
GROQ_API_KEY=gsk_... node specs/002-interview/spike/model-spike.mjs

# tek model
MODELS="openai/gpt-oss-120b" GROQ_API_KEY=gsk_... node specs/002-interview/spike/model-spike.mjs
```

> `GROQ_API_KEY` yoksa script `LLM_API_KEY`'e düşer, yani `node --env-file=backend/.env ...`
> ile de koşulur.
>
> **`RUNS>1` ücretsiz katmanda koşulamaz** — 8000 TPM tavanına takılır ve sonuçlar
> `rate_limit_exceeded` ile dolar (bkz. T126). Tekrarlı ölçüm gerekiyorsa koşumlar
> arasında ~60 sn beklenmeli veya ücretli katmana geçilmeli.

Script **sıfır bağımlılıklıdır** (Node 20+ yerleşik `fetch`), API anahtarını **yalnızca
ortam değişkeninden** okur, hiçbir yere yazmaz. Ham çıktı `spike/sonuc-<tarih>.json`.

### Script ne ölçüyor

1. **Şema uyumu** — `strict: true` gerçekten çalışıyor mu: soru sayısı tam mı, `type` enum
   içinde mi, `multiple_choice` ise `options` ≥ 3 mü, `open_ended` ise `options` null mu,
   `position` alanı dönüyor mu (katman-2'nin yapacağı kontrollerin küçük bir taklidi)
2. **Yanıt süresi** — 30 sn timeout bütçesine göre pay
3. **Token kullanımı** — `TokenUsage` alanlarının gerçekten dolduğunu doğrular
4. **Kaba Türkçe sinyali** — Türkçe karakter/stopword sayımı (**insan değerlendirmesinin
   yerini tutmaz**, sadece "İngilizce üretmiş" durumunu yakalar)
5. **Geçersiz ilan ret kararı** (FR-026, SC-014) — 4 vaka koşulur:

   | Vaka | Beklenen |
   |------|----------|
   | `gecerli-ilan` | soru üret |
   | `kisa-ilan-yanlis-ret-freni` (kısa ama gerçek ilan) | soru üret |
   | `ilan-degil-tarif` (yemek tarifi) | `rejection="not_a_job_posting"`, soru yok |
   | `ilan-degil-talimat-enjeksiyonu` | ret + izolasyonun tutması |

   Özet satırında **yanlış ret** (geçerli ilanı reddetti) ve **kaçan ret** (reddetmesi
   gerekirken soru üretti) ayrı sayılır. Kontrol grubu olmadan bu ölçüm anlamsızdır —
   her şeyi reddeden bir model de ret testini "geçer".

Script gerçek prompt'u kullanıyor: sistem talimatı `contracts/interview-flow-rules.md`
§4.1.1 ile birebir aynıdır (yer tutucular `questionCount=6, mode=written, level=junior,
language=tr` ile doldurulmuş), iş ilanı `<ilan>` etiketleri içinde **veri olarak izole**
edilmiş ayrı mesaj rolünde gider (Anayasa İlke V, `API_CONVENTIONS.md` §5).

> ⚠️ **Bu koşumda cevaplanacak yeni bir bilinmeyen var:** `rejection` alanı
> `{"type": ["string","null"], "enum": ["not_a_job_posting", null]}` biçiminde
> tanımlandı. Groq `strict: true` altında **null içeren enum**'ın kabul edilip
> edilmediği doğrulanmadı. Sağlayıcı şemayı reddederse (HTTP 400), alan düz
> `["string","null"]`'a düşürülür ve enum kısıtı **yalnızca katman-2 Zod'da** kalır —
> nicelik kısıtlarında olduğu gibi (§3.3). Sonucu aşağıya yaz.

### Değerlendirme kriterleri (koşumdan sonra doldur)

| Eksen | `openai/gpt-oss-20b` | `openai/gpt-oss-120b` |
|-------|----------------------|------------------------|
| Şema uyumu (kaç/kaç) | | |
| Ortalama süre (ms) | | |
| Token (in/out) | | |
| Türkçe akıcılık (1-5, **gözle**) | | |
| İlana uygunluk (1-5, **gözle**) | | |
| Soru çeşitliliği (MC/açık uçlu dengesi) | | |
| `position` doğru çıkarıldı mı | | |
| **Yanlış ret** (geçerli ilanı reddetti, hedef 0) | | |
| **Kaçan ret** (ilan olmayanı kabul etti, hedef 0) | | |
| `strict` null'lu enum'u kabul etti mi (E/H) | | |

> Türkçe akıcılık ve ilana uygunluk **otomatik ölçülemez** — üretilen soruları okuyup
> puanla. Rapor metni kullanıcıya doğrudan gösterildiği için bu eksen belirleyicidir
> (ADR-0007 / R4).

### Karar (koşumdan sonra doldur)

- **Seçilen `LLM_MODEL`:** `_______________`
- **Gerekçe:** _______________
- **Yedek yol notu:** DeepSeek'e düşüldüğünde `strict` yoktur; katman-2 tek garantidir.

---

## Sonraki adımlar

1. ✅ Model seçildi: `openai/gpt-oss-120b`
2. ✅ `LLM_MODEL` değeri `.env.example`'a yazılacak → **T005** (Faz 1)
3. ✅ `docs/TECH_STACK.md` "Seçilen model" satırı güncellendi
4. Bulgu ADR-0007'yi **değiştirmiyor** (sağlayıcı kararı aynı); yalnızca model netleşti.
   Şema kısıtları bulgusu `docs/API_CONVENTIONS.md` §3.3'e işlendi.
5. ⏳ İzlenecek: Groq ücretsiz katman kotası. Kota/gecikme sorun olursa önce
   `openai/gpt-oss-20b`, sonra DeepSeek yedek yolu (ADR-0007 / R1).

**Kaynaklar:** [Groq Structured Outputs — GroqDocs](https://console.groq.com/docs/structured-outputs)
