// 010-odeme-abonelik US2 (T022): imzasi DOGRULANMIS `invoice.paid` olayi
// kullanicinin planini yukseltir (spec.md FR-012).
//
// Kullanici, olay govdesindeki metadata'dan DEGIL, `stripeCustomerId` uzerinden
// bulunur; o alan checkout oturumu acilirken yonlendirmeden once yazilmistir.
import request from 'supertest';
import {
  createBillingTestApp,
  invoicePaidEvent,
  signedWebhook,
  subscriptionListResponse,
  TEST_PRICE_PRO,
  TEST_PRICE_PRO_PLUS,
  type BillingTestApp,
} from './helpers/billing-app';
import { registerAndSignIn } from './helpers/auth-session';

const stamp = Date.now();
const email = `webhook-upgrade-${stamp}@example.com`;
const customerId = `cus_upgrade_${stamp}`;
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;

describe('US2 — dogrulanmis webhook plani yukseltir', () => {
  let ctx: BillingTestApp;

  beforeAll(async () => {
    ctx = await createBillingTestApp();
    await registerAndSignIn(ctx.app, ctx.prisma, email);
    await ctx.prisma.user.update({
      where: { email },
      data: { stripeCustomerId: customerId },
    });
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  function sendEvent() {
    const { payload, signature } = signedWebhook(
      ctx.stripe,
      invoicePaidEvent(customerId),
    );
    return request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  }

  it('on kosul: kullanici ucretsiz planda', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBeNull();
    expect(user.proUntil).toBeNull();
  });

  it('gecerli imzali invoice.paid -> 200', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, periodEnd),
    );

    const res = await sendEvent();
    expect(res.status).toBe(200);
  });

  it('planTier ve proUntil yazildi', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro');
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('kademe degisimi (pro_plus fiyati) planTier"i gunceller, proUntil"i bozmaz', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO_PLUS, periodEnd),
    );

    await sendEvent();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro_plus');
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('taninmayan bir fiyat kimligi plani DEGISTIRMEZ', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse('price_bilinmeyen', periodEnd + 86_400),
    );

    const res = await sendEvent();

    expect(res.status).toBe(200); // Stripe'a tekrar denetmemek icin 200
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro_plus'); // onceki degerde kaldi
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('eslesen kullanici yoksa sessizce gecilir, 200 doner', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, periodEnd),
    );

    const { payload, signature } = signedWebhook(
      ctx.stripe,
      invoicePaidEvent('cus_hic_olmayan'),
    );
    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
  });
});
