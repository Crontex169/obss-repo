# Uygulama Planı: Ödeme ve Abonelik

**Dal (Branch)**: `010-odeme-abonelik` | **Tarih**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/010-odeme-abonelik/spec.md` özellik spesifikasyonu

**Not**: Bu dilim **002-interview** dilimine bağımlıdır (kota sayımı `Interview`
kayıtlarından yapılır) ve **001-auth-rol** oturum altyapısını kullanır. Mevcut
saatlik LLM hız sınırlamasını (`docs/API_CONVENTIONS.md` 3.5) DEĞİŞTİRMEZ,
korur.

## Özet

Kullanıcılar üç kademeden birinde olur (`free` / `pro` / `pro_plus`) ve kademeler
yalnızca aylık görüşme kotasıyla ayrışır (3 / 50 / 100). Ücretli kademeye geçiş,
ödeme sağlayıcısının barındırdığı sayfada tamamlanır; uygulama kart verisine hiç
dokunmaz. Kota, yeni görüşme oluşturmayı kısıtlar; var olan görüşmeye devam etmeyi
kısıtlamaz.

**Teknik yaklaşım**: Ödeme sağlayıcısı **Stripe** (test modu). Abonelik durum
makinesinin tamamı — plan, fatura döngüsü, iptal, ödeme başarısızlığı, yeniden
deneme — Stripe tarafında kalır. Uygulama tarafında yalnızca üç `User` alanı
(`stripeCustomerId`, `planTier`, `proUntil`), üç uç nokta (checkout başlat, portal
linki, webhook) ve bir guard vardır. Checkout ve abonelik yönetimi Stripe'ın
barındırdığı hazır sayfalarıyla (Checkout Session + Customer Portal) yapılır;
kendi ödeme formumuzu yazmayız (`spec.md` FR-011).

Değerlendirilen ve elenen iki alternatif:

- **Kendi abonelik/fatura tablolarımız** (Stripe yalnızca tahsilat): tek bir
  ücretli özellik ve tek bir kısıt varken `Subscription`/`Plan`/`Invoice`
  tablolarının hepsi boş kalır; Stripe'ın durum makinesinin eksik bir kopyası
  ayrışma riski üretir. Bkz. `data-model.md`.
- **`@better-auth/stripe` eklentisi**: Better Auth zaten kurulu (1.6.25) ve
  eklenti checkout/portal/webhook'u paket olarak getiriyor. Elendi çünkü (a) yeni
  bir bağımlılık ve kendi şemasını dayatıyor, (b) faturalandırmayı zaten özel
  hook'lar ve e-posta bazlı hız sınırlamayla dolu olan `better-auth.config.ts`'e
  gömüyor. Bu dilimde yazılacak kod zaten küçük olduğu için eklentinin
  kazandırdığı satır, getirdiği bağlanmayı karşılamıyor.

## Kota uygulaması

Yeni `PlanQuotaGuard`, **yalnızca** yeni görüşme oluşturan uç noktada:

```ts
// backend/src/interview/interview.controller.ts:78
@Post()
@UseGuards(PlanQuotaGuard, LlmRateLimitGuard)
```

Guard sırası kasıtlıdır (`spec.md` FR-009): `LlmRateLimitGuard` sayacı istek
öncesi artırır (bkz. `llm-rate-limit.guard.ts` dosya başlığı). Kota guard'ı önce
koşmazsa, hakkı zaten bitmiş kullanıcı reddedilirken bir de saatlik hakkını yakar.

Diğer görüşme uçları (`POST /:id/answers`, `POST /:id/report/retry`,
`POST /:id/transcribe`) guard'ı ALMAZ. "Yarım kalana devam ederken hak düşmesin"
kuralı böylece ek kod olmadan sağlanır (`spec.md` FR-004).

Sayım ve limit: bkz. `data-model.md`. `deletedAt` filtresinin bilerek
kullanılmadığına dikkat (FR-005).

**Yanıt**: `402 Payment Required`, gövdede `plan`, `used`, `limit`. 429'dan ayrı
tutulur ki istemci "yavaşla" ile "planını yükselt" durumlarını karıştırmasın
(`spec.md` FR-007). Hata gövdesi `docs/API_CONVENTIONS.md` biçimini izler.

**Bilinen tavan**: Aynı anda gelen iki istek ikisi de `N-1` sayıp geçebilir; limit
en fazla bir görüşme aşılır. Guard'a `ponytail:` yorumu bırakılır; önemli hale
gelirse sayım `SERIALIZABLE` transaction'a alınır.

## Güvenlik (Anayasa İlke V)

Webhook uç noktası bu dilimin en riskli parçasıdır ve ayrı ele alınmalıdır.

`POST /api/billing/webhook` oturum gerektiremez — Stripe çerez göndermez. Mevcut
`OriginGuard` de bu isteği geçirir, çünkü `Origin` başlığı olmayan istekleri
kasıtlı olarak serbest bırakır (gerekçesi `origin.guard.ts` içinde yazılı ve
doğrudur: tarayıcı dışı istemcide CSRF kavramı yoktur). Sonuç açıkça
kaydedilmelidir: **bu uç noktanın tek koruması Stripe imzasıdır.** İmza
doğrulaması eksik veya yanlış yapılandırılırsa, adresi bilen herkes kendisine
ücretli plan tanımlayabilir.

Kurallar:

1. **İmza doğrulaması zorunlu.** `stripe.webhooks.constructEvent(rawBody,
   signatureHeader, STRIPE_WEBHOOK_SECRET)`. Doğrulama başarılı olmadan gövdeden
   hiçbir alan okunmaz ve hiçbir veritabanı yazması yapılmaz (`spec.md` FR-013).
   Başarısızlık → `400`; log'a olayın içeriği değil yalnızca reddedilme bilgisi
   yazılır.
2. **Ham gövde şart.** `main.ts` içinde `NestFactory.create(AppModule, { rawBody:
   true })`, handler'da `req.rawBody`. JSON olarak ayrıştırılıp yeniden
   serileştirilen gövdeyle imza tutmaz; bu, tüm webhook'ları sessizce kıran bir
   hatadır. Mevcut `main.ts:12` bu seçeneği geçmiyor, eklenecek.
3. **Kullanıcı eşlemesi güvenilir kaynaktan.** Kullanıcı, Stripe müşteri kimliği
   üzerinden bulunur; o kimlik checkout oturumu açılırken, kullanıcı
   yönlendirilmeden ÖNCE `stripeCustomerId` alanına yazılır. Webhook gövdesindeki
   `metadata` / `client_reference_id` alanına dayanarak kullanıcı SEÇİLMEZ.
4. **Idempotency.** Stripe aynı olayı tekrar gönderir. `proUntil = max(mevcut,
   current_period_end)` ataması doğası gereği idempotenttir. "Şu kadar gün ekle"
   tarzı artırma KULLANILMAZ; tekrar gönderimde çarpar (`spec.md` FR-014).
5. **Yönlendirme adresine güvenilmez.** `success_url` ile dönen kullanıcı için
   plan yükseltmesi YAPILMAZ — o adresi kullanıcı doğrudan da açabilir
   (`spec.md` FR-012). Kullanıcı arayüzü "ödemeniz işleniyor" gösterip
   `/api/users/me`'yi kısa süre yoklar.
6. **Dinlenen olaylar**: `invoice.paid` (ilk ödeme ve yenilemeler → `planTier` +
   `proUntil`) ve `customer.subscription.updated` (kademe değişimi → `planTier`).
   Tek bir handler her iki olayda da aboneliği okuyup iki alanı birden yazar.
   İptal için olay dinlenmez; `proUntil` dolar (`spec.md` FR-016/FR-017).
7. **Gizli bilgi yönetimi.** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PRO_PLUS` `env.validation.ts`'e eklenir.
   `.env.example`'a yalnızca boş yer tutucu girer; gerçek anahtar depoya
   GİRMEZ. Yalnızca test modu anahtarları kullanılır. Webhook gövdesi ve
   sağlayıcı anahtarları loglanmaz — `log-redaction.ts` kapsamı genişletilir
   (`spec.md` FR-020).

