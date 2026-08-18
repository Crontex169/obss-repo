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

// Hikaye 2: goruntuleme, yeniden degerlendirme, arsiv (T038-T044).
//
// NOT: her test KENDI kullanicisini kaydeder (ortak bir kullaniciyi paylasmaz).
// Sebep: LlmRateLimitGuard 5/saat/kullanici kotasi TUM POST cagrilarini (basarili
// + basarisiz) sayar (FR-013, §3.5); tek bir paylasilan kullaniciyla art arda 6+
// POST yapan bir test dosyasi kendi kendine 429'a carpar ve FR-004/FR-009
// senaryolarini test edemez hale gelir - kota testi zaten ayri (Faz 8, T066).
describe('US2 — goruntuleme / yeniden degerlendirme / arsiv', () => {
  let ctx: PreAssessmentTestApp;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({
      where: { user: { email: { in: createdUsers } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: createdUsers } },
    });
    await ctx.app.close();
  });

  async function freshUser(tag: string) {
    const email = `pa-us2-${tag}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
    createdUsers.push(email);
    const cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    return { email, cookies };
  }

  it('H2-4: hic degerlendirme yokken GET /active -> 204', async () => {
    const { cookies } = await freshUser('empty');
    const res = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments/active')
      .set('Cookie', cookies);
    expect(res.status).toBe(204);
  });

  it('H2-1: GET /active -> 200, LLM CAGRILMAZ', async () => {
    const { cookies } = await freshUser('active');
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(created.status).toBe(201);

    ctx.fakeLlm.reset();
    const res = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments/active')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  it('H2-2/SC-009: yeniden degerlendirme -> yeni isActive=true, eski SILINMEZ isActive=false', async () => {
    const { cookies } = await freshUser('reassess');
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const first = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(first.status).toBe(201);

    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const reassessed = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(reassessed.status).toBe(201);
    expect(reassessed.body.isActive).toBe(true);

    const old = await ctx.prisma.preAssessment.findUnique({
      where: { id: first.body.id },
    });
    expect(old).not.toBeNull();
    expect(old?.isActive).toBe(false);
  });

  it('H2-3: gecmis listesi tarihe gore azalan, failed HARIC', async () => {
    const { cookies } = await freshUser('history');
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    ctx.fakeLlm.always({ error: new Error('boom') });
    await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    const res = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments')
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    const statuses = res.body.items.map((i: { status: string }) => i.status);
    expect(statuses).not.toContain('failed');
    const dates = res.body.items.map((i: { createdAt: string }) =>
      new Date(i.createdAt).getTime(),
    );
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it('H2-5: basarisiz yeniden degerlendirme mevcut aktif raporu BOZMAZ', async () => {
    const { cookies } = await freshUser('failed-reassess');
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const activeBefore = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(activeBefore.status).toBe(201);

    ctx.fakeLlm.always({ error: new Error('boom-again') });
    const failed = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(failed.status).toBe(502);

    const activeAfter = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments/active')
      .set('Cookie', cookies);
    expect(activeAfter.body.id).toBe(activeBefore.body.id);
  });

  it('T043 — eszamanli iki istek: hicbir kosulda IKI aktif kayit olusmaz (FR-004, SC-007)', async () => {
    const { cookies, email } = await freshUser('concurrency');
    ctx.fakeLlm.always({ content: fakeCompetencyReport(), delayMs: 300 });

    const [a, b] = await Promise.all([
      request(ctx.app.getHttpServer())
        .post('/api/pre-assessments')
        .set('Cookie', cookies)
        .send(validCreateBody()),
      request(ctx.app.getHttpServer())
        .post('/api/pre-assessments')
        .set('Cookie', cookies)
        .send(validCreateBody()),
    ]);

    // ⚠️ Bu test onceden [201, 409] bekliyordu ve TAM PAKET kosusunda flaky'di.
    // Sebep: [201, 201] de GECERLI bir sonuc. Iki transaction serilesirse
    // ikincinin `updateMany` adimi birincinin satirini gorup arsivler ve kendisi
    // aktif olur - bu tam olarak mesru "yeniden degerlendirme" akisidir (FR-009a),
    // hata degil. 409 yalnizca iki transaction'in dar bir pencerede birbirini
    // gormeden ilerledigi durumda olusur; hangi dalin calisacagi zamanlamaya bagli
    // oldugu icin STATU UZERINDEN assertion yapmak yanlis invariant'ti.
    //
    // FR-004/SC-007'nin gercek garantisi sudur: sonuc ne olursa olsun AYNI ANDA
    // birden fazla aktif kayit BULUNAMAZ (partial unique index bunu DB seviyesinde
    // saglar). Deterministik olan da budur.
    for (const status of [a.status, b.status]) {
      expect([201, 409]).toContain(status);
    }
    expect([a.status, b.status]).toContain(201);

    const activeCount = await ctx.prisma.preAssessment.count({
      where: { user: { email }, isActive: true },
    });
    expect(activeCount).toBe(1);
  });

  it('FR-019: arsivlenmis rapor uretildigi dilde doner, guncel Accept-Language yok sayilir', async () => {
    const { cookies } = await freshUser('language');
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .set('Accept-Language', 'tr-TR')
      .send(validCreateBody());
    expect(created.status).toBe(201);
    expect(created.body.language).toBe('tr');

    const readAsEnglish = await request(ctx.app.getHttpServer())
      .get(`/api/pre-assessments/${created.body.id}`)
      .set('Cookie', cookies)
      .set('Accept-Language', 'en-US');

    expect(readAsEnglish.body.language).toBe('tr');
  });
});
