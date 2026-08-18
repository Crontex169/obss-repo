# Sözleşme: Görüşme HTTP API

**Dilim**: `002-interview` | **Taban yol**: `/api/interviews` (NestJS `InterviewModule`)

Bu belge, Görüşme dilimine ait HTTP uç noktalarını **sözleşme** (girdi/çıktı + davranış)
olarak tanımlar; entegrasyon testlerine eşlenir (ATDD, İlke III). Tüm yanıtlar
`application/json` (PDF yükleme `multipart/form-data`). Tüm uç noktalar, 001-auth-rol
dilimindeki `SessionGuard` ile korunur (oturum yoksa `401`) ve kaynak bazlı olanlar
ayrıca `OwnershipGuard` ile korunur (bkz. [interview-flow-rules.md](./interview-flow-rules.md)).

**Cross-cutting sözleşmeler** — bu belge yeniden tanımlamaz, referans verir
(`docs/API_CONVENTIONS.md`):

| Konu | Kural | Bölüm |
|------|-------|-------|
| Hata zarfı | `{ statusCode, error, message, details? }` | §2 |
| Yabancı kayıt | **`404`** (asla `403` — varlık gizliliği) | §1 |
| Dil | `Accept-Language` → `tr`\|`en`; gövdede taşınmaz | §4.2 |
| LLM timeout | varsayılan 30 sn; **rapor üretimi 60 sn** | §3.2 |
| LLM hata → HTTP | `LlmTimeoutError`→`504`, `LlmSchemaError`/`LlmProviderError`→`502` | §3.4 |
| Hız sınırı | uç nokta başına saatlik üst sınır, aşımda `429` | §3.5 |
| Soft-delete | sahibinde görünmez (`404`), admin'de "silindi" işaretli | §4.3 |

---

## 1. Görüşme Oluşturma (İş İlanı Girişi + Soru Üretimi)

`POST /api/interviews`

**Guard zinciri**: `SessionGuard` → `LlmRateLimitGuard(3/saat)` *(FR-022, §3.5)*

**İstek gövdesi** (`multipart/form-data` — PDF varsa; aksi halde `application/json`):
```json
{
  "jobPostingSource": "text | pdf",
  "jobPostingText": "string (jobPostingSource=text ise zorunlu)",
  "jobPostingFile": "PDF dosyası (jobPostingSource=pdf ise zorunlu, azami 10 MB)",
  "questionCount": 8,
  "mode": "written | voice",
  "level": "intern | junior | senior",
  "adaptiveEnabled": false
}
```

Dil gövdede **taşınmaz**; `Accept-Language` başlığından çözümlenir ve
`Interview.language`'a yazılır (FR-020, §4.2).

**Kurallar**:
- `questionCount` **5-20** aralığında olmalı; dışındaysa `400` (FR-003).
- `level` zorunlu, `ExperienceLevel` enum'undan olmalı; değilse `400` (FR-003, FR-021).
  Frontend bu alanı kullanıcının aktif ön değerlendirmesinden **ön-doldurabilir** —
  sunucu tarafında ön değerlendirme **zorunlu değildir** (FR-021, SC-013).
- `jobPostingSource="pdf"` ise dosya azami **10 MB**, yalnızca `application/pdf`; metin
  çıkarılamazsa `422` (FR-002).
- `jobPostingText` boşsa veya yalnızca boşluk ise `400` (FR-001, edge case).
- Başarıda: `Interview(status="in_progress", reportStatus="not_applicable")` oluşturulur,
  LLM ile **tam olarak N** adet `Question` üretilir (FR-004, FR-005). Yazılı modda karışık
  tip; sözlü modda yalnızca `open_ended` (FR-004, Netleştirmeler).
- Aynı LLM yanıtında **pozisyon adı** da döner ve `Interview.position`'a yazılır; ilandan
  çıkarılamazsa `null` kalır ve görüşme yine oluşturulur (FR-023, SC-011). **Ayrı LLM
  çağrısı yapılmaz.**
