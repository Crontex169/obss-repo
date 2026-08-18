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

// Hikaye 3 kriter 2 / FR-018: ayni kullanicinin birden fazla "devam ediyor"
// gorusmesi bagimsizdir — birini ilerletmek digerini ETKILEMEZ.
describe('US3 coklu eszamanli gorusme', () => {
  let ctx: InterviewTestApp;
  const email = `us3-multi-${Date.now()}@example.com`;
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

  it('bir gorusme ilerletilince digeri degismez', async () => {
    const first = await createTestInterview(ctx, cookies, { questionCount: 5 });
    const second = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${first.interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(first.questions[0]) });

    const firstAfter = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${first.interviewId}`)
      .set('Cookie', cookies);
    const secondAfter = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${second.interviewId}`)
      .set('Cookie', cookies);

    expect(firstAfter.body.currentQuestionOrder).toBe(2);
    expect(firstAfter.body.answeredPairs).toHaveLength(1);

    // Ikinci gorusme HIC etkilenmedi.
    expect(secondAfter.body.currentQuestionOrder).toBe(1);
    expect(secondAfter.body.answeredPairs).toHaveLength(0);
    expect(secondAfter.body.status).toBe('in_progress');
  });
});
