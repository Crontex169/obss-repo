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

// H3-1, §3.4: saglayici hatasi -> 502, details.retryable:true, CompetencyReport
// yazilmaz, status=failed, mevcut aktif rapor DEGISMEZ (FR-008/FR-009).
describe('POST /api/pre-assessments (US3 saglayici hatasi)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us3-provider-${Date.now()}@example.com`;
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

  it('502 doner, rapor yazilmaz, status=failed', async () => {
    ctx.fakeLlm.always({ error: new Error('ECONNREFUSED') });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(502);
    expect(res.body.details?.retryable).toBe(true);

    // id govdede donmuyor (hata zarfi) - kullanicinin kaydina dogrudan bakiyoruz.
    const records = await ctx.prisma.preAssessment.findMany({
      where: { user: { email } },
      include: { report: true },
    });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('failed');
    expect(records[0].failureReason).toBe('provider');
    expect(records[0].report).toBeNull();
    expect(records[0].isActive).toBe(false);
  });

  it('mevcut aktif rapor basarisiz yeniden denemede DEGISMEZ (H2-5)', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const first = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(first.status).toBe(201);

    ctx.fakeLlm.always({ error: new Error('ECONNREFUSED') });
    const second = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(second.status).toBe(502);

    const active = await ctx.prisma.preAssessment.findFirst({
      where: { user: { email }, isActive: true },
    });
    expect(active?.id).toBe(first.body.id);
  });
});