- Yine aynı yanıtta her soru için `tip`/`rationale` (isteğe bağlı, `null` olabilir) döner —
  İpucu & Rehberlik paneli bu alanları kullanır (FR-031, `interview-flow-rules.md` §4.1).
  Bu alanlar `currentQuestion` içinde ve `GET /:id`'nin `currentQuestion`/`answeredPairs`
  yanıtlarında da bulunur (§3).
- **Soru sayısı garantisi:** N uyumsuzluğu katman-2 Zod doğrulamasında yakalanır
  (`minItems`/`maxItems` sağlayıcı şemasına gönderilmez — §3.3) → `LlmSchemaError` →
  `Interview` **oluşturulmaz** (`502`).
- LLM soru üretimi hata/zaman aşımı verirse → `Interview` **oluşturulmaz**, `502`/`504`
  ve tekrar deneme imkânı sunan hata mesajı (FR-019, Hikâye 1 kriter 5).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `201` | Görüşme oluşturuldu; gövdede `interview` özeti (`position`, `level`, `language` dahil) + ilk soru (`currentQuestion`) |
| `400` | Doğrulama hatası (N aralığı, boş metin, geçersiz `level`, desteklenmeyen dosya türü) |
| `422` | PDF'ten metin çıkarılamadı |
| `429` | Saatlik sınır aşıldı (3/saat) — `details.retryAfterSeconds` (FR-022) |
| `502` | LLM sağlayıcı hatası veya şema/soru sayısı uyumsuzluğu — görüşme oluşturulmadı, `details.retryable: true` |
| `504` | LLM zaman aşımı (30 sn) — görüşme oluşturulmadı, `details.retryable: true`, tekrar deneyin |

**Gherkin eşlemesi**: Hikâye 1 kriter 1,2,3,4,5.

---

## 2. Görüşme Listesi (Interview History)

`GET /api/interviews`

- Yalnızca **oturumdaki kullanıcıya ait** görüşmeleri döner (FR-017); admin için tüm
  kullanıcıların görüşmeleri (okuma) — 001-auth-rol `authz-rules.md` R3.
- **Soft-delete filtresi (§4.3):** `role=user` için `deletedAt != null` kayıtlar listede
  **yer almaz**. `role=admin` için yer alır ve `deletedAt` alanı yanıtta döner
  (admin UI "silindi" işaretini bundan üretir). Kayıt fiziksel olarak silinmez.
- Yanıt: özet liste (`id`, `position`, `status`, `reportStatus`, `mode`, `level`,
  `language`, `questionCount`, `createdAt`, `completedAt`; admin için ek olarak
  `deletedAt` ve `userId`); tam soru/cevap/rapor içeriği bu uç noktada **yer almaz**.
  `position` dashboard kartının başlığıdır (`docs/APP_FLOW.md` §6).
- Bu uç nokta, `004-history` diliminde inşa edilecek "Interview History"
  ekranının veri temelidir (spec Kapsam Notu). **Silme uç noktası ve meslek filtresi
  parametreleri kapsam dışıdır** — bu dilim yalnızca yukarıdaki görünürlük kuralını uygular.

**Yanıtlar**: `200` liste (boşsa `[]`).

---

## 3. Görüşme Detayı / Devam Etme (Resume)

`GET /api/interviews/:id`

- `OwnershipGuard`: `interview.userId !== request.user.id` (ve admin değilse) → **`404`**
  (asla `403` — `403` kaydın var olduğunu açığa çıkarır, §1). "Sahip değil" ile "yok"
  yanıtları **birebir aynıdır**; içerik sızdırılmaz (FR-017, Hikâye 3 kriter 3).
- `status="in_progress"` ise: yanıt, önceki cevaplanmış soru/cevap çiftlerini **değişmeden**
  ve şu anki (`currentQuestionOrder`) cevaplanmamış soruyu içerir; sonraki sorular
  **döndürülmez** (FR-009, FR-006).
- `status="completed"` ise: tüm soru/cevap çiftleri ve (varsa) `reportStatus`/`Report`
  döner; `reportStatus="ready"` ise rapor içeriği **yeniden LLM çağrısı yapılmadan**
  aynı kayıttan döner (FR-014, SC-007).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Görüşme detayı (moduna göre yukarıdaki içerik) |
