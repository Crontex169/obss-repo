import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// Hikaye 2 kriter 4 / FR-006, SC-003: sirasi gelmemis soruya dogrudan cevap
// (istemci baypasi) -> 409.
describe('POST /api/interviews/:id/answers (US2 sira kilidi)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-lock-${Date.now()}@example.com`;
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

  it('soru 1 cevaplanmadan soru 2ye dogrudan cevap -> 409', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 2, content: 'Erken cevap' });

    expect(res.status).toBe(409);

    const answers = await ctx.prisma.answer.count({
      where: { question: { interviewId } },
    });
    expect(answers).toBe(0);
  });
});