Global `default` hız sınırı kovası IP başına 300/60s; Stripe'ın yeniden deneme
hacmi bunun çok altında kalır, muafiyet gerekmez.

## Constitution Check

- **Spec-first**: Bu plan `specs/010-odeme-abonelik/spec.md`'den türetildi. ✅
- **Test-first/ATDD**: `tasks.md`'de her US için testler koddan önce yazılacak. ✅
- **Vertical slice**: Backend (şema + billing modülü + guard) + frontend
  (fiyatlandırma sayfası + kota rozeti) uçtan uca. ✅
- **Security (İlke V)**: Yukarıdaki Güvenlik bölümü; imza doğrulaması, ham gövde,
  idempotency, kart verisi kapsam dışı, anahtarlar depo dışında. ✅
- **LLM contract**: Bu dilim LLM çağırmaz; mevcut LLM kotasının ÜSTÜNE ticari bir
  katman ekler ve `TokenUsage` sözleşmesine dokunmaz. ✅
- **ADR**: Yeni bağımlılık (`stripe` Node SDK) ve yeni bir mimari karar
  (abonelik durumunun sahibi sağlayıcıdır, kendi tablolarımızı tutmuyoruz) →
  `docs/DECISIONS.md`'ye **yeni ADR gerekir**. ⚠️

