// 010-odeme-abonelik US2 (T023): webhook isleme IDEMPOTENT olmali (FR-014).
//
// Stripe ayni olayi yeniden gonderir (yanit gecikirse, 2xx alamazsa, elle
// yeniden gonderilirse). Islem "N gun ekle" seklinde yazilsaydi her tekrar
// aboneligi uzatir ve kullanici odemedigi ayları bedava kullanirdi. Atama
// `proUntil = max(mevcut, donem sonu)` oldugu icin tekrar sonuc degistirmez.
import request from 'supertest';
import {
  createBillingTestApp,
  invoicePaidEvent,
  signedWebhook,
  subscriptionListResponse,
  TEST_PRICE_PRO,
  type BillingTestApp,
} from './helpers/billing-app';

const stamp = Date.now();
const email = `webhook-idem-${stamp}@example.com`;
const customerId = `cus_idem_${stamp}`;
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;

describe('US2 — ayni olay tekrar islenirse sonuc degismez', () => {
  let ctx: BillingTestApp;

  beforeAll(async () => {
    ctx = await createBillingTestApp();
    await ctx.prisma.user.create({
      data: {
        email,
        name: email,
        emailVerified: true,
        stripeCustomerId: customerId,
      },
    });
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, periodEnd),
    );
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  // AYNI olay govdesi (ayni event id) tekrar tekrar gonderilir.
  const event = invoicePaidEvent(customerId);

  function sendSameEvent() {
    const { payload, signature } = signedWebhook(ctx.stripe, event);
    return request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  }

  it('ilk gonderim plani yukseltir', async () => {
    const res = await sendSameEvent();
    expect(res.status).toBe(200);

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('ayni olay 3 kez daha gonderilir -> proUntil AYNI kalir', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await sendSameEvent();
      expect(res.status).toBe(200);
    }

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    // Uzamis olsaydi "N gun ekle" tarzi bir artirma sizmis demektir.
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
    expect(user.planTier).toBe('pro');
  });

  it('GERIYE donuk bir donem sonu proUntil"i KISALTMAZ', async () => {
    // Sirasi bozulmus/gec gelen bir yenileme olayi, kullanicinin halihazirda
    // odenmis suresini geri almamali (max davranisi).
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, periodEnd - 10 * 86_400),
    );

    await sendSameEvent();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('ILERI bir donem sonu proUntil"i uzatir (gercek yenileme)', async () => {
    const yeniDonem = periodEnd + 30 * 86_400;
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, yeniDonem),
    );

    await sendSameEvent();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.proUntil?.getTime()).toBe(yeniDonem * 1000);
  });
});
