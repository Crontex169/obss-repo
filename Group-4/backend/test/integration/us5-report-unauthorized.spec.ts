import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// Hikaye 5 kriter 5 / FR-017, SC-006, §1: baska kullanicinin raporuna id bilerek
// erisim -> 404, icerik sizmaz; "yok" yanitindan AYIRT EDILEMEZ.
describe('US5 rapor yetkisiz erisim', () => {
  let ctx: InterviewTestApp;
  const ownerEmail = `us5-owner-${Date.now()}@example.com`;
  const strangerEmail = `us5-stranger-${Date.now()}@example.com`;
  let ownerCookies: string[];
  let strangerCookies: string[];
  let interviewId: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    ownerCookies = await registerAndSignIn(ctx.app, ctx.prisma, ownerEmail);
    strangerCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      strangerEmail,
    );

    ({ interviewId } = await completeInterview(ctx, ownerCookies, {
      questionCount: 5,
      reportScenario: { content: fakeReport() },
    }));
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: [ownerEmail, strangerEmail] } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, strangerEmail] } },
    });
    await ctx.app.close();
  });

  it('yabanci kullanici -> 404 ve icerik sizmaz', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', strangerCookies);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('overallImpression');
    expect(res.body.report).toBeUndefined();
  });

  it('"sahip degil" ile "yok" yanitlari AYIRT EDILEMEZ', async () => {
    const foreign = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', strangerCookies);
    const missing = await request(ctx.app.getHttpServer())
      .get('/api/interviews/clhiclydoesnotexist000000/report')
      .set('Cookie', strangerCookies);

    expect(foreign.status).toBe(missing.status);
    expect(foreign.body).toEqual(missing.body);
  });

  it('sahip normal erisir (kontrol)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(200);
  });
});
