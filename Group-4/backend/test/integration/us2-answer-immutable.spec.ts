import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// Hikaye 2 kriter 3 / FR-007: zaten cevaplanmis soruya tekrar cevap -> 409;
// mevcut cevap DEGISMEZ.
describe('POST /api/interviews/:id/answers (US2 degismezlik)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-immutable-${Date.now()}@example.com`;
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

  it('cevaplanmis soruya tekrar cevap -> 409, mevcut cevap degismez', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: 'Ilk cevap' });

    const retry = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: 'Degistirilmis cevap' });

    expect(retry.status).toBe(409);

    const question = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 1 },
      include: { answer: true },
    });
    expect(question.answer?.content).toBe('Ilk cevap');
  });
});
