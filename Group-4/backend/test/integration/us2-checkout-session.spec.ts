// 010-odeme-abonelik US2 (T024): checkout ve portal uclari.
//
// Kritik iddia: `stripeCustomerId` kullanici YONLENDIRILMEDEN ONCE yazilir.
// Sonradan yazilsaydi, odeme tamamlanip webhook geldiginde olayi hangi
// kullaniciya baglayacagimizi bilemezdik ve govdedeki metadata'ya guvenmek
// zorunda kalirdik (plan.md "Güvenlik" /3).
import request from 'supertest';
import { createBillingTestApp, type BillingTestApp } from './helpers/billing-app';
import { registerAndSignIn } from './helpers/auth-session';

const stamp = Date.now();
const email = `checkout-${stamp}@example.com`;

describe('US2 — checkout / portal uclari', () => {
  let ctx: BillingTestApp;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createBillingTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('oturumsuz checkout -> 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/checkout')
      .send({ tier: 'pro' });

    expect(res.status).toBe(401);
  });

  it('gecersiz kademe -> 400, Stripe cagrilmaz', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/checkout')
      .set('Cookie', cookies)
      .send({ tier: 'altin' });

    expect(res.status).toBe(400);
    expect(ctx.mocks.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('"free" kademesi satin alinamaz -> 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/checkout')
      .set('Cookie', cookies)
      .send({ tier: 'free' });

    expect(res.status).toBe(400);
  });

  it('gecerli istek -> 200 ve yonlendirme adresi doner', async () => {
    ctx.mocks.customersCreate.mockResolvedValue({ id: 'cus_yeni' });
    ctx.mocks.checkoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.test/oturum',
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/checkout')
      .set('Cookie', cookies)
      .send({ tier: 'pro' });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://checkout.stripe.test/oturum');
  });

  it('stripeCustomerId YONLENDIRMEDEN ONCE yazildi', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.stripeCustomerId).toBe('cus_yeni');
  });

  it('plan HENUZ yukselmedi — odeme tamamlanmadi', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBeNull();
    expect(user.proUntil).toBeNull();
  });

  it('ikinci checkout AYNI musteriyi kullanir, yenisini yaratmaz', async () => {
    ctx.mocks.customersCreate.mockClear();
    ctx.mocks.checkoutSessionsCreate.mockResolvedValue({
      url: 'https://checkout.stripe.test/ikinci',
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/checkout')
      .set('Cookie', cookies)
      .send({ tier: 'pro_plus' });

    expect(res.status).toBe(200);
    expect(ctx.mocks.customersCreate).not.toHaveBeenCalled();
  });

  it('oturumsuz portal -> 401', async () => {
    const res = await request(ctx.app.getHttpServer()).post(
      '/api/billing/portal',
    );
    expect(res.status).toBe(401);
  });

  it('oturumlu portal -> 200 ve yonetim adresi doner', async () => {
    ctx.mocks.portalSessionsCreate.mockResolvedValue({
      url: 'https://portal.stripe.test/oturum',
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/portal')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://portal.stripe.test/oturum');
  });
});
