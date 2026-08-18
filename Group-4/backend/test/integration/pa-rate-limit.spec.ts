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

// Faz 8 — Hiz siniri (FR-013, SC-012, §3.5): 5/saat/kullanici, basarili+basarisiz
// birlikte sayilir; okuma uc noktalarini ETKILEMEZ; dikeyler arasi izole.
describe('Hiz siniri (POST /api/pre-assessments)', () => {
  let ctx: PreAssessmentTestApp;

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('T066/SC-012: 6. ardisik istek -> 429 + details.retryAfterSeconds', async () => {
    const email = `pa-ratelimit-${Date.now()}@example.com`;
    const cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/pre-assessments')
        .set('Cookie', cookies)
        .send(validCreateBody());
      results.push(res.status);
      if (i === 5) {
        expect(res.status).toBe(429);
        expect(res.body.details?.retryAfterSeconds).toBeGreaterThan(0);
      }
    }

    expect(results.filter((s) => s === 429)).toHaveLength(1);

    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
  });

  it('T067: hiz siniri OKUMA uc noktalarini etkilemez — 429 sonrasi GET /active hala 200/204', async () => {
    const email = `pa-ratelimit-reads-${Date.now()}@example.com`;
    const cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    for (let i = 0; i < 5; i++) {
      await request(ctx.app.getHttpServer())
        .post('/api/pre-assessments')
        .set('Cookie', cookies)
        .send(validCreateBody());
    }
    const sixth = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(sixth.status).toBe(429);

    const active = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments/active')
      .set('Cookie', cookies);
    expect([200, 204]).toContain(active.status);

    const list = await request(ctx.app.getHttpServer())
      .get('/api/pre-assessments')
      .set('Cookie', cookies);
    expect(list.status).toBe(200);

    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
  });

  it('T068: dikeyler arasi izolasyon — bu dilimin 5/saat sayaci 002-interview sayacindan bagimsiz', async () => {
    const email = `pa-ratelimit-isolation-${Date.now()}@example.com`;
    const cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    // Bu dilimin kotasini tuket (5/saat).
    for (let i = 0; i < 5; i++) {
      await request(ctx.app.getHttpServer())
        .post('/api/pre-assessments')
        .set('Cookie', cookies)
        .send(validCreateBody());
    }
    const exhausted = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());
    expect(exhausted.status).toBe(429);

    // Ayni kullanicinin 002-interview POST /api/interviews kotasi (3/saat)
    // AYRI sayac oldugu icin hala musait olmali (429 DEGIL).
    ctx.fakeLlm.always({
      content: {
        position: null,
        questions: [
          {
            type: 'open_ended',
            text: 'Deneyiminizi anlatir misiniz?',
            options: [],
            tip: null,
            rationale: null,
          },
        ],
      },
    });
    const interviewRes = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Backend gelistirici araniyor.',
        questionCount: 1,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
      });
    expect(interviewRes.status).not.toBe(429);

    await ctx.prisma.interview.deleteMany({ where: { user: { email } } });
    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
  });
});
