import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// Hikaye 1 kriter 1 / SC-001: serbest metin + N=8 + written + junior -> 201,
// tam N Question, status=in_progress, reportStatus=not_applicable,
// currentQuestionOrder=1; istek 30 sn altinda.
describe('POST /api/interviews (US1 mutlu yol)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-happy-${Date.now()}@example.com`;
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

  it('201 doner, tam N soru olusturur, 30 sn altinda kalir', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(8) });

    const start = Date.now();
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText:
          'Aramizda 3 yil deneyimli backend gelistirici ariyoruz.',
        questionCount: 8,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
      });
    const elapsedMs = Date.now() - start;

    expect(res.status).toBe(201);
    expect(elapsedMs).toBeLessThan(30_000);
    expect(res.body.interview).toMatchObject({
      status: 'in_progress',
      reportStatus: 'not_applicable',
      currentQuestionOrder: 1,
    });

    const questions = await ctx.prisma.question.findMany({
      where: { interviewId: res.body.interview.id },
    });
    expect(questions).toHaveLength(8);
  });
});
