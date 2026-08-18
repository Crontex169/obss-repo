# Sözleşme: Admin HTTP API

**Dilim**: `005-admin` | **Taban yol**: `/api/admin` (YENİ, bağımsız NestJS `AdminModule`)

Bu belge, Admin dilimine ait **3 yeni** HTTP uç noktasını **sözleşme** (girdi/çıktı +
davranış) olarak tanımlar; entegrasyon testlerine eşlenir (ATDD, İlke III). Tüm yanıtlar
`application/json`. Tüm uç noktalar **salt-okunurdur** (`GET` dışında hiçbir metod
tanımlanmaz — FR-008) ve `SessionGuard` → `RolesGuard('admin')` ile korunur.

Mevcut `GET /api/admin/ping` (`001-auth-rol`, `backend/src/auth/admin/admin.controller.ts`)
bu belgenin kapsamı dışındadır ve **değiştirilmez**; aynı `/api/admin` ön ekini paylaşan
ayrı bir controller'dır.

**Cross-cutting sözleşmeler** — bu belge yeniden tanımlamaz, referans verir
(`docs/API_CONVENTIONS.md`):

| Konu | Kural | Bölüm |
|------|-------|-------|
| Hata zarfı | `{ statusCode, error, message, details? }` | §2 |
| Oturum yok/geçersiz | `401` | §1 |
| Rol yetersiz (`user` → admin uç noktası) | `403` | §1 |
| Admin okuma erişimi | `200` (sahiplik kontrolü **yok** — admin tüm kayıtları okuyabilir) | §1, `authz-rules.md` R3 |
| Soft-delete görünürlüğü | admin'de **her zaman görünür**, "silindi" işaretli | §4.3 |

---

## 1. Görüşme Listesi (tüm kullanıcılar)

`GET /api/admin/interviews`

**Guard zinciri**: `SessionGuard` → `RolesGuard('admin')`

**Query parametreleri**:

| Parametre | Tip | Varsayılan | Açıklama |
|-----------|-----|------------|----------|
| `position` | `string` (opsiyonel) | — (filtre yok) | Meslek/pozisyon filtresi. Özel değer `"unspecified"` → `position IS NULL` kayıtları döner ("Belirsiz" kovası, FR-003) |
| `page` | `int ≥ 1` | `1` | 1-index sayfa numarası (FR-014) |
| `pageSize` | `int, 1-100` | `20` | Sayfa boyutu (Clarifications Q4) |

**Davranış**:
- Kullanıcı ayrımı yapılmaz; **tüm** kullanıcılara ait **tüm** görüşmeler döner —
  soft-delete edilmiş kayıtlar dahil, hiçbir zaman filtrelenmez (FR-002, FR-004).
- Varsayılan sıralama `createdAt` DESC.
- `position` parametresi verilmişse, yalnızca eşleşen (veya `"unspecified"` için `null`)
  kayıtlar döner; parametre yoksa tüm meslekler döner (FR-003).

