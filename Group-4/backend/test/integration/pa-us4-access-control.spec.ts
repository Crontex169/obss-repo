import request from 'supertest';
import {
  createPreAssessmentTestApp,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  fakeCompetencyReport,
  validCreateBody,
} from './helpers/fake-competency-report';

// Hikaye 4: erisim denetimi ve sahiplik (T051-T055).
describe('US4 — erisim denetimi ve sahiplik', () => {
  let ctx: PreAssessmentTestApp;
  const emailA = `pa-us4-a-${Date.now()}@example.com`;
  const emailB = `pa-us4-b-${Date.now()}@example.com`;
  const emailAdmin = `pa-us4-admin-${Date.now()}@example.com`;
  let cookiesA: string[];
  let cookiesB: string[];
  let cookiesAdmin: string[];
  let recordAId: string;

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
    cookiesA = await registerAndSignIn(ctx.app, ctx.prisma, emailA);
    cookiesB = await registerAndSignIn(ctx.app, ctx.prisma, emailB);
    cookiesAdmin = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      emailAdmin,
      'admin',
    );

    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookiesA)
      .send(validCreateBody());
    recordAId = created.body.id;
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({
      where: { user: { email: { in: [emailA, emailB, emailAdmin] } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB, emailAdmin] } },
    });
    await ctx.app.close();
  });

  it('H4-1: oturumsuz istek tum uc noktalarda 401', async () => {
    const server = ctx.app.getHttpServer();
    expect(
      (await request(server).post('/api/pre-assessments').send({})).status,
    ).toBe(401);
    expect(
      (await request(server).get('/api/pre-assessments/active')).status,
    ).toBe(401);
    expect((await request(server).get('/api/pre-assessments')).status).toBe(
      401,
    );
    expect(
      (await request(server).get(`/api/pre-assessments/${recordAId}`)).status,
    ).toBe(401);
  });

  it("H4-2/§1: B kullanicisi A'nin kaydina GET /:id ile erismeye calisirsa 404 (403 DEGIL)", async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/pre-assessments/${recordAId}`)
      .set('Cookie', cookiesB);

    expect(res.status).toBe(404);

    const nonExistent = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments/does-not-exist')
      .set('Cookie', cookiesB);
    // Ayirt edilemez: ayni statu + BIREBIR ayni govde.
    expect(nonExistent.status).toBe(404);
    expect(nonExistent.body).toEqual(res.body);
  });

  it('H4-3/H4-4: kendi kaydi 200, admin baskasinin kaydini icerikle okur', async () => {
    const own = await request(ctx.app.getHttpServer())
      .get(`/api/pre-assessments/${recordAId}`)
      .set('Cookie', cookiesA);
    expect(own.status).toBe(200);
    expect(own.body.report).toBeDefined();

    const asAdmin = await request(ctx.app.getHttpServer())
      .get(`/api/pre-assessments/${recordAId}`)
      .set('Cookie', cookiesAdmin);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.report).toBeDefined();
  });

  it('H4-5/FR-011a: admin POST -> 403 (salt okunur)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookiesAdmin)
      .send(validCreateBody());

    expect(res.status).toBe(403);
  });

  it('H4-6: role=user icin ?userId= sorgu parametresi YOK SAYILIR (kendi kaydi doner)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(
        `/api/pre-assessments/active?userId=${encodeURIComponent('someone-else')}`,
      )
      .set('Cookie', cookiesB);

    // B'nin aktif kaydi yok -> 204 doner, A'nin kaydina YONLENDIRILMEZ.
    expect(res.status).toBe(204);
  });

  it('admin ?userId= ile baskasinin aktif kaydini okuyabilir', async () => {
    const [, userId] = await Promise.all([
      Promise.resolve(),
      ctx.prisma.user
        .findUniqueOrThrow({ where: { email: emailA } })
        .then((u) => u.id),
    ]);

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/pre-assessments/active?userId=${userId}`)
      .set('Cookie', cookiesAdmin);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(recordAId);
  });
});
