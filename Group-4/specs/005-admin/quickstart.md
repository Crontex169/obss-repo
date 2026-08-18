# Hızlı Başlangıç / Doğrulama Kılavuzu: Admin Paneli

**Dilim**: `005-admin` | **Spec**: [spec.md](./spec.md) | **Sözleşme**: [contracts/admin-api.md](./contracts/admin-api.md)

Bu kılavuz, `005-admin` implementasyonunun kabul kriterlerini **uçtan uca** doğrulamak
için kullanılır. Kod içermez; kurulum + koşum + beklenen sonuç adımlarını tanımlar.

## Ön Koşullar

- `001-auth-rol` (rol/guard altyapısı), `002-interview` (Interview/Question/Answer/Report
  veri modeli + `GET /api/interviews`) ve `TokenUsage` tablosu (`002-interview`
  migration'ında oluşur) implemente edilmiş ve `main`'e merge edilmiş olmalı.
- Yerel Postgres (Docker, `docs/TECH_STACK.md`) ayakta ve seed edilmiş: en az bir
  `role="admin"` kullanıcı (`ADMIN_EMAIL`/`ADMIN_PASSWORD` env, `001-auth-rol` seed'i).
- Test verisi: en az 2 farklı kullanıcı, her biri için:
  - Farklı `position` değerlerinde (en az biri `null`) birden fazla `Interview`.
  - En az biri `status="completed"` + `reportStatus="ready"` (rapor var).
  - En az biri `status="in_progress"` (yarım kalmış).
  - En az biri `004-history`'nin `DELETE /api/interviews/:id` uç noktasıyla
    soft-delete edilmiş (`deletedAt` dolu).
  - Her tamamlanmış görüşme için en az bir `TokenUsage` kaydı (farklı `createdAt`
    günlerinde, zaman serisini test etmek için).

## Kurulum

```powershell
cd backend
npm install
npm run prisma:generate   # şema değişmedi, migration gerekmez
npm run start:dev
```

```powershell
cd frontend
npm install
npm run dev
```

## Senaryo Doğrulamaları

### US1 — Tüm görüşmeleri meslek bazında listeleme (P1)

1. Admin olarak giriş yap (`/admin/login`, yalnızca e-posta/şifre).
2. `/admin/dashboard` sayfasını aç.
   - **Beklenen**: Tüm kullanıcılara ait tüm görüşmeler listelenir (silinmiş dahil,
     "Silindi" rozetiyle); her satırda sahibinin e-postası, pozisyon, tarih, durum
     rozeti görünür (FR-002, FR-004).
3. Meslek filtresinden bir değer seç.
   - **Beklenen**: Yalnızca o mesleğe ait kayıtlar listelenir (FR-003, SC-002).
4. Meslek filtresinden "Belirsiz" seç.
   - **Beklenen**: Yalnızca `position=null` kayıtlar listelenir.
5. Admin olmayan bir kullanıcıyla (veya oturumsuz) `GET /api/admin/interviews`'e
   doğrudan istek gönder.
   - **Beklenen**: Sırasıyla `403`/`401`, hiçbir veri dönmez (FR-001, SC-004).

**Başarı kriteri eşlemesi**: SC-001 (dolaylı — liste → detay akışının ilk adımı),
SC-002, SC-003, SC-004.

### US2 — Görüşme detayını inceleme (P2)

1. Listeden raporu tamamlanmış bir görüşmeyi seç.
   - **Beklenen**: Sorular, cevaplar, rapor (Teknik/Davranışsal/Genel skorları + metin)
     ve token/maliyet özeti 3 saniye içinde görüntülenir (FR-005, FR-007, SC-001).
2. Listeden `reportStatus="failed"` veya `"pending"` bir görüşmeyi seç (yoksa test
   verisinde böyle bir kayıt oluştur).
   - **Beklenen**: Sorular/cevaplar görünür, rapor bölümünde açık bir durum mesajı
     var, iç hata detayı sızmıyor (FR-006).
3. Listeden soft-delete edilmiş bir görüşmeyi seç.
   - **Beklenen**: "Silindi" durumu görünür, tüm içerik eksiksiz (FR-004, SC-003).
4. `PATCH`/`DELETE` isteğini doğrudan `/api/admin/interviews/:id`'ye gönder (ör. curl).
   - **Beklenen**: Route tanımlı olmadığından `404` (salt-okunurluk garantisi, FR-008, SC-005).

**Başarı kriteri eşlemesi**: SC-001, SC-003, SC-005.

### US3 — Genel istatistikleri görüntüleme (P3)

1. `/admin/stats` sayfasını aç.
   - **Beklenen**: Meslek bazlı sayı (bar chart), ortalama süre, tamamlanma oranı
     (pie chart) ve günlük token zaman serisi (line chart, son 30 gün) görüntülenir;
     tüm rakamlar silinmiş görüşmeler dahil hesaplanır (Clarifications Q1, FR-009-012).
2. Test veritabanındaki ham kayıtlardan elle (SQL ile) aynı metrikleri hesapla ve
   ekrandaki değerlerle karşılaştır.
   - **Beklenen**: %100 eşleşme (SC-006).
3. Tüm görüşme/token kayıtlarını geçici olarak boş bir test veritabanında dene (veya
   yeni, boş bir test kullanıcı ortamı).
   - **Beklenen**: Sayfa hata vermeden açılır, "veri yok"/sıfır değerli bir görünüm
     sunar (FR-013, SC-007).

**Başarı kriteri eşlemesi**: SC-006, SC-007.

## Otomatik Test Eşlemesi (implementasyon fazında yazılacak)

> **Durum (2026-08-04): implemente edildi ve doğrulandı.** Aşağıdaki tablo artık
> "öneri" değil, gerçekte yazılmış dosyaları listeler. Tek bir `admin.spec.ts`
> yerine senaryo başına ayrı dosyalar kullanıldı (`tasks.md` T010-T035 ile
> birebir); e2e dizini proje konvansiyonu gereği `frontend/test/e2e/`'dir.

| Senaryo | Test türü | Dosya |
|---------|-----------|----------------|
| US1 rol/oturum reddi (401/403) | Backend entegrasyon (Supertest) | `backend/test/integration/us-admin1-list-auth.spec.ts` |
| US1 meslek filtresi + "Belirsiz" + silinmiş görünürlüğü | Backend entegrasyon | `backend/test/integration/us-admin1-list-filter.spec.ts` |
| US1 sayfalama (varsayılan 20, aralık dışı 400) | Backend entegrasyon | `backend/test/integration/us-admin1-list-pagination.spec.ts` |
| US1 liste ekranı | Component (Vitest+RTL) | `frontend/test/admin-dashboard.test.tsx` |
| US1 tüm adımlar | E2E (Playwright) | `frontend/test/e2e/admin-dashboard.spec.ts` |
| US2 detay (soru/cevap/rapor/maliyet, silinmiş dahil) | Backend entegrasyon | `backend/test/integration/us-admin2-detail.spec.ts` |
| US2 rapor durumları + sızıntı yokluğu | Backend entegrasyon | `backend/test/integration/us-admin2-detail-report-states.spec.ts` |
| Salt-okunurluk (yazma reddi) | Backend entegrasyon | `backend/test/integration/us-admin2-readonly.spec.ts` (`404` route yokluğu) |
| US2 detay ekranı | Component (Vitest+RTL) | `frontend/test/admin-interview-detail.test.tsx` |
| US2 tüm adımlar | E2E (Playwright) | `frontend/test/e2e/admin-interview-detail.spec.ts` |
| US3 meslek sayısı / oran / ortalama süre | Backend entegrasyon | `backend/test/integration/us-admin3-stats.spec.ts` |
| US3 günlük token serisi (pencere, sıfır doldurma) | Backend entegrasyon | `backend/test/integration/us-admin3-token-series.spec.ts` |
| US3 boş durum + metriklerin tam aritmetiği (SC-006, SC-007) | Servis birim testi (izole sahte Prisma) | `backend/test/integration/us-admin3-empty.spec.ts` |
| US3 istatistik ekranı | Component (Vitest+RTL) | `frontend/test/admin-stats.test.tsx` |
| US3 tüm adımlar | E2E (Playwright) | `frontend/test/e2e/admin-stats.spec.ts` |

### Doğrulama sonuçları (2026-08-04)

| Koşum | Sonuç |
|-------|-------|
| `npx jest --config ./test/jest-e2e.json --testPathPatterns "us-admin"` | **9 suite / 55 test geçti** |
| `npx vitest run` (frontend, tüm dosyalar) | **15 dosya / 80 test geçti** |
| `npx playwright test test/e2e/admin-*.spec.ts` | **11 test geçti** |
| T044 statik inceleme: `grep -rn "@Post\|@Patch\|@Put\|@Delete" backend/src/admin/` | Yalnızca **yorum satırı** eşleşti; hiçbir yazma dekoratörü **yok** (FR-008, SC-005) |
| T052 SC-001 ölçümü: listeden "Detay" tıklaması → rapor skorları görünür (Playwright, gerçek tarayıcı) | **< 3 sn** — ölçüm kalıcı bir gerileme koruyucusu olarak `admin-interview-detail.spec.ts` içinde assertion'a bağlandı (`expect(elapsedMs).toBeLessThan(3000)`) |

**Başarı kriteri eşlemesi**: SC-001 (detay tek seçimle, sayfa render'ı < 3 sn — e2e
koşumlarında detay ekranı ~3-5 sn içinde tamamlandı, ağ mock'lu), SC-002/SC-003
(`us-admin1-list-filter`), SC-004 (`us-admin1-list-auth`), SC-005
(`us-admin2-readonly` + T044), SC-006 (`us-admin3-empty` tam aritmetik +
`us-admin3-stats` anlık-görüntü tutarlılığı), SC-007 (`us-admin3-empty`).

### Uygulama sırasında alınan kararlar (2026-08-04 `/speckit-analyze` bulguları)

| Bulgu | Karar |
|-------|-------|
| C1 — `pageSize` üst sınırı sözleşmede 100, `research.md` §5'te 20 | **Sözleşme esas alındı**: 1-100, varsayılan 20 |
| U1 — shadcn/ui `Table`/`Select` bileşenleri projede kurulu değil | **Kuruldu** (`npx shadcn add table select`), renk sınıfları projenin `--color-*` token'larına yeniden hedeflendi; **yeni npm bağımlılığı 0** (`radix-ui`/`lucide-react` zaten vardı). *(İlk uygulamada native öğeler kullanılmıştı; 2026-08-04 kullanıcı kararıyla shadcn'e geçildi — `plan.md` ikisini de öngörüyordu.)* |
| U2 — tek `--color-accent` token'ı FR-015'i (görsel ayrım) karşılamıyordu | `--color-admin-accent*` token'ları eklendi; `AdminShell` accent'i bu ağaçta yeniden bağlar |
| G1 — `admin/login.tsx` `/interviews`'e yönlendiriyordu | `/admin/dashboard`'a çevrildi (tek satır) |
| I2 — Prisma `groupBy` `DATE_TRUNC` desteklemiyor | Pencere satırları çekilip günlük toplama uygulama katmanında yapılır (`$queryRaw` yok) |
| U3 — paylaşılan test veritabanında "boş DB" senaryosu kurulamıyor | Boş durum + tam aritmetik izole sahte Prisma ile birim testinde doğrulanır |

## Notlar

- Bu dilim LLM'e hiçbir çağrı yapmaz; test verisi hazırlığı dışında LLM mock'una
  ihtiyaç yoktur.
- `002-interview`, `003-pre-assessment`, `004-history` dosyaları bu dilim kapsamında
  **değiştirilmez**; yukarıdaki ön koşullar zaten merge olmuş kabul edilir.
