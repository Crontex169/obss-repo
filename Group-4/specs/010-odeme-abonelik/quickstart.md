# Quickstart: Ödeme ve Abonelik (Stripe test modu)

Bu dilimi yerelde çalıştırmak için gereken kurulum. **Yalnızca test modu**
kullanılır; canlı (`sk_live_…`) anahtar bu projeye hiçbir koşulda girmez.

## 1. Stripe test ürünleri

Stripe Dashboard → **Test mode** açık → Products:

1. "Pro" adında bir ürün, aylık yinelenen (recurring) bir fiyat ekle → fiyat
   kimliğini kopyala (`price_…`).
2. "Pro+" adında ikinci bir ürün, yine aylık yinelenen fiyat → kimliğini kopyala.

Fiyat, para birimi ve fatura dönemi **yalnızca burada** tanımlıdır; uygulama
fiyatı saklamaz ve doğrulamaz (bkz. `spec.md` Assumptions).

## 2. Customer Portal

Stripe Dashboard → Settings → Billing → Customer portal → etkinleştir. Kullanıcının
kademe değiştirmesini istiyorsan "Customers can switch plans" seçeneğini aç ve iki
fiyatı da izin verilen ürünlere ekle. Portal kapalıysa `POST /api/billing/portal`
hata döner.

## 3. Ortam değişkenleri

`backend/.env` (bkz. `.env.example`):

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PRO_PLUS=price_...
```

Dördü de `env.validation.ts` tarafından doğrulanır; eksikse uygulama açılışta
hata verir. `.env` dosyası depoya commit EDİLMEZ.

## 4. Webhook'u yerele yönlendir

Stripe internetten `localhost`'a istek atamaz. Stripe CLI ile tünel aç:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Komut ekrana bir `whsec_…` yazar — **onu** `STRIPE_WEBHOOK_SECRET` olarak kullan.
Dashboard'daki webhook endpoint sırrı ile aynı değildir; karıştırılırsa her
webhook imza doğrulamasında `400` alır.

`stripe listen` açık kaldığı sürece yönlendirme çalışır; kapatıp açınca sır
değişebilir, `.env`'i güncelle.

## 5. Uçtan uca deneme

```bash
# terminal 1
docker compose up -d && npm --prefix backend run start:dev
# terminal 2
stripe listen --forward-to localhost:3000/api/billing/webhook
# terminal 3
npm --prefix frontend run dev
```

1. Giriş yap → fiyatlandırma sayfasından "Pro" seç.
2. Stripe Checkout sayfasında test kartı: `4242 4242 4242 4242`, ileri bir
   son kullanma tarihi, herhangi bir CVC ve posta kodu.
3. Terminal 2'de `invoice.paid` olayının geldiğini gör.
4. `GET /api/users/me` → `plan: "pro"`, `interviewsLimit: 50`.

Ödeme başarısız senaryosu için kart: `4000 0000 0000 0341`.

## 6. Kota davranışını elle doğrula

```bash
# Free kullanıcıda 3 görüşme oluştur, 4.'sünde 402 bekle
curl -i -X POST localhost:3000/api/interviews -H 'Content-Type: application/json' \
  -b "$COOKIE" -d '{ ... }'
```

Dördüncü istek `402` ve gövdede `plan`, `used`, `limit` dönmeli — `429` DEĞİL.
`429` görüyorsan guard sırası yanlış (bkz. `plan.md`, `spec.md` FR-009).

## 7. Yerelde plan süresini bitir

Abonelik bitiş davranışını test etmek için Stripe'ta zaman ilerletmeye gerek yok;
kullanıcının `proUntil` alanını geçmişe çek:

```sql
UPDATE "user" SET "proUntil" = now() - interval '1 day' WHERE email = '...';
```

Sonraki istekte kullanıcı `free` kotasına düşmüş olmalı (`spec.md` FR-016).
