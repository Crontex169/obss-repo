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

// Hikaye 4 kriter 1 / FR-010: guclu cevap -> siradaki soru icerigi DEGISIR,
// isBaseline=false, adaptedFromAnswerId dolu.
describe('US4 adaptif uyarlama (zorluk artisi)', () => {
  let ctx: InterviewTestApp;
  const email = `us4-up-${Date.now()}@example.com`;
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

  it('cevap sonrasi siradaki soru uyarlanir ve izi kaydedilir', async () => {
    // mode=voice: tum sorular open_ended -> uyarlama tipi sabit kalir.
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });
    const baselineSecond = questions[1].text;

    ctx.fakeLlm.always({
      content: fakeAdaptive('Uyarlanmis daha zor soru: mimariyi anlatin.'),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.currentQuestion.text).toBe(
      'Uyarlanmis daha zor soru: mimariyi anlatin.',
    );
    expect(res.body.currentQuestion.text).not.toBe(baselineSecond);

    const second = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 2 },
    });
    expect(second.isBaseline).toBe(false);
    expect(second.adaptedFromAnswerId).not.toBeNull();

    // adaptedFromAnswerId GERCEKTEN 1. sorunun cevabini isaret etmeli.
    const firstAnswer = await ctx.prisma.answer.findFirstOrThrow({
      where: { question: { interviewId, order: 1 } },
    });
    expect(second.adaptedFromAnswerId).toBe(firstAnswer.id);
  });
});
