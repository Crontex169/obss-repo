# Faz 1 Veri Modeli: Ödeme ve Abonelik

## Yeni Prisma modeli: YOK

Bu dilim yeni tablo eklemez. `Subscription`, `Plan`, `Invoice` tabloları
BİLİNÇLİ OLARAK yazılmamıştır: abonelik durum makinesinin (deneme, aktif,
gecikmiş, iptal edilmiş, süresi dolmuş) tek sahibi ödeme sağlayıcısıdır. Aynı
makineyi ikinci kez, eksik biçimde modellemek iki kaynağın ayrışmasına yol açar
ve o ayrışmanın faturası doğrudan kullanıcıya çıkar (parasını ödemiş kullanıcı
ücretsiz planda kalır). Bizde saklanan şey durum değil, **sonuç**tur: hangi
kademe, ne zamana kadar.

Fatura arşivi de tutulmaz — sağlayıcının kendi arayüzünde zaten vardır (bkz.
`spec.md` Assumptions).

## Genişletilen mevcut varlık: `User` (bkz. `specs/001-auth-rol/data-model.md`)

Üç yeni alan:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `stripeCustomerId` | `String? @unique` | Sağlayıcı tarafındaki müşteri kaydının kimliği. Ödeme oturumu açılırken, kullanıcı yönlendirilmeden ÖNCE yazılır. Gelen ödeme bildirimleri kullanıcıya bu alan üzerinden bağlanır. `@unique`: bir sağlayıcı müşterisi en fazla bir uygulama kullanıcısına karşılık gelir. |
| `planTier` | `String?` | `"pro"` \| `"pro_plus"`. `null` = hiç ücretli olmamış. Kademe bilgisi ile bitiş tarihi AYRI alanlardır çünkü tek bir tarih hangi kademe olduğunu taşıyamaz. |
| `proUntil` | `DateTime?` | Ödenmiş dönemin bitiş anı. `null` veya geçmiş ise kullanıcı `free` sayılır. |

Etkin plan SAKLANMAZ, türetilir:

```
plan = (proUntil && proUntil > now()) ? planTier : "free"
```

`planTier` geçmiş bir `proUntil` ile birlikte kalmaya devam eder; bu kasıtlıdır,
kullanıcının en son hangi kademede olduğu bilgisini (yeniden abone olma akışı ve
destek için) korur ama hiçbir hak vermez.

### Neden `status` enum'u yok

`canceled`, `past_due`, `unpaid`, `incomplete` gibi durumların hepsi bizim
açımızdan tek bir soruya indirgenir: *bu kullanıcı şu an ödenmiş bir dönemin
içinde mi?* Cevap `proUntil` karşılaştırmasıdır. İptal bu tarihi değiştirmez
(kullanıcı ödediği dönemi kullanır, `spec.md` FR-016); ödeme alınamazsa tarih
uzamaz ve kendiliğinden sona erer (FR-017). Böylece iptal ve borç takibi için
YAZILAN KOD YOKTUR.

## Kullanılan mevcut varlık: `Interview` (bkz. `specs/002-interview/data-model.md`)

Kota sayacı ayrı bir tabloda TUTULMAZ. Bu ay kullanılan hak, doğrudan görüşme
kayıtlarından sayılır:

```ts
prisma.interview.count({ where: { userId, createdAt: { gte: ayBasiUtc } } })
```

Bunun üç sonucu var:

1. **Sayaç ile gerçek asla ayrışamaz** — sayaç zaten gerçeğin kendisi.
2. **"Yarım kalana devam ederken hak düşmesin" kuralı kod gerektirmez.** Devam
   etmek yeni bir `Interview` satırı yaratmaz, dolayısıyla sayım değişmez
   (`spec.md` FR-004).
3. **Silinen görüşme sayılmaya devam eder.** Sorguda `deletedAt` filtresi
   BİLEREK YOKTUR (FR-005): aksi halde "oluştur → sil → oluştur" sınırsız kota
   demekti, oysa LLM maliyeti oluşturma anında harcanmıştır.

Mevcut `@@index([userId, createdAt(sort: Desc)])` bu sorguyu karşılar; yeni
indeks GEREKMEZ.

`Interview` varlığına bu dilimde alan EKLENMEZ.

## Kota matrisi (kodda sabit, DB'de değil)

| Kademe | Aylık görüşme hakkı |
|--------|---------------------|
| `free` | 3 |
| `pro` | 50 |
| `pro_plus` | 100 |

Tek bir plan matrisi var ve yönetim arayüzünden değiştirilmiyor; tabloya taşımak
üç satırlık, hiç yazılmayan bir tablo demek olurdu. Limit değişimi kod değişikliği
ve dağıtım gerektirir (`spec.md` Assumptions).

Fiyat bu matriste YOKTUR — fiyat sağlayıcıda tanımlıdır, uygulama fiyatı ne
saklar ne doğrular (FR-011 ile aynı gerekçe hattı: para ile ilgili gerçeğin sahibi
sağlayıcıdır).

## Yaşam Döngüsü Özeti

1. **Kayıt** → `stripeCustomerId = null`, `planTier = null`, `proUntil = null` → `free`, ayda 3 hak.
2. **Ödeme oturumu açılır** → `stripeCustomerId` yazılır. Plan HÂLÂ `free`; ödeme henüz alınmadı.
3. **Ödeme doğrulanır (sağlayıcı bildirimi)** → `planTier` = satın alınan kademe, `proUntil` = dönem sonu → kota yükselir.
4. **Yenileme ödemesi doğrulanır** → `proUntil = max(mevcut, yeni dönem sonu)`. `max` kullanımı idempotency içindir (FR-014): aynı bildirim tekrar işlense sonuç değişmez.
5. **Kademe değişir** → `planTier` güncellenir, `proUntil` dokunulmaz.
6. **İptal** → hiçbir alan değişmez. Kullanıcı `proUntil`'e kadar kademesini kullanır.
7. **Dönem dolar** → hiçbir yazma işlemi olmaz; `proUntil < now()` olduğu an türetilen plan `free`'ye döner. Zamanlanmış iş (cron) GEREKMEZ.
8. **Hesap silinir** → alanlar kullanıcı satırıyla birlikte gider (mevcut `onDelete: Cascade` davranışı).
