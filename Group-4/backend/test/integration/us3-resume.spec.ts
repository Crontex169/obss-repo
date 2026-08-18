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

// Hikaye 3 kriter 1 / FR-009, FR-006, SC-004: yarida birakilan gorusmeye
// donuldugunde onceki soru-cevap ciftleri DEGISMEDEN gelir, aktif soru
// currentQuestionOrder'dir ve SONRAKI sorular DONMEZ.
describe('GET /api/interviews/:id (US3 resume)', () => {
  let ctx: InterviewTestApp;
  const email = `us3-resume-${Date.now()}@example.com`;
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

  it('3 soru cevaplanmis gorusmede aktif soru 4, onceki cevaplar korunur, sonrakiler sizmaz', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const givenAnswers: string[] = [];
    for (const question of questions.slice(0, 3)) {
      const content = validAnswerFor(question);
      givenAnswers.push(content);
      await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/answers`)
        .set('Cookie', cookies)
        .send({ questionOrder: question.order, content });
    }

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.currentQuestionOrder).toBe(4);
    expect(res.body.currentQuestion.order).toBe(4);
    expect(res.body.currentQuestion.text).toBe(questions[3].text);

    // Onceki ciftler DEGISMEDEN geliyor.
    expect(res.body.answeredPairs).toHaveLength(3);
    res.body.answeredPairs.forEach((pair: any, i: number) => {
      expect(pair.order).toBe(i + 1);
      expect(pair.text).toBe(questions[i].text);
      expect(pair.answer.content).toBe(givenAnswers[i]);
    });

    // KRITIK (FR-006): soru 5'in metni yanitin HICBIR yerinde gecmemeli.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(questions[4].text);
  });

  it('tamamlanmis gorusmede tum ciftler ve rapor durumu doner, aktif soru null', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    for (const question of questions) {
      await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/answers`)
        .set('Cookie', cookies)
        .send({
          questionOrder: question.order,
          content: validAnswerFor(question),
        });
    }

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}`)
      .set('Cookie', cookies);

    expect(res.body.status).toBe('completed');
    expect(res.body.answeredPairs).toHaveLength(5);
    expect(res.body.currentQuestion).toBeNull();
    expect(res.body.reportStatus).toEqual(expect.any(String));
  });
});
