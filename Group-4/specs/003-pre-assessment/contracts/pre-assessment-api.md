# Sözleşme: Ön Değerlendirme HTTP API

**Dilim**: `003-pre-assessment` | **Tarih**: 2026-07-30

Tüm uç noktalar `001-auth-rol`'ün oturum guard'ını gerektirir. Oturum açmamış istek
**daima** `401` döner (FR-001, Hikâye 4 kriter 1) — aşağıdaki tablolarda tekrar edilmez.

**Taban yol**: `/api/pre-assessments`

---

## Yetki Matrisi

| Uç nokta | Oturumsuz | `role=user` (sahip) | `role=user` (başkası) | `role=admin` |
|----------|-----------|---------------------|------------------------|--------------|
| `POST /pre-assessments` | 401 | ✅ oluşturur | — | **403** (salt okunur, FR-011a) |
| `GET /pre-assessments/active` | 401 | ✅ kendi aktif raporu | — | ✅ (`?userId=` ile) |
| `GET /pre-assessments` | 401 | ✅ kendi geçmişi | — | ✅ tümü (`?userId=` filtreli) |
| `GET /pre-assessments/:id` | 401 | ✅ kendisininse | **404** | ✅ okur |
| `PATCH` / `DELETE` | — | **yok** (uç nokta tanımlı değil) | — | — |

