import request from 'supertest';
import {
  createPreAssessmentTestApp,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { registerAndSignIn } from './helpers/auth-session';
import { validCreateBody } from './helpers/fake-competency-report';

// T098 / H1-8 / FR-003 / SC-008 — serbest metin SINIR dogrulamasi.
//
// 2026-08-04'te bu dilim ilk kez serbest metin kabul etmeye basladi (FR-002b/c).
// Kapali listenin sagladigi dogal ust sinir kayboldugu icin adet/uzunluk siniri
// artik TEK savunma hattidir; sinir asimi LLM'e ULASMADAN reddedilmelidir.
describe('POST /api/pre-assessments (serbest metin sinirlari)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us1-limits-${Date.now()}@example.com`;
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

  it('16 etiket (sinir 15) -> 400, LLM cagrilmaz', async () => {
    ctx.fakeLlm.reset();
    const skills = Array.from({ length: 16 }, (_, i) => `etiket-${i}`);

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ skills }));

    expect(res.status).toBe(400);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  it('41 karakterlik etiket (sinir 40) -> 400, LLM cagrilmaz', async () => {
    ctx.fakeLlm.reset();

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ skills: ['x'.repeat(41)] }));

    expect(res.status).toBe(400);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  it('301 karakterlik acik uclu cevap (sinir 300) -> 400, LLM cagrilmaz', async () => {
    ctx.fakeLlm.reset();

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          openAnswers: { enIyiOldugum: 'a'.repeat(301) },
        }),
      );

    expect(res.status).toBe(400);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  it('tanimsiz acik uclu alan adi -> 400 (.strict, FR-003)', async () => {
    ctx.fakeLlm.reset();

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ openAnswers: { uydurmaAlan: 'merhaba' } }));

    expect(res.status).toBe(400);
    expect(ctx.fakeLlm.calls).toHaveLength(0);
  });

  it('tam sinirda (15 etiket / 40 karakter / 300 karakter) KABUL edilir', async () => {
    ctx.fakeLlm.always({
      content: {
        genelOzet: 'x'.repeat(60),
        gucluYonler: ['a', 'b'],
        gelisimAlanlari: ['c', 'd'],
        calismaTarziOzeti: 'y'.repeat(40),
        guvenSeviyesi: 'orta',
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          skills: Array.from({ length: 15 }, (_, i) => `e${i}`.padEnd(40, 'x')),
          openAnswers: { enIyiOldugum: 'a'.repeat(300) },
        }),
      );

    expect(res.status).toBe(201);
  });
});
