// 010-odeme-abonelik US3 (T033): kademe degisimi `customer.subscription.updated`
// olayiyla gelir (spec.md US3 senaryo 5).
//
// us2-webhook-upgrades-plan.spec.ts kademe degisimini `invoice.paid` yolundan
// dogruluyor; bu dosya IKINCI olay turunu kapsar. Kullanici Portal'dan plan
// degistirdiginde her zaman fatura olusmaz (ornegin donem sonuna planlanan
// degisimde), o yuzden iki yol da islenmek zorunda.
import request from 'supertest';
import {
  createBillingTestApp,
  signedWebhook,
  subscriptionUpdatedEvent,
  subscriptionListResponse,
  TEST_PRICE_PRO,
  TEST_PRICE_PRO_PLUS,
  type BillingTestApp,
} from './helpers/billing-app';

const stamp = Date.now();
const email = `tier-change-${stamp}@example.com`;
const customerId = `cus_tier_${stamp}`;
const periodEnd = Math.floor(Date.now() / 1000) + 30 * 86_400;

describe('US3 — kademe degisimi (customer.subscription.updated)', () => {
  let ctx: BillingTestApp;

  beforeAll(async () => {
    ctx = await createBillingTestApp();
    await ctx.prisma.user.create({
      data: {
        email,
        name: email,
        emailVerified: true,
        stripeCustomerId: customerId,
        planTier: 'pro',
        proUntil: new Date(periodEnd * 1000),
      },
    });
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  function sendSubscriptionUpdated() {
    const { payload, signature } = signedWebhook(
      ctx.stripe,
      subscriptionUpdatedEvent(customerId),
    );
    return request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  }

  it('pro -> pro_plus yukseltmesi planTier"i gunceller', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO_PLUS, periodEnd),
    );

    const res = await sendSubscriptionUpdated();
    expect(res.status).toBe(200);

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro_plus');
  });

  it('proUntil kademe degisiminde BOZULMAZ', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('pro_plus -> pro dusurmesi de islenir', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO, periodEnd),
    );

    await sendSubscriptionUpdated();

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro');
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });

  it('gecersiz imzali kademe degisimi plani DEGISTIRMEZ', async () => {
    ctx.mocks.subscriptionsList.mockResolvedValue(
      subscriptionListResponse(TEST_PRICE_PRO_PLUS, periodEnd),
    );

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=sahte')
      .send(JSON.stringify(subscriptionUpdatedEvent(customerId)));

    expect(res.status).toBe(400);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro');
  });

  it('iptal icin olay DINLENMEZ — customer.subscription.deleted hicbir sey yapmaz', async () => {
    // Iptalde kullanici odedigi donemi kullanmaya DEVAM EDER (FR-016).
    // proUntil dokunulmaz; dusme tarihin dolmasiyla kendiliginden olur.
    const { payload, signature } = signedWebhook(ctx.stripe, {
      id: 'evt_cancel',
      object: 'event',
      type: 'customer.subscription.deleted',
      data: { object: { object: 'subscription', customer: customerId } },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(200);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro');
    expect(user.proUntil?.getTime()).toBe(periodEnd * 1000);
  });
});
