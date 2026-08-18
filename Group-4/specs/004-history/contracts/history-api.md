# Sözleşme: Interview History HTTP API

**Dilim**: `004-history` | **Taban yol**: `/api/interviews` (mevcut NestJS `InterviewModule`
içine eklenir — bu dilim yeni bir modül **açmaz**, mevcut controller'a bir uç nokta ekler)

Bu belge yalnızca bu dilimin **yeni** olarak eklediği uç noktayı (`DELETE`) tanımlar ve
diğer ikisini (`GET` liste, `GET` detay) **sözleşme değişikliği yapmadan** referans verir.
`specs/002-interview/contracts/interview-api.md` dosyası **değiştirilmez** (görev kısıtı);
bu belge onun üzerine eklenen bir ek sözleşmedir.

**Cross-cutting sözleşmeler** — bu belge yeniden tanımlamaz, referans verir
(`docs/API_CONVENTIONS.md`):

| Konu | Kural | Bölüm |
|------|-------|-------|
| Hata zarfı | `{ statusCode, error, message, details? }` | §2 |
| Yabancı/olmayan kayıt | **`404`** (asla `403`) | §1 |
| Soft-delete görünürlüğü | sahibinde görünmez (`404`), admin'de "silindi" işaretli | §4.3 |

---

## 1. Görüşme Listesi (referans — DEĞİŞTİRİLMEDİ)

`GET /api/interviews`

Sözleşme sahibi: `specs/002-interview/contracts/interview-api.md` §2. Bu dilim bu uç
noktayı **olduğu gibi** kullanır (Hikâye 1 — kart listeleme). Zaten uyguladığı kurallar:
yalnızca oturumdaki kullanıcıya ait, `deletedAt=null` kayıtlar (soft-delete filtresi);
özet alanlar (`id`, `position`, `status`, `createdAt`, ...).

**Bu dilimin frontend'de yaptığı ek iş** (backend sözleşmesi değişmez):
- Kartlarda `status` → rozet eşlemesi: `in_progress` → "Yarım Kaldı", `completed` →
  "Tamamlandı" (FR-002). Kullanıcı listesinde "Silindi" rozeti **hiç görünmez** çünkü
  soft-delete edilmiş kayıtlar zaten yanıtta yer almaz (§4.3) — ek bir istemci filtresi
  gerekmez.
- Yanıt zaten `createdAt` DESC sıralı **değilse**, istemci tarafında sıralama uygulanır
  (FR-003); sunucu sözleşmesi sıralama garantisi vermiyorsa bu güvenlik ağıdır.

---

## 2. Görüşme Detayı / Devam Etme (referans — DEĞİŞTİRİLMEDİ)

`GET /api/interviews/:id`

Sözleşme sahibi: `specs/002-interview/contracts/interview-api.md` §3. Bu dilim bu uç
noktayı hem "Devam Et" (Hikâye 2) hem "Detay" (Hikâye 3) akışları için **olduğu gibi**
kullanır.

**Bu dilimin frontend'de yaptığı yönlendirme mantığı** (research.md §3):

| Yanıttaki `status` | Frontend davranışı |
|---------------------|----------------------|
| `in_progress` | Soru-cevap ekranına yönlendirir; dönen içerikteki cevaplanmış soru/cevap çiftleri değişmeden gösterilir, `currentQuestionOrder`'a karşılık gelen soru aktif soru olarak sunulur (FR-005). |
| `completed` | Görüşme Detayı ekranına yönlendirir — kullanıcı "Devam Et" tetiklese bile (FR-014, Hikâye 2 kriter 3: başka cihazda tamamlanmış olma durumu). Tüm soru/cevap + `reportStatus`/`Report` gösterilir (FR-007). `reportStatus="failed"` ise rapor bölümünde "rapor oluşturulamadı" bilgisi gösterilir; sessiz başarısızlık yok (FR-008). |
| `404` yanıtı | "Kayıt bulunamadı" hata ekranı; sahiplik/varlık bilgisi ayırt edilmeden aynı mesaj (FR-009, `API_CONVENTIONS.md` §1). |

---

## 3. Görüşmeyi Silme (soft-delete) — YENİ, bu dilimin sorumluluğu

`DELETE /api/interviews/:id`

**Guard zinciri**: `SessionGuard` → `InterviewOwnershipGuard` (001-auth-rol /
002-interview'den **yeniden kullanılır** — yeni bir guard yazılmaz).

**Davranış**:
- `interview.userId !== request.user.id` (veya kayıt yok) → **`404`** — "sahip değil"
  ile "yok" ayrımı yapılmaz (FR-009, `API_CONVENTIONS.md` §1).
- Kayıt bulunur ve sahibi eşleşirse: `Interview.deletedAt = now()` yazılır (fiziksel
  silme **yok** — İlke VI). `status`/`reportStatus`/sorular/cevaplar/rapor **değişmeden**
  korunur; yalnızca `deletedAt` doldurulur (FR-011).
- **Idempotency (2026-08-03 netleştirmesi, implementasyon sırasında bulundu)**: FR-013
  iki kabul edilebilir sonuçtan **birini** ister: "idempotent davranış **veya** kayıt
  bulunamadı". Bu uç nokta `InterviewOwnershipGuard`'ı **değiştirmeden yeniden kullanır**
  (plan.md kararı); guard, sahip için `deletedAt` dolu kayıtları tüm metodlarda (GET
  dahil) zaten "yok" sayıp `404` döner — bu davranış DELETE için de **aynen** geçerlidir.
  Sonuç: ikinci silme isteği servise hiç ulaşmadan, guard seviyesinde **`404`** döner
  (FR-013'ün "veya kayıt bulunamadı" dalı). Bu, kullanıcı tarafında görünürlük açısından
  ilk `204` ile tutarlı bir sonuçtur (kayıt her iki durumda da artık erişilemez) ve
  guard'da özel bir "DELETE metodunda deletedAt'i görmezden gel" istisnası **açılmasını
  gerektirmez** — böylece 002-interview'in guard'ı gerçekten değişmeden kalır.
- Silinen bir görüşmenin `id`'siyle sonradan `GET /api/interviews/:id` veya
  `POST /api/interviews/:id/answers` çağrılırsa, o uç noktaların **kendi** soft-delete
  filtresi (§4.3, zaten `002-interview` tarafından uygulanıyor) devreye girer ve `404`
  döner (FR-011 sonucu, edge case: silinmiş göreve eski bağlantıyla erişim).

**Onay adımı**: Bu, **istemci tarafı** bir UX gereksinimidir (FR-010); backend sözleşmesi
onay adımını bilmez/zorlamaz — kullanıcı frontend'de `AlertDialog` ile onayladıktan
**sonra** bu istek gönderilir (research.md §5).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `204` | Görüşme yeni silindi (bu istekten önce `deletedAt` boştu) |
| `404` | Sahip değil, kayıt hiç yok, **veya zaten silinmiş** — üçü ayırt edilemez (§1, guard davranışı) |
| `401` | Oturum yok/geçersiz |

**Gherkin eşlemesi**: Hikâye 4 kriter 1, 2, 3, 5 (kriter 4 — onay vazgeçme — tamamen
istemci tarafı, bu uç nokta hiç çağrılmaz).

---

## Genel Hata Sözleşmesi

Bu dilimin tek yeni uç noktası (`DELETE`) da dahil, tüm hatalar
`docs/API_CONVENTIONS.md` §2 ortak zarfını kullanır; iç hata metni/stack trace asla
dönmez. Sahiplik/yetki hataları için `403` **kullanılmaz** — yabancı kayıt daima `404`
(§1, `002-interview/contracts/interview-api.md` "Genel Hata Sözleşmesi" ile birebir
tutarlı).