| `404` | Sahip değil **veya** kayıt yok — ayırt edilemez (§1) |

**Gherkin eşlemesi**: Hikâye 3 kriter 1,2,3,4.

---

## 4. Aktif Soruya Cevap Gönderme

`POST /api/interviews/:id/answers`

**Guard zinciri**: `SessionGuard` → `InterviewOwnershipGuard` → `LlmRateLimitGuard(60/saat)`
*(FR-022, §3.5 — adaptif akışın ürettiği LLM çağrılarına kaba güvenlik ağı)*

**İstek gövdesi**:
```json
{ "questionOrder": 3, "content": "string (serbest metin veya seçilen seçenek; süre dolduysa boş)" }
```

**Kurallar**:
- `questionOrder`, ilgili görüşmenin **`currentQuestionOrder`**'ı ile eşleşmeli; eşleşmezse
  (zaten cevaplanmış veya henüz sırası gelmemiş) `409` (FR-006, FR-007, Hikâye 2 kriter 3,4).
- Soru `type="multiple_choice"` ve `content` **boş değilse**, `content` o sorunun `options`
  listesinden biri olmalı; değilse `400` (FR-008, Hikâye 2 kriter 5).
- `content: ""` **geçerlidir** — istemci geri sayımı bittiğinde girdi olmadan gönderir
  (FR-027). Sunucu süreyi ölçmez/zorlamaz; boş cevabı normal kaydeder ve
  `currentQuestionOrder`'ı ilerletir.
- Sözlü modda `content`, istemci tarafında ses-metne çevrilmiş metindir; sunucu için
  yazılı moddan farksız işlenir (research.md §6).
- Başarıda cevap kaydedilir (immutable — bir daha değiştirilemez):
  - Sıradaki soru varsa (`order+1`) ve `adaptiveEnabled=true` ise, sistem eşzamanlı
    olarak cevabı değerlendirip sıradaki soruyu uyarlamaya çalışır; LLM hata/zaman
    aşımı verirse **baseline soru değişmeden** kullanılır (FR-011, research.md §4).
    Yanıtta yeni aktif soru (`currentQuestion`) döner.
  - Son soru (`order=N`) ise: `Interview.status="completed"`, **`completedAt=now()`** ve
    `reportStatus="pending"` olur; rapor üretimi **eşzamanlı** tetiklenir (FR-012, FR-013,
    FR-024). Rapor LLM çağrısı **60 sn** timeout ile yapılır (SC-005, §3.2 — varsayılan
    30 sn bu çağrı için override edilir). Yanıtta rapor sonucu (`report` veya
    `reportStatus="failed"` + hata bilgisi) döner.

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Cevap kaydedildi; gövdede sıradaki soru **veya** (son soruysa) rapor/`reportStatus` |
| `400` | Geçersiz çoktan seçmeli seçenek |
| `409` | Sıra dışı / zaten cevaplanmış soru |
| `429` | Saatlik sınır aşıldı (60/saat) — `details.retryAfterSeconds` (FR-022) |
| `404` | Sahip değil veya kayıt yok — ayırt edilemez (FR-017, §1) |

**Gherkin eşlemesi**: Hikâye 2 kriter 1,2,3,4,5; Hikâye 4 kriter 1,2,3,4; Hikâye 5 kriter 1,4.

---

## 5. Değerlendirme Raporunu Getirme

`GET /api/interviews/:id/report`