Gate: PASS (ADR yazımı `tasks.md`'nin ilk görevidir).

## Project Structure

### Documentation (this feature)

```text
specs/010-odeme-abonelik/
├── plan.md              # Bu dosya
├── spec.md               # Faz 0 çıktısı
├── data-model.md          # Faz 1 çıktısı (yeni tablo yok, User genişletilir)
├── quickstart.md          # Faz 1 çıktısı (Stripe test modu kurulumu, webhook yönlendirme)
└── tasks.md               # Faz 2 çıktısı (speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   └── schema.prisma                  # User += stripeCustomerId, planTier, proUntil (+migration)
├── src/
│   ├── main.ts                        # NestFactory.create(..., { rawBody: true })
│   ├── config/env.validation.ts       # + STRIPE_SECRET_KEY / _WEBHOOK_SECRET / _PRICE_PRO / _PRICE_PRO_PLUS
│   ├── common/
│   │   ├── log-redaction.ts           # webhook gövdesi ve Stripe anahtarları redaksiyon kapsamına
│   │   └── guards/
│   │       └── plan-quota.guard.ts    # YENİ: aylık kota kontrolü (402)
│   ├── billing/                       # YENİ modül
│   │   ├── billing.module.ts
│   │   ├── billing.controller.ts      # POST /checkout, POST /portal, POST /webhook
│   │   ├── billing.service.ts         # Stripe çağrıları + proUntil/planTier yazımı
│   │   └── plan.ts                    # kademe→kota matrisi, plan türetimi (tek kaynak)
│   ├── interview/
│   │   └── interview.controller.ts    # :78 → @UseGuards(PlanQuotaGuard, LlmRateLimitGuard)
│   └── users/
│       └── users.controller.ts        # /me yanıtına plan, interviewsUsed, interviewsLimit
└── test/
    ├── unit/
    │   ├── plan-derivation.spec.ts        # proUntil null / geçmiş / gelecek
    │   └── plan-quota-window.spec.ts      # ay sınırı, limit-1 / limit / aşım
    └── integration/
        ├── us1-quota-blocks-create.spec.ts       # 402 + gövde alanları
        ├── us1-quota-allows-resume.spec.ts       # answers / report-retry kotayı tüketmez
        ├── us1-quota-counts-deleted.spec.ts      # silinen görüşme hak iade etmez
        ├── us2-webhook-invalid-signature.spec.ts # 400 VE DB değişmemiş
        ├── us2-webhook-upgrades-plan.spec.ts     # planTier + proUntil yazılır
        ├── us2-webhook-idempotent.spec.ts        # aynı olay iki kez → aynı sonuç
        └── us3-expired-falls-back-to-free.spec.ts

frontend/
├── src/pages/billing/
│   ├── PricingPage.tsx                # kademe kartları → POST /billing/checkout
│   └── BillingReturnPage.tsx          # success_url: "işleniyor", /users/me yoklar
├── src/components/
│   └── QuotaBadge.tsx                 # kullanılan/toplam hak + kota dolunca yükselt çağrısı
└── test/
    └── billing/*.spec.tsx
```

## Test Stratejisi

Stripe SDK testlerde mock'lanır; **ağ çağrısı yoktur** ve gerçek Stripe'a karşı
e2e test yazılmaz. Geçerli imzalı webhook gövdesi
`stripe.webhooks.generateTestHeaderString` ile üretilir, böylece imza yolu gerçek
doğrulama koduyla test edilir.

En kritik test `us2-webhook-invalid-signature.spec.ts`'dir: geçersiz imzada yanıtın
400 olması YETMEZ, veritabanında hiçbir değişiklik olmadığı da doğrulanmalıdır.

## Complexity Tracking

| Sadeleştirme | Bilinen tavan | Yükseltme yolu |
|---|---|---|
| Kota sayımı transaction'sız `count` | Eşzamanlı iki istek limiti 1 aşabilir | Sayımı `SERIALIZABLE` transaction'a al |
| Kota penceresi takvim ayı (fatura dönemi değil) | Ay ortasında abone olan ilk ay kısmi pencere alır | Pencereyi `proUntil`'den geriye say |
| Kota limitleri kodda sabit | Limit değişimi dağıtım gerektirir | Matrisi DB'ye/env'e taşı |
| Abonelik durumu saklanmıyor (yalnızca `proUntil`) | Uygulama içinden "iptal edildi mi" sorulamaz | Stripe'tan anlık sorgula ya da `subscription.status` alanını ekle |
