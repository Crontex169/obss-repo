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

// Hikaye 4 kriter 3 / FR-011: adaptif LLM cagrisi hata/zaman asimi verirse
// akis KESILMEZ — siradaki soru baseline haliyle (isBaseline=true) sunulur.
describe('US4 adaptif uyarlama hatasi (baseline korunur)', () => {
  let ctx: InterviewTestApp;
  const email = `us4-fallback-${Date.now()}@example.com`;
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

  it('LLM hatasinda cevap kaydedilir ve baseline soru degismeden sunulur', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });
    const baselineSecond = questions[1].text;

    ctx.fakeLlm.always({ error: new Error('adaptive provider down') });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    // Akis KESILMEDI: istek basarili, siradaki soru geldi.
    expect(res.status).toBe(200);
    expect(res.body.currentQuestion.order).toBe(2);
    expect(res.body.currentQuestion.text).toBe(baselineSecond);

    const second = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 2 },
    });
    expect(second.isBaseline).toBe(true);
    expect(second.adaptedFromAnswerId).toBeNull();
    expect(second.text).toBe(baselineSecond);

    // Cevap KAYBOLMADI.
    const answers = await ctx.prisma.answer.count({
      where: { question: { interviewId } },
    });
    expect(answers).toBe(1);
  });

  it('sema uyumsuz adaptif yanitta da baseline korunur', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });
    const baselineSecond = questions[1].text;

    // nextQuestion eksik -> katman-2 Zod reddeder.
    ctx.fakeLlm.always({ content: { evaluationSummary: 'ozet' } });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.currentQuestion.text).toBe(baselineSecond);
  });
});
