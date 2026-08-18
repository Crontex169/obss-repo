import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview } from './helpers/complete-interview';

// FR-022 / §3.5: retry uc noktasi 5/saat. 6. istek -> 429.
// Sayac basarili + basarisiz cagrilari birlikte sayar; burada hepsi basarisiz
// (fake hata senaryosu devrede) ama kota yine tukenir.
describe('US5 retry hiz siniri', () => {
  let ctx: InterviewTestApp;
  const email = `us5-retrylimit-${Date.now()}@example.com`;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('6. retry istegi 429 doner', async () => {
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { error: new Error('provider down') },
    });

    let last!: request.Response;
    for (let i = 0; i < 6; i += 1) {
      last = await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/report/retry`)
        .set('Cookie', cookies);
    }

    expect(last.status).toBe(429);
    expect(last.body.details.retryAfterSeconds).toBeGreaterThan(0);
  }, 30_000);
});
