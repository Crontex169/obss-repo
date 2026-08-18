# Phase 1 Veri Modeli: Interview History (Görüşme Geçmişi)

**Dilim**: `004-history` | **Spec**: [spec.md](./spec.md) | **Araştırma**: [research.md](./research.md)

## ⚠️ Bu dilim şema sahibi DEĞİLDİR

`004-history`, veri modeli düzeyinde **yeni bir tablo, yeni bir Prisma modeli veya yeni
bir alan açmaz**. Gerçek şema tanımının ve sahipliğinin tek kaynağı
[`specs/002-interview/data-model.md`](../002-interview/data-model.md)'dir. Bu belge,
o şemanın **bu dilim için gerekli** kısmını salt-okunur biçimde özetler ve hangi alanın
hangi Kullanıcı Hikâyesi/FR için kullanıldığını izlenebilir kılar; şemayı yeniden
tanımlamaz, çelişmez, kopyalamaz.

**İstisna (tek yazma işlemi)**: Bu dilim, mevcut `Interview.deletedAt` alanına **soft-delete
zaman damgası yazan** yeni bir uç nokta (`DELETE /api/interviews/:id`, bkz.
[contracts/history-api.md](./contracts/history-api.md)) inşa eder. Bu, alanın
**yeniden tanımlanması** değil, `002-interview`'in zaten hazırladığı ama doldurmadığı
alanı **doldurma sorumluluğunun** üstlenilmesidir (bkz. `docs/API_CONVENTIONS.md` §4.3:
*"Silme uç noktası 004-history kapsamındadır; 002-interview yalnızca alanı ve
liste filtresini hazırlar"*).

## Tüketilen alanlar (kaynak: `002-interview/data-model.md`)

| Alan | Tip | Bu dilimde kullanım | İlgili FR / Hikâye |
|------|-----|----------------------|---------------------|
| `Interview.id` | `String` | Kart/detay/silme işlemlerinde kaynak kimliği | FR-005, FR-009 |
| `Interview.userId` | `String` | Sahiplik kontrolü (yalnızca kendi kayıtları) | FR-001, FR-009 |
| `Interview.position` | `String?` | Kart başlığı (pozisyon adı) | FR-002 |
| `Interview.createdAt` | `DateTime` | Kart üzerinde tarih + varsayılan sıralama anahtarı | FR-002, FR-003 |
| `Interview.completedAt` | `DateTime?` | Detay ekranında (opsiyonel) tamamlanma bilgisi | FR-007 |
| `Interview.status` | Enum (`in_progress` \| `completed`) | Durum rozeti + "Devam Et" / "Detay" aksiyon seçimi | FR-002, FR-005, FR-006, FR-014 |
| `Interview.currentQuestionOrder` | `Int` | Resume'da kaldığı (cevaplanmamış ilk) sorunun belirlenmesi | FR-005 |
| `Interview.reportStatus` | Enum (`not_applicable` \| `pending` \| `ready` \| `failed`) | Detay ekranında rapor bölümü durumu | FR-007, FR-008 |
| `Interview.deletedAt` | `DateTime?` | **Okuma**: liste/detay/resume görünürlük filtresi (§4.3). **Yazma**: bu dilimin `DELETE` uç noktası tarafından `now()` ile doldurulur | FR-001, FR-009, FR-010, FR-011, FR-012, FR-013 |
| `Interview.language` | Enum `ReportLanguage` (`tr` \| `en`) | Detay ekranında rapor/soru dilinin tutarlı gösterimi | FR-007 (dolaylı) |
| `Interview.mode` | Enum `InterviewMode` (`written` \| `voice`) | Kart üzerinde mod rozeti (sözlü/yazılı) + detay ekranında görüntüleme | FR-002 |
| `Interview.level` | Enum `ExperienceLevel` (`intern` \| `junior` \| `senior`) | Kart üzerinde deneyim seviyesi rozeti + detay ekranında görüntüleme | FR-002 |
| `Question.*` (order, text, type, options) | — | Detay ekranında soru listesi | FR-007 |
| `Answer.*` (content) | — | Detay ekranında ilgili soruya bağlı cevap | FR-007 |
| `Report.*` (skorlar, genel izlenim, güçlü/geliştirilmesi gereken yönler) | — | Detay ekranında rapor bölümü | FR-007, FR-008 |

Bu tablonun tam alan tanımları, tip kısıtları ve doğrulama kuralları için
`specs/002-interview/data-model.md` bölümlerine bakınız: **Interview** (§ana tablo),
**Question**, **Answer**, **Report**.

## Kullanılmayan alanlar (bilinçli kapsam dışı)

- `TokenUsage` tablosu (şema sahibi `003-pre-assessment`) — bu dilim token/maliyet
  görüntülemez; bu, `005-admin` diliminin kapsamıdır (spec Assumptions).
- `adaptiveEnabled`, `isBaseline`, `adaptedFromAnswerId` (Question alanları) — bu dilim
  soru üretim/adaptasyon mantığına dokunmaz, yalnızca üretilmiş soruyu **görüntüler**.

## Durum geçişleri — bu dilimin eklediği TEK geçiş

`002-interview/data-model.md` zaten `status` ve `reportStatus` geçişlerini tanımlar
(bu dilim onları **değiştirmez**). Bu dilimin eklediği tek yeni geçiş:

```text
Interview.deletedAt: null  --[DELETE /api/interviews/:id, sahibi tetikler]-->  now()
```

**Kurallar**:
- Yalnızca `interview.userId === request.user.id` olan kullanıcı bu geçişi tetikleyebilir;
  aksi halde `404` (yabancı kayıt gizliliği, `docs/API_CONVENTIONS.md` §1).
- Geçiş **idempotent**tir: `deletedAt` zaten dolu bir kayıt için tekrar `DELETE`
  isteği hata fırlatmaz; ya aynı başarı sonucunu (`204`) ya da `404` döner (FR-013,
  Hikâye 4 kriter 5) — kesin seçim [contracts/history-api.md](./contracts/history-api.md)'de.
- Bu geçiş `status` (`in_progress`/`completed`) veya `reportStatus`'u **etkilemez**;
  ikisi de olduğu gibi korunur (yalnızca admin görünürlüğü için, FR-012).
- Geri dönüş (undelete) bu MVP kapsamında **yoktur** (spec Assumptions).

## İlişki diyagramı (değişmeden, referans)

Bu dilim `002-interview/data-model.md` §"İlişkiler" diyagramını **olduğu gibi** kullanır;
burada yeniden çizilmez. Tek fark: `deletedAt` artık bu dilimin `DELETE` uç noktasıyla
**doldurulabilir** hale gelir (önceden yalnızca alan/filtre hazırdı, yazan bir uç nokta
yoktu).

## Gereksinim İzlenebilirliği

| Veri kuralı | FR / Hikâye |
|-------------|-------------|
| `userId` sahiplik filtresi (liste + detay + silme) | FR-001, FR-009 |
| `deletedAt != null` → kullanıcı listesinde/erişiminde yok sayılır | FR-001, FR-009, FR-011 |
| `status` → rozet + aksiyon (Devam Et / Detay) eşlemesi | FR-002, FR-005, FR-006 |
| `createdAt` DESC sıralama | FR-003 |
| `currentQuestionOrder` → resume başlangıç noktası | FR-005 |
| `reportStatus="failed"` → detayda zarif hata + (varsa) retry yönlendirmesi | FR-008 |
| `deletedAt` yazma (soft-delete) + idempotent tekrar istek | FR-011, FR-013 |
| Admin'de `deletedAt` görünürlüğü (bu dilim değiştirmez, yalnızca temel hazırlar) | FR-012 (005-admin'e devredilir) |
