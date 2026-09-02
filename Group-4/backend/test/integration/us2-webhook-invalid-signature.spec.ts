// 010-odeme-abonelik US2 (T021) — BU DILIMIN EN KRITIK TESTI.
//
// /api/billing/webhook oturum guard'i ALAMAZ (Stripe cerez gondermez) ve
// OriginGuard bu istegi gecirir (Origin basligi yok — origin.guard.ts bunu
// kasitli olarak serbest birakir). Dolayisiyla uc noktanin TEK korumasi Stripe
// imzasidir. Imza dogrulamasi atlanirsa/bozulursa adresi bilen HERKES kendine
// ucretli plan tanimlayabilir.
//
// Yanitin 400 olmasi YETMEZ: asil iddia, reddedilen istegin veritabaninda
// HICBIR DEGISIKLIK birakmamasidir (spec.md FR-013).
import request from 'supertest';
import {
  createBillingTestApp,
  invoicePaidEvent,
  type BillingTestApp,
} from './helpers/billing-app';

const email = `webhook-badsig-${Date.now()}@example.com`;
const customerId = `cus_badsig_${Date.now()}`;

describe('US2 — gecersiz imzali webhook reddedilir ve hicbir sey yazmaz', () => {
  let ctx: BillingTestApp;

  beforeAll(async () => {
    ctx = await createBillingTestApp();

    // Saglayici musterisi ZATEN eslesmis bir kullanici: imza dogrulamasi
    // atlansaydi bu kullanicinin plani yukselirdi. Testin anlami buna dayanir.
    await ctx.prisma.user.create({
      data: {
        email,
        name: email,
        emailVerified: true,
        stripeCustomerId: customerId,
      },
    });
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  function postWebhook(signature?: string) {
    const req = request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json');
    if (signature !== undefined) req.set('stripe-signature', signature);
    return req.send(JSON.stringify(invoicePaidEvent(customerId)));
  }

  it('uydurma imza -> 400', async () => {
    const res = await postWebhook('t=1,v1=sahte');
    expect(res.status).toBe(400);
  });

  it('imza basligi HIC YOK -> 400', async () => {
    const res = await postWebhook();
    expect(res.status).toBe(400);
  });

  it('bos imza basligi -> 400', async () => {
    const res = await postWebhook('');
    expect(res.status).toBe(400);
  });

  it('dogru bicimli ama YANLIS SIRLA uretilmis imza -> 400', async () => {
    // Bicim gecerli, kripto imza yanlis: "sadece basligin varligina bakiliyor"
    // seklindeki bir hatayi yakalar.
    const payload = JSON.stringify(invoicePaidEvent(customerId));
    const signature = ctx.stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_yanlis_sir',
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('reddedilen isteklerin HICBIRI veritabanini degistirmedi', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBeNull();
    expect(user.proUntil).toBeNull();
  });

  it('reddedilen istek Stripe API cagrisi da yapmadi', async () => {
    // Imza dogrulanmadan aboneligi okumak, dogrulamanin ONUNE gecmis bir yan
    // etki demektir; olay govdesindeki verilere hic dokunulmamali.
    expect(ctx.mocks.subscriptionsList).not.toHaveBeenCalled();
  });
});
