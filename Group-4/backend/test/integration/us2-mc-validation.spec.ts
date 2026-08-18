import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// Hikaye 2 kriter 5 / FR-008: coktan secmeli soruda options listesinde
// olmayan bir deger -> 400.
describe('POST /api/interviews/:id/answers (US2 coktan secmeli dogrulama)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-mc-${Date.now()}@example.com`;
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

  it('options disinda bir deger -> 400; gecerli secenek -> 200', async () => {
    // fakeQuestions('written'): order 2 (i=1) multiple_choice, ['Secenek A','Secenek B'].
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'written',
    });

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: 'Serbest cevap' });

    const invalid = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 2, content: 'Listede olmayan secenek' });
    expect(invalid.status).toBe(400);

    const valid = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 2, content: 'Secenek A' });
    expect(valid.status).toBe(200);
  });
});
