import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// FR-022 / §3.5: saat icinde 61. cevap -> 429. Guard, DTO dogrulamasindan/servis
// mantigindan ONCE calisir (bkz. us1-rate-limit.spec.ts ile ayni sira) — bu yuzden
// N=1'lik bir gorusmede ilk cevap 200, sonraki tekrarlar servis tarafinda 409 doner
// ama KOTAYI TUKETMEYE devam eder; 61. istekte guard 429 firlatir.
describe('POST /api/interviews/:id/answers (US2 hiz siniri)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-ratelimit-${Date.now()}@example.com`;
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

  it('61. cevap istegi 429 doner', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    let last!: request.Response;
    for (let i = 0; i < 61; i += 1) {
      last = await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/answers`)
        .set('Cookie', cookies)
        .send({ questionOrder: 1, content: 'Cevap' });
    }

    expect(last.status).toBe(429);
    expect(last.body.details.retryAfterSeconds).toBeGreaterThan(0);
  }, 30_000);
});
