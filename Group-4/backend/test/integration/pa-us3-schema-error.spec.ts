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

// H3-2: bos yanit ve sema uyumsuzlugu -> 502, rapor kaydedilmez.
describe('POST /api/pre-assessments (US3 sema hatasi)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us3-schema-${Date.now()}@example.com`;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('bos yanit -> 502, rapor kaydedilmez', async () => {
    ctx.fakeLlm.always({ rawContent: '' });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);
    expect(res.body.details?.retryable).toBe(true);
  });

  it('gecersiz JSON -> 502', async () => {
    ctx.fakeLlm.always({ rawContent: '{ bozuk json' });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);
  });

  it('eksik zorunlu alan (calismaTarziOzeti yok) -> 502, rapor yazilmaz', async () => {
    const { calismaTarziOzeti: _omitted, ...incomplete } =
      fakeCompetencyReport();
    ctx.fakeLlm.always({ content: incomplete });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);

    const records = await ctx.prisma.preAssessment.findMany({
      where: { user: { email } },
      include: { report: true },
    });
    expect(records.some((r) => r.status === 'failed')).toBe(true);
    expect(
      records
        .filter((r) => r.status === 'failed')
        .every((r) => r.report === null),
    ).toBe(true);
  });

  it('tek maddelik gucluYonler (min 2) -> 502', async () => {
    ctx.fakeLlm.always({
      content: { ...fakeCompetencyReport(), gucluYonler: ['tek'] },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);
  });

  it('fazladan "skor" alani iceren yanit -> 502 (.strict() reddeder, ADR-0007/R2)', async () => {
    ctx.fakeLlm.always({
      content: { ...fakeCompetencyReport(), skor: 87 },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);
  });
});