- Yalnızca `status="completed"` bir görüşme için geçerlidir.
- `reportStatus="ready"` → kaydedilmiş `Report` döner (LLM'e **tekrar gidilmez** — FR-014, SC-007).
- `reportStatus="pending"` → `202` (üretim sürüyor/senkron akışta nadiren yakalanabilir).
- `reportStatus="failed"` → `Report` yok; hata bilgisi + yeniden deneme talimatı döner (FR-015).
- Sahiplik: yalnızca görüşme sahibi (veya admin, okuma) erişebilir; aksi halde **`404`**
  (FR-017, Hikâye 5 kriter 5, §1).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Rapor içeriği (Genel İzlenim, Güçlü/Geliştirilmesi Gereken Yönler, 3 eksen skor) |
| `202` | Rapor üretimi sürüyor |
| `409` | Rapor üretimi başarısız oldu (`reportStatus="failed"`) — `retry` uç noktasını kullanın |
| `404` | Sahip değil veya kayıt yok — ayırt edilemez (§1) |

**Gherkin eşlemesi**: Hikâye 5 kriter 1,2,3,5.

---

## 6. Rapor Üretimini Yeniden Deneme

`POST /api/interviews/:id/report/retry`

**Guard zinciri**: `SessionGuard` → `InterviewOwnershipGuard` → `LlmRateLimitGuard(5/saat)`
*(FR-022, §3.5)*

- Yalnızca `status="completed"` ve `reportStatus="failed"` iken geçerlidir; aksi halde `409`.
- Rapor LLM çağrısı **60 sn** timeout ile yapılır (SC-005, §3.2).
- Tüm soru-cevap çiftleri yeniden LLM'e gönderilir; başarılı olursa `Report` oluşturulur ve
  `reportStatus="ready"` olur; cevaplanmış sorular/cevaplar bu süreçte **korunur** (FR-015).

**Yanıtlar**: `200` (rapor üretildi) / `502` (sağlayıcı/şema hatası) / `504` (60 sn zaman
aşımı) — ikisinde de `reportStatus="failed"` kalır ve **veri kaybı olmadan** tekrar
denenebilir / `409` (uygulanamaz durum) / `429` (saatlik sınır, 5/saat) / `404` (sahip değil
veya yok).

**Gherkin eşlemesi**: Hikâye 5 kriter 4.

---

## 7. İpucu & Rehberlik Paneli — Görüntüleme Olayı Logu

`POST /api/interviews/:id/panel-events`

**Guard zinciri**: `SessionGuard` → `InterviewOwnershipGuard` *(LLM çağrısı yok — hız
sınırı/`TokenUsage` kapsamı dışında, `contracts/interview-flow-rules.md` §4.4)*

**İstek gövdesi**:
```json
{ "questionOrder": 3, "tab": "hint | rationale" }
```

**Kurallar**:
- Yalnızca **yapılandırılmış log satırı** yazılır (`interviewId`, `userId`, `questionOrder`,
  `tab`); ayrı bir veritabanı tablosu yok, herhangi bir rapor/istatistik sorgusuna
  **dahil edilmez** (FR-034, Kapsam Dışı).
- `questionOrder` pozitif tam sayı; `tab` yalnızca `"hint"` veya `"rationale"` olabilir,
  aksi halde `400`.
- Bu uç nokta **hiçbir görüşme/soru/rapor alanını değiştirmez** — salt telemetri; başarısız
  olsa bile (örn. loglama hatası) kullanıcı akışını etkilemez.

**Yanıtlar**: `204` (kaydedildi) / `400` (geçersiz `tab`/`questionOrder`) / `404` (sahip
değil veya kayıt yok — §1).

**Gherkin eşlemesi**: Hikâye 6 kriter 3.

---

## Genel Hata Sözleşmesi

- Sahiplik/yetki hataları içerik sızdırmaz: yabancı kayıt **daima `404`**, rol yetersizliği
  `403` (FR-017, SC-006 — `docs/API_CONVENTIONS.md` §1, 001-auth-rol `authz-rules.md` R2'nin
  bıraktığı seçim burada kapatıldı).
- Hata gövdesi ortak zarfı kullanır (§2); iç hata metni/sağlayıcı yanıtı **asla** dönmez.
- LLM kaynaklı hatalar (`502/504`) her zaman **veri kaybı olmadan** tekrar deneme imkânı
  sunar (FR-019, FR-015, SC-008).
- Sunucu tarafı doğrulama zorunlu; istemci tarafı kontroller (soru sırası, dosya türü/boyutu)
  yalnızca UX içindir ve baypas edilebilir kabul edilir (İlke V).
