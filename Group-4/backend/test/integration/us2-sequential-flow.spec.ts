import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// Hikaye 2 kriter 1 / SC-003: soru i cevaplanir -> 200, yanit soru i+1'i doner
// ve soru i+1 bu ana kadar HIC donmemistir; currentQuestionOrder ilerler.
describe('POST /api/interviews/:id/answers (US2 sirali akis)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-flow-${Date.now()}@example.com`;
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

  it('soru 1 cevaplanir -> soru 2 doner, daha once hic gorulmemis olur', async () => {
    const created = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });
    const { interviewId, questions } = created;

    // Olusturma anindaki GET/POST yaniti yalnizca soru 1'i icerir — soru 2'nin
    // metni bu asamaya kadar istemciye HIC dondurulmemis olmali.
    const questionTwo = questions.find((q) => q.order === 2)!;

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: 'Cevap 1' });

    expect(res.status).toBe(200);
    expect(res.body.currentQuestion.order).toBe(2);
    expect(res.body.currentQuestion.text).toBe(questionTwo.text);
    expect(res.body.interview.currentQuestionOrder).toBe(2);
  });
});
