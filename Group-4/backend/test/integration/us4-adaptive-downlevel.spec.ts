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
import { fakeAdaptive } from './helpers/fake-adaptive';

// Hikaye 4 kriter 2 / FR-010: zayif cevapta siradaki soru daha temel seviyeye
// ceker; TOPLAM SORU SAYISI N degismez (uyarlama soru eklemez/silmez).
describe('US4 adaptif uyarlama (seviye dusurme + N sabitligi)', () => {
  let ctx: InterviewTestApp;
  const email = `us4-down-${Date.now()}@example.com`;
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

  it('zayif cevapta soru temellesir, soru sayisi N sabit kalir', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });

    ctx.fakeLlm.always({
      content: fakeAdaptive('Daha temel soru: degisken nedir?'),
    });

    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    const second = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 2 },
    });
    expect(second.text).toBe('Daha temel soru: degisken nedir?');

    // KRITIK: uyarlama soru EKLEMEZ/SILMEZ.
    const total = await ctx.prisma.question.count({ where: { interviewId } });
    expect(total).toBe(5);

    const interview = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });
    expect(interview.questionCount).toBe(5);

    // order degerleri 1..N bozulmadi.
    const orders = (
      await ctx.prisma.question.findMany({
        where: { interviewId },
        orderBy: { order: 'asc' },
        select: { order: true },
      })
    ).map((q) => q.order);
    expect(orders).toEqual([1, 2, 3, 4, 5]);
  });
});
