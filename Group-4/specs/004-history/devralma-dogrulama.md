# Devralma Doğrulaması — `004-history` ↔ `002-interview` / `001-auth-rol`

**Amaç**: T001/T002'nin gerektirdiği kod incelemesi. `002-interview` ve `001-auth-rol`
gerçek implementasyonu artık merge edilmiş durumda (`005-interview-dikeyi-implementasyon`
+ `006-auth`), bu doğrulama o gerçek koda karşı yapıldı. **Salt-okunur inceleme** —
`002-interview`/`001-auth-rol` tarafında hiçbir dosya değiştirilmedi.

## T001 — `GET /api/interviews` ve `GET /api/interviews/:id` sözleşme uyumu

Kaynak: `specs/002-interview/contracts/interview-api.md` §2-3,
`backend/src/interview/interview.controller.ts`, `interview.service.ts`.

| Beklenen (history-api.md §1-2) | Gerçek implementasyon | Durum |
|---|---|---|
| `id`, `position`, `status`, `createdAt`, `completedAt`, `currentQuestionOrder`, `reportStatus` | `interview.service.ts` liste/detay yanıtında birebir mevcut | ✅ Uyumlu |
| Soft-delete filtresi (`deletedAt: null`, yalnızca kullanıcı listesi) | `interview.service.ts:470-474` `deletedAt: null` filtresi doğrulandı | ✅ Uyumlu |
| Yabancı/olmayan kayıt → her durumda `404` (403 değil, varlık gizliliği) | `InterviewOwnershipGuard` kasıtlı olarak `404` döndürüyor (bkz. T002) | ✅ Uyumlu |
| `currentQuestionOrder` → resume'da kaldığı soru | `interview.service.ts:445-451` | ✅ Uyumlu |

**Eksik bulgu**: `Interview.mode` (`InterviewMode`: written/voice) ve `Interview.level`
(`ExperienceLevel`: intern/junior/senior) alanları gerçek API yanıtında dönüyor
(`interview-api.md` §2) ama bu dilimin `data-model.md`'sinde "Tüketilen alanlar"
tablosunda **listelenmemişti**. **Düzeltildi** (bu doğrulama sırasında): `data-model.md`
ve `spec.md` FR-002'ye `mode`/`level` rozetleri eklendi — kullanıcı kararıyla kart/detay
ekranında gösterilecek.

**Sonuç**: Sözleşme uyumlu, 1 eksik alan tespit edilip düzeltildi (kapsam `002-interview`'e
geri düzeltme gerektirmedi — yalnızca bu dilimin belgesi eksikti).

## T002 — `InterviewOwnershipGuard` davranış doğrulaması

Kaynak: `backend/src/interview/ownership/interview-ownership.guard.ts`.

- Sahip değilse veya kayıt yoksa: **`404`** döner (yorum satırında kasıtlı olarak
  belgelenmiş — varlık gizliliği gerekçesi).
- Admin: guard baypas ediyor (salt-okunur erişim; `isReadRequest` kontrolü ile).
- `001-auth-rol`'ün genel `OwnershipGuard`'ı farklı olarak `403` döner (route param
  `:ownerId` karşılaştırması) — bu **kasıtlı bir sapma**, `004-history` bunu etkilemiyor
  çünkü `contracts/history-api.md` zaten yalnızca `InterviewOwnershipGuard`'ı (404
  davranışını) referans alıyor.

**Sonuç**: Guard davranışı beklendiği gibi, ek doğrulama/düzeltme gerekmedi.

## Notlar

- `DELETE /api/interviews/:id` uç noktası henüz kodda yok — bu bir tutarsızlık değil,
  plan.md'nin belirttiği gibi bu dilimin kendi implementasyon fazında (ayrı PR, T038/T039)
  eklenecek.
- İsimlendirme notu: dokümanlardaki (`002-interview/*`, `docs/API_CONVENTIONS.md`,
  `specs/degerlendirme-user-stories.md`) `004-interview-history` yanlış yazımı `004-history`
  olarak düzeltildi. Kod yorumlarındaki (`backend/prisma/schema.prisma`,
  `interview-ownership.guard.ts`, ilgili test dosyaları, `frontend/src/pages/interview/list.tsx`)
  aynı yazım hatası ayrı, küçük bir kod-yorumu düzeltme PR'ında ele alınmalı (bu dosyanın
  kapsamı dışında, davranışı etkilemiyor).
