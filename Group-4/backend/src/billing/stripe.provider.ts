// DOSYA REHBERİ: Stripe istemcisinin enjeksiyon token'ı. Amaç LLM_PROVIDER ile
// aynı: dış servisi bir port arkasına koymak, böylece testler gerçek Stripe'a
// hiç gitmeden aynı sınırdan sahte bir istemci takabilsin.
//
// BillingService içinde `new Stripe(...)` YAZILMAZ; yazılsaydı testler ya
// gerçek API'ye çıkardı ya da modül seviyesinde mock'lamak (jest.mock) gerekirdi
// — ikisi de repodaki port/adapter desenine aykırı.
//
// ONEMLI: webhook imza dogrulamasi (`stripe.webhooks.constructEvent`) SAHTE
// BIRAKILAMAZ. O metod ag cagrisi yapmaz, yalnizca gövde + imza + webhook sirri
// uzerinde kripto dogrulamasi kosar; testlerde de GERCEK uygulamasi kullanilir.
// Sahte birakilsaydi "gecersiz imza reddedilir" testi hicbir sey olcmezdi.
import Stripe from 'stripe';

export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}
