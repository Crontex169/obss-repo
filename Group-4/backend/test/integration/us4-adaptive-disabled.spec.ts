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

// Hikaye 4 kriter 4: adaptiveEnabled=false -> sorular uretim anindaki icerikle
// sunulur ve HIC LLM uyarlama cagrisi yapilmaz.
describe('US4 adaptif kapali', () => {
  let ctx: InterviewTestApp;
  const email = `us4-disabled-${Date.now()}@example.com`;
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

  it('sorular degismez ve ek LLM cagrisi yapilmaz', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: false,
    });

    // Soru uretimi = 1 cagri. Bundan sonra artmamali.
    const callsAfterCreate = ctx.fakeLlm.calls.length;
    expect(callsAfterCreate).toBe(1);

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 2, content: validAnswerFor(questions[1]) });

    // KRITIK: hicbir uyarlama cagrisi yapilmadi.
    expect(ctx.fakeLlm.calls.length).toBe(callsAfterCreate);

    const stored = await ctx.prisma.question.findMany({
      where: { interviewId },
      orderBy: { order: 'asc' },
    });
    stored.forEach((q, i) => {
      expect(q.text).toBe(questions[i].text);
      expect(q.isBaseline).toBe(true);
      expect(q.adaptedFromAnswerId).toBeNull();
    });
  });
});