**Sızıntı önleme**: Başka bir kullanıcının kaydına erişim denemesi `403` değil **`404`**
döner — `403`, kaydın var olduğunu açığa çıkarır (Hikâye 4 kriter 2: "raporun içeriğini
sızdırmaz"). Admin için bu kural geçerli değildir.

**Admin salt okunur**: Admin `POST` yapamaz (403). Kayıt güncelleme/silme uç noktası
hiç tanımlı değildir; dolayısıyla Hikâye 4 kriter 5 yapısal olarak karşılanır.

---

## Ortak Hata Formatı

`001-auth-rol` ile aynı zarf kullanılır:

```jsonc
{
  "statusCode": 429,
  "error": "TooManyRequests",
  "message": "Saatlik değerlendirme sınırına ulaştınız.",
  "details": { "retryAfterSeconds": 1840 }   // opsiyonel, hataya özgü
}
```

`message` alanı **kullanıcıya gösterilebilir** ve `language` çözümlemesine (FR-017) uyar.
`details` içinde asla iç hata metni, stack trace veya sağlayıcı yanıtı bulunmaz.

---

## `POST /pre-assessments`

Yeni bir ön değerlendirme üretir. Senkron çalışır — LLM çağrısı istek içinde tamamlanır
(30 sn timeout, FR-008a).

**Guard zinciri**: `SessionGuard` → `RolesGuard(user)` → `LlmRateLimitGuard(5/saat)`

### İstek

```jsonc
{
  // --- ZORUNLU: meslek-bağımsız çoktan seçmeli (FR-002) ---
  "experienceYears": "y1_3",          // none|lt1|y1_3|y3_5|y5_10|y10plus
  "workStatus": "seeking",            // employed_full|employed_part|seeking|student
  "workPreference": "hands_on",       // hands_on|people|detail_routine|problem_solving|planning
  "teamPreference": "small_team",     // alone|small_team|large_team|leading|no_preference
  "learningStyle": "shown",           // shown|by_doing|written|video|mentorship
  "problemApproach": "ask_experienced", // self|ask_experienced|report_manager|research|team_discussion

  // --- ZORUNLU: 8 madde × 1-5 öz-değerlendirme (FR-002a) ---
  "selfRatings": {
    "dikkat_titizlik": 4, "ogrenme_hizi": 5, "iletisim": 3,
    "fiziksel_dayaniklilik": 4, "zaman_yonetimi": 3, "baski_altinda": 4,
    "sorumluluk": 5, "ekip_uyumu": 4
  },

  // --- OPSİYONEL ---
  "educationLevel": "high_school",    // primary|secondary|high_school|vocational|associate|bachelor|graduate
  "skills": ["forklift kullanımı", "iş güvenliği"],  // serbest + önerili (FR-002b)
  "openAnswers": {                    // FR-002c
    "enIyiOldugum": "...",
    "gelistirmekIstedigim": "...",
    "ikiYillikHedef": "..."
  }
}
```

**Doğrulama** (ihlalde `400`, LLM çağrılmaz — FR-003):
- Tüm zorunlu enum alanları tanımlı listede olmalı; `selfRatings` **tam 8 maddeyi**
  içermeli ve her puan `1`-`5` arası tam sayı olmalıdır.
- `skills`: en fazla **15 etiket**, etiket başına en fazla **40 karakter**; boş etiket
  reddedilir, tekrarlar tekilleştirilir.
- `openAnswers` alanlarının her biri en fazla **300 karakter**.
- Serbest metin alanlarındaki kontrol karakterleri ve sınırlayıcı taklidi diziler
  (`</aday_verisi>`) sunucu tarafında **temizlenir** (FR-012, `llm-contract.md` §3).

> **`experienceLevel` (intern/junior/senior) istekte GÖNDERİLMEZ** — sunucu bunu
> `experienceYears`'tan türetir (FR-002d). İstemci bu alanı gönderirse **yok sayılır**.

> ⚠️ **2026-08-04 kırıcı değişiklik:** eski istek gövdesi (`interestAreas`,
> `experienceLevel`, `skillSelections`) tamamen kaldırılmıştır — ön değerlendirme girdisi
> meslek-bağımsız hale getirildi (spec FR-002).

Dil gövdede **taşınmaz**; `Accept-Language` başlığından çözümlenir (FR-017).
`tr*` → `tr`, aksi halde `en`.

### Yanıtlar

| Kod | Durum | Gövde |
|-----|-------|-------|
| `201` | Rapor üretildi | `PreAssessmentWithReport` (aşağıda) |
| `400` | Enum dışı / eksik değer | Hata zarfı — **LLM çağrılmaz** (FR-003, SC-008) |
| `401` | Oturum yok | Hata zarfı |
| `403` | `role=admin` | Hata zarfı (FR-011a) |
| `409` | Eşzamanlı ikinci istek partial unique index'e takıldı | Hata zarfı (FR-004) |
| `429` | Saatlik 5 çağrı aşıldı | Hata zarfı + `details.retryAfterSeconds` (FR-013) |
| `502` | LLM sağlayıcı hatası / boş yanıt / şema uyumsuzluğu | Hata zarfı, `details.retryable: true` (FR-008) |
| `504` | LLM çağrısı 30 sn'yi aştı | Hata zarfı, `details.retryable: true` (FR-008a) |

`502` ve `504` durumlarında:
- `CompetencyReport` **yazılmaz** (FR-009).
- `PreAssessment` kaydı `status=failed`, `isActive=false` olarak kalır.
- Kullanıcının mevcut aktif raporu **değişmez** (Hikâye 2 kriter 5).
- `TokenUsage` `succeeded=false` ile **yine de yazılır** (FR-010).
- Yanıttaki `details.retryable: true`, frontend'in "tekrar dene" düğmesini göstermesi
  içindir (FR-008). Sunucu **kendiliğinden yeniden denemez** (FR-008b).

### `201` gövdesi — `PreAssessmentWithReport`

```jsonc
{
  "id": "clx...",
  "experienceYears": "y1_3",
  "workStatus": "seeking",
  "educationLevel": "high_school",
  "workPreference": "hands_on",
  "teamPreference": "small_team",
  "learningStyle": "shown",
  "problemApproach": "ask_experienced",
  "selfRatings": { "dikkat_titizlik": 4, "...": 0 },
  "skills": ["forklift kullanımı", "iş güvenliği"],
  "openAnswers": { "enIyiOldugum": "...", "gelistirmekIstedigim": "...", "ikiYillikHedef": "..." },
  "experienceLevel": "junior",          // TÜRETİLMİŞ (FR-002d) — yanıtta döner
  "language": "tr",
  "status": "completed",
  "isActive": true,
  "createdAt": "2026-07-30T12:00:00.000Z",
  "report": {
    "genelOzet": "...",
    "gucluYonler": ["...", "..."],
    "gelisimAlanlari": ["...", "..."],
    "calismaTarziOzeti": "...",
    "guvenSeviyesi": "orta"
  }
}
```

`report` öğrenme yol haritası alanı **taşımaz** (FR-006, 2026-08-03 clarify) — kişiye özel
yol haritası `002-interview`'de görüşme tamamlandığında üretilir. Ayrıca **mesleğe/sektöre
göre bölümlenmiş bir yapı da taşımaz** (2026-08-04 kapsam kararı — eski `alanlar` alanı
kaldırıldı).

`report` alanı yalnızca `status=completed` iken doludur; aksi halde `null`.
**Token/maliyet alanları bu yanıtta yer almaz** — kullanıcıya dönük değildir; admin
dilimi kendi uç noktasından raporlar.

---

## `GET /pre-assessments/active`

Kullanıcının aktif raporunu döner. **LLM çağrısı yapmaz** (Hikâye 2 kriter 1).

| Kod | Durum | Gövde |
|-----|-------|-------|
| `200` | Aktif rapor var | `PreAssessmentWithReport` |
| `204` | Hiç değerlendirme yok | Gövdesiz — frontend boş durum + formu gösterir (Hikâye 2 kriter 4) |

Admin `?userId=<id>` sorgu parametresiyle başka bir kullanıcının aktif raporunu okuyabilir
(FR-011a). `role=user` bu parametreyi gönderirse **yok sayılır** (kendi kaydı döner).

---

## `GET /pre-assessments`

Geçmişi tarihe göre azalan sırada listeler (FR-009a, Hikâye 2 kriter 3).

**Sorgu parametreleri**: `?limit=20&cursor=<id>` (cursor tabanlı sayfalama),
`?userId=<id>` (yalnızca admin).

`200` gövdesi:

```jsonc
{
  "items": [
    { "id": "clx...", "experienceYears": "y1_3", "workStatus": "seeking",
      "experienceLevel": "junior", "language": "tr", "status": "completed",
      "isActive": true, "createdAt": "2026-07-30T12:00:00.000Z" }
  ],
  "nextCursor": null
}
```

Liste **rapor içeriği taşımaz** (yalnızca metadata) — içerik `GET /:id` ile alınır.
`status=failed` kayıtlar listede **görünmez**; başarısız denemeler kullanıcının geçmişi
değildir (FR-009).

---

## `GET /pre-assessments/:id`

Tek bir raporu içeriğiyle döner.

| Kod | Durum |
|-----|-------|
| `200` | Sahibi veya admin — `PreAssessmentWithReport` |
| `404` | Kayıt yok **veya** başkasına ait (sızıntı önleme — yukarı bkz.) |

Arşivlenmiş rapor, üretildiği dilde döner; kullanıcının güncel dil tercihi uygulanmaz
(FR-019).

---

## Frontend Davranış Sözleşmesi

Bu bölüm UI'ın uyması gereken, spec'ten türeyen davranışları bağlar.

| Durum | Beklenen davranış | Gereksinim |
|-------|-------------------|-----------|
| İstek sürerken | İlerleme göstergesi; form kilitli; kullanıcı belirsiz bırakılmaz | FR-015, Hikâye 1 kriter 5 |
| `201` | Rapor ekranı + **"Bu rapor AI tarafından üretilmiştir"** rozeti + `guvenSeviyesi` görünür | FR-014 |
| `400` | Alan bazlı doğrulama hatası; hangi alanın eksik olduğu belirtilir | Hikâye 1 kriter 2 |
| `409` | "Zaten bir değerlendirme oluşturuluyor" — sayfa yenilendiğinde mevcut durum gösterilir | FR-004 |
| `429` | `details.retryAfterSeconds` değeri dakikaya çevrilip gösterilir; **mevcut rapor erişilebilir kalır** | FR-013 |
| `502` / `504` | Anlaşılır hata + **"Tekrar dene"** düğmesi; otomatik yeniden deneme YOK | FR-008, FR-008b |
| Rapor ekranı | Sayısal skor/grafik **gösterilmez**; öğrenme yol haritası ve mesleğe göre bölümlenmiş yapı **yok** | FR-006b, FR-006 |
| Geçmiş sekmesi | Tarihe göre azalan liste; her satır tıklanınca `GET /:id` | FR-009a |
| Form — zorunlu | 6 çoktan seçmeli (deneyim, durum, 4 çalışma tarzı) + 8 maddelik 1-5 ölçek; hiçbiri mesleğe özgü terim içermez | FR-002, FR-002a, SC-001a |
| Form — opsiyonel | Eğitim durumu; **yetenek etiketi girişi** (öneri listesinden seçim **ve** serbest yazım); 3 kısa açık uçlu alan — hepsi boş bırakılabilir | FR-002b, FR-002c |
| Form — sınırlar | Etiket sayısı/uzunluğu ve açık uçlu metin uzunluğu istemcide de sınırlanır (sunucu doğrulaması esastır) | FR-003 |
| Form — seviye | `experienceLevel` **sorulmaz**, kullanıcıya gösterilmez — sunucuda türetilir | FR-002d |