**Yanıt gövdesi** (`200`):
```jsonc
{
  "items": [
    {
      "id": "string",
      "ownerEmail": "string",           // User.email (Clarifications Q2)
      "position": "string | null",
      "positionLabel": "string",        // null ise "Belirsiz" (research.md §3)
      "status": "in_progress | completed",
      "createdAt": "ISO-8601",
      "completedAt": "ISO-8601 | null",
      "deletedAt": "ISO-8601 | null"    // null değilse istemci "Silindi" rozeti gösterir (FR-004)
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Liste (kayıt yoksa `items: []`, `total: 0`) |
| `401` | Oturum yok/geçersiz |
| `403` | Rol `admin` değil |
| `400` | Geçersiz `page`/`pageSize` (aralık dışı) |

**Gherkin eşlemesi**: US1 kriter 1, 2, 3, 4.

---

## 2. Görüşme Detayı (herhangi bir kullanıcının)

`GET /api/admin/interviews/:id`

**Guard zinciri**: `SessionGuard` → `RolesGuard('admin')` (sahiplik kontrolü **yok** —
admin her kaydı okuyabilir, `authz-rules.md` R3).

**Davranış**:
- Kayıt `deletedAt != null` olsa da (soft-delete) içerik **eksiksiz** döner (FR-004, FR-005).
- Kayıt gerçekten yoksa `404` (varlık gizliliği burada geçerli değildir — admin zaten
  tüm kayıtlara erişebildiği için "sahip değil" ayrımı yoktur, yalnızca "yok" durumu
  vardır).
- `reportStatus` `"ready"` değilse (`not_applicable`/`pending`/`failed`), rapor alanı
  `null` döner ve `reportStatus` alanı istemcinin zarif durum göstermesi için kullanılır
  (FR-006) — iç hata metni/sağlayıcı yanıtı **asla** dönmez (`API_CONVENTIONS.md` §2).
- `tokenUsage` toplamı, o `interviewId`'ye ait tüm `TokenUsage` kayıtlarının
  (`succeeded=false` dahil, spec Assumptions) toplamıdır; hiç kayıt yoksa `null` döner
  ve istemci "maliyet bilgisi yok" gösterir (FR-007).

**Yanıt gövdesi** (`200`):
```jsonc
{
  "id": "string",
  "ownerEmail": "string",
  "position": "string | null",
  "positionLabel": "string",
  "status": "in_progress | completed",
  "mode": "written | voice",
  "level": "intern | junior | senior",
  "language": "tr | en",
  "createdAt": "ISO-8601",
  "completedAt": "ISO-8601 | null",
  "deletedAt": "ISO-8601 | null",
  "questions": [
    { "order": 1, "type": "multiple_choice | open_ended", "text": "string", "options": ["string"], "answer": "string | null" }
  ],
  "reportStatus": "not_applicable | pending | ready | failed",
  "report": {
    "overallImpression": "string",
    "strengths": ["string"],
    "improvementAreas": ["string"],
    "additionalNotes": ["string"],   // FR-005 "eksiksiz" — kullanıcı raporunda da gösterilen alan
    "technicalScore": 0,
    "behavioralScore": 0,
    "generalScore": 0,
    // Soru bazlı geri bildirim (issue #68 / #76) — aynı FR-005 gerekçesi:
    // kullanıcının raporunda görünen her şey admin detayında da görünür.
    // Alan eklenmeden önce üretilmiş raporlarda boş dizi.
    "questionFeedback": [
      { "order": 1, "verdict": "dogru | kismen | yetersiz", "correctAnswer": "string", "explanation": "string" }
    ]
  } /* | null */,
  "tokenUsage": { "totalTokens": 0, "estimatedCostUsd": "string" } /* | null */
}
```

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Görüşme detayı (silinmiş olsa da eksiksiz) |
| `401` | Oturum yok/geçersiz |
| `403` | Rol `admin` değil |
| `404` | Kayıt gerçekten yok |

**Gherkin eşlemesi**: US2 kriter 1, 2, 3, 4 (kriter 4 — yazma denemesi — bu uç noktaya
uygulanmaz; hiçbir yazma metodu tanımlı değildir, aşağıdaki "Salt-okunurluk" bölümüne bakınız).

---

## 3. İstatistikler

`GET /api/admin/stats`

**Guard zinciri**: `SessionGuard` → `RolesGuard('admin')`

**Query parametreleri**:

| Parametre | Tip | Varsayılan | Açıklama |
|-----------|-----|------------|----------|
| `tokenWindowDays` | `int, 1-90` | `30` | Günlük token zaman serisi penceresi (Clarifications Q3) |

**Davranış**:
- Tüm toplamlara (sayı, ortalama süre, oran, token) soft-delete edilmiş görüşmeler
  **dahildir** (Clarifications Q1, FR-009-012).
- Sistemde hiç görüşme/token kaydı yoksa hata fırlatılmaz; ilgili alanlar sıfır/boş
  değerlerle döner (FR-013).

**Yanıt gövdesi** (`200`):
```jsonc
{
  "countsByProfession": [
    { "position": "string | null", "label": "string", "count": 12 }
  ],
  "averageDurationSeconds": 754.2, // tamamlanmış görüşme yoksa null (FR-013)
  "completionRatio": { "completed": 30, "inProgress": 12 },
  "dailyTokenUsage": [
    { "date": "YYYY-MM-DD", "totalTokens": 0, "estimatedCostUsd": "0.000000" }
    // tokenWindowDays gün için sıfır doldurmalı, veri olmayan günler 0 (research.md §4);
    // estimatedCostUsd o günün tahmini maliyeti (USD), Decimal -> string (FR-010)
  ],
  "totalCostUsd": "0.000000" // penceredeki tüm günlerin tahmini maliyet toplamı (USD), string
}
```

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | İstatistikler (veri yoksa sıfır/boş değerlerle, hata yok) |
| `401` | Oturum yok/geçersiz |
| `403` | Rol `admin` değil |
| `400` | Geçersiz `tokenWindowDays` (aralık dışı) |

**Gherkin eşlemesi**: US3 kriter 1, 2, 3.

---

## Salt-okunurluk garantisi (FR-008, SC-005)

`AdminModule` hiçbir `POST`/`PATCH`/`PUT`/`DELETE` route'u **tanımlamaz**. Bu üç `GET`
uç noktası dışında `/api/admin/interviews*` altında başka bir HTTP metodu eşleşmez;
böyle bir istek NestJS router seviyesinde `404` alır (route yok). Frontend'de de admin
ekranlarında hiçbir düzenleme/silme aksiyonu **render edilmez** — istemci tarafı gizleme
tek başına yeterli sayılmaz (İlke V), gerçek garanti route'ların hiç var olmamasıdır.

## Genel Hata Sözleşmesi

- Tüm hatalar `docs/API_CONVENTIONS.md` §2 ortak zarfını kullanır; iç hata metni/
  sağlayıcı yanıtı/stack trace/SQL **asla** dönmez.
- Bu dilimde "sahip değil" ayrımı **yoktur** (admin her kaydı okuyabilir) — yalnızca
  `401` (oturum), `403` (rol) ve `404` (gerçekten yok) durumları vardır; §1'deki
  "varlık gizliliği" (403 vs 404 belirsizliği) kuralı bu dilime **uygulanmaz** çünkü
  admin zaten tüm kayıtlara meşru erişime sahiptir.
