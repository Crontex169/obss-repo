import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  createTestInterview,
  validAnswerFor,
} from './helpers/create-test-interview';

// Hikaye 3 kriter 3 / FR-017, §1: baska kullanicinin gorusmesine id ile erisim
// -> 404, icerik SIZMAZ ve "yok" yanitindan AYIRT EDILEMEZ.
describe('US3 yetkisiz resume', () => {
  let ctx: InterviewTestApp;
  const ownerEmail = `us3-owner-${Date.now()}@example.com`;
  const strangerEmail = `us3-stranger-${Date.now()}@example.com`;
  let ownerCookies: string[];
  let strangerCookies: string[];
  let interviewId: string;
  let questionText: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    ownerCookies = await registerAndSignIn(ctx.app, ctx.prisma, ownerEmail);
    strangerCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      strangerEmail,
    );

    const created = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });
    interviewId = created.interviewId;
    questionText = created.questions[0].text;

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', ownerCookies)
      .send({
        questionOrder: 1,
        content: validAnswerFor(created.questions[0]),
      });
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

  it('yabanci kullanici -> 404, soru/cevap icerigi sizmaz', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}`)
      .set('Cookie', strangerCookies);

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(questionText);
    expect(res.body.answeredPairs).toBeUndefined();
  });

  it('"sahip degil" ile "yok" yanitlari birebir AYNI', async () => {
    const foreign = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}`)
      .set('Cookie', strangerCookies);
    const missing = await request(ctx.app.getHttpServer())
      .get('/api/interviews/clhicdoesnotexist0000000')
      .set('Cookie', strangerCookies);

    expect(foreign.status).toBe(missing.status);
    expect(foreign.body).toEqual(missing.body);
  });

  it('yabanci kullanicinin listesinde bu gorusme YOK', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/interviews')
      .set('Cookie', strangerCookies);

    expect(res.status).toBe(200);
    expect(res.body.map((i: { id: string }) => i.id)).not.toContain(
      interviewId,
    );
  });
});
