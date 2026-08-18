# Phase 1 Veri Modeli: Admin Paneli (Görüşme İzleme & İstatistikler)

**Dilim**: `005-admin` | **Spec**: [spec.md](./spec.md) | **Araştırma**: [research.md](./research.md)

## ⚠️ Bu dilim şema sahibi DEĞİLDİR

`005-admin`, veri modeli düzeyinde **hiçbir yeni tablo, yeni bir Prisma modeli veya yeni
bir alan açmaz** — bir migration bile üretmez. Gerçek şema tanımlarının tek kaynağı:

- `User`, `role` alanı → şema sahibi `specs/001-auth-rol/data-model.md`
- `Interview`, `Question`, `Answer`, `Report` → şema sahibi `specs/002-interview/data-model.md`
- `TokenUsage`, `LlmOperation` enum'u → tasarım sahibi `specs/003-pre-assessment/data-model.md`
  (tablo fiilen `002-interview` migration'ında oluşur)

Bu belge, bu tabloların **bu dilim için gerekli** kısmını salt-okunur biçimde özetler ve
hangi alanın hangi Kullanıcı Hikâyesi/FR için kullanıldığını izlenebilir kılar; şemayı
yeniden tanımlamaz, çelişmez, kopyalamaz. (Bu, `004-history/data-model.md`'nin izlediği
desenle birebir aynıdır.)

## Tüketilen alanlar

### `User` (kaynak: `001-auth-rol/data-model.md`)

| Alan | Tip | Bu dilimde kullanım | İlgili FR |
|------|-----|----------------------|-----------|
| `id` | `String` | Görüşme sahibiyle eşleştirme (`Interview.userId`) | FR-002 |
| `email` | `String` | Admin listesinde/detayında sahibi tanımlamak için gösterilir (Clarifications Q2) | FR-002, FR-005 |
| `role` | `String` | `RolesGuard`'ın erişim kararı için okunur (bu dilim değiştirmez) | FR-001 |

### `Interview` (kaynak: `002-interview/data-model.md`)

| Alan | Tip | Bu dilimde kullanım | İlgili FR |
|------|-----|----------------------|-----------|
| `id` | `String` | Liste/detay kaynağı kimliği | FR-002, FR-005 |
| `userId` | `String` | Sahiplik gösterimi (admin için filtre **değil**, yalnızca bilgi) | FR-002 |
| `position` | `String?` | Meslek filtresi + istatistik grupları (`null` → "Belirsiz" kovası, research.md §3) | FR-002, FR-003, FR-009 |
| `status` | Enum (`in_progress` \| `completed`) | Liste durum rozeti + tamamlanma oranı hesabı | FR-002, FR-011 |
| `createdAt` | `DateTime` | Liste sıralama (DESC) + süre hesabının başlangıcı | FR-002, FR-010 |
| `completedAt` | `DateTime?` | Süre hesabının bitişi (`completedAt − createdAt`, `002-interview` kuralı) | FR-010 |
| `deletedAt` | `DateTime?` | **Yalnızca okunur** — liste/detay/istatistikte "silindi" etiketi; hiçbir zaman filtrelenmez (Clarifications Q1) | FR-004, FR-009-012 |
| `reportStatus` | Enum | Detay ekranında rapor bölümü durumu (`not_applicable`/`pending`/`ready`/`failed`) | FR-006 |
| `mode`, `level`, `language` | Enum'lar | Detay ekranında görüntüleme (bilgi amaçlı) | FR-005 |
| `Question.*` / `Answer.*` | — | Detay ekranında soru-cevap listesi | FR-005 |
| `Report.*` | — | Detay ekranında Teknik/Davranışsal/Genel skorları + metin | FR-005 |

### `TokenUsage` (kaynak: `003-pre-assessment/data-model.md`, tablo `002-interview`'de)

| Alan | Tip | Bu dilimde kullanım | İlgili FR |
|------|-----|----------------------|-----------|
| `interviewId` | `String?` | Detay ekranında "bu görüşmenin maliyeti" toplamı (`SUM`) | FR-007 |
| `userId` | `String` | (Bu dilimde kullanılmaz — admin istatistikleri görüşme/zaman bazlı, kullanıcı bazlı kırılım MVP kapsamı dışı) | — |
| `inputTokens`, `outputTokens` | `Int` | İstatistik ekranında günlük toplam token (`SUM`) | FR-012 |
| `estimatedCostUsd` | `Decimal` | Detay ekranında görüşme başına maliyet (`SUM`) | FR-007 |
| `createdAt` | `DateTime` | Günlük zaman serisi gruplaması (`DATE_TRUNC('day', ...)`, son 30 gün) | FR-012 |
| `succeeded` | `Boolean` | Toplamlara başarısız kayıtlar da dahil edilir (spec Assumptions — SC-006 tutarlılığı için ham veriyle birebir) | FR-012 |

## Bu dilimin eklediği tek şey: salt-okunur agregasyon view tipleri

Yeni bir Prisma modeli **değil**; yalnızca `AdminService` içinde tanımlanan, API
yanıtlarını şekillendiren TypeScript tipleridir (kalıcı değildir, migration üretmez):

```ts
// backend/src/admin/admin.service.ts içinde (şema değil, view/DTO tipi)
interface AdminInterviewListItem {
  id: string;
  ownerEmail: string;      // User.email (Clarifications Q2)
  position: string | null; // null → frontend "Belirsiz" gösterir
  status: 'in_progress' | 'completed';
  createdAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;  // null değilse "silindi" rozeti (FR-004)
}

interface AdminStatsResponse {
  countsByProfession: Array<{ position: string | null; label: string; count: number }>; // FR-009
  averageDurationSeconds: number | null;                                                  // FR-010 ("veri yok" → null)
  completionRatio: { completed: number; inProgress: number };                             // FR-011
  dailyTokenUsage: Array<{ date: string; totalTokens: number; estimatedCostUsd: string }>; // FR-010/FR-012, son 30 gün, sıfır doldurmalı
  totalCostUsd: string;                                                                    // FR-010, pencere toplam maliyeti (USD)
}
```

## Durum geçişleri

Bu dilim **hiçbir durum geçişi eklemez veya tetiklemez** — `Interview.status`,
`reportStatus`, `deletedAt` zaten `002-interview`/`004-history` tarafından yazılır; bu
dilim yalnızca **okur**. Bilinçli olarak: admin panelinden hiçbir yazma işlemi yapılamaz
(FR-008) — bu, "durum geçişi yok" ilkesinin doğal sonucudur.

## İlişki diyagramı (değişmeden, referans)

Bu dilim `002-interview/data-model.md` ve `003-pre-assessment/data-model.md`'deki
ilişki diyagramlarını **olduğu gibi** kullanır; burada yeniden çizilmez.

## Gereksinim İzlenebilirliği

| Veri kuralı | FR |
|-------------|-----|
| `role="admin"` erişim kontrolü | FR-001 |
| `User.email` → sahibi gösterimi | FR-002, FR-005 |
| `position` filtresi + "Belirsiz" kovası | FR-002, FR-003, FR-009 |
| `deletedAt` okuma (asla filtreleme) | FR-004, FR-009, FR-010, FR-011, FR-012 |
| Soru/cevap/rapor tam görüntüleme | FR-005 |
| `reportStatus="failed"`/eksik → zarif durum | FR-006 |
| `TokenUsage` görüşme başına toplam | FR-007 |
| Yazma/güncelleme/silme yasak (guard katmanında ve route yokluğunda) | FR-008 |
| Meslek bazlı sayı (`groupBy`) | FR-009 |
| Ortalama süre (`completedAt - createdAt`) | FR-010 |
| Tamamlanma oranı (`status` sayımı) | FR-011 |
| Günlük token zaman serisi, son 30 gün, sıfır doldurma | FR-012 |
| Veri yokken zarif boş durum | FR-013 |
| Sayfalama (varsayılan 20/sayfa) | FR-014 |
