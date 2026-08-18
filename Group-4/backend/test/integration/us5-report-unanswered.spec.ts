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
import { fakeReport } from './helpers/complete-interview';

// FR-027, contracts/interview-flow-rules.md §4.3 — T135.
describe('US5 bos cevapli rapor (cevap verilmedi isaretlemesi)', () => {
  let ctx: InterviewTestApp;
  const email = `us5-unanswered-${Date.now()}@example.com`;
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

  it('bos content ile kaydedilen cevap, rapor prompt transkriptinde "cevap verilmedi" olarak yer alir, atlanmaz', async () => {
    const questionCount = 5;
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount,
    });

    for (const question of questions) {
      if (question.order === questionCount) {
        ctx.fakeLlm.always({ content: fakeReport() });
      }
      // Ikinci soru suresi doldugu icin BOS gonderildi (FR-027 istemci akisi);
      // digerleri normal cevaplandi.
      const content = question.order === 2 ? '' : validAnswerFor(question);
      await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/answers`)
        .set('Cookie', cookies)
        .send({ questionOrder: question.order, content });
    }

    const reportCall = ctx.fakeLlm.calls.at(-1)!;
    expect(reportCall.userData).toContain('Cevap 2: cevap verilmedi');
    // Digerleri normal cevaplariyla gorunur, "cevap verilmedi" DEGILDIR.
    expect(reportCall.userData).toContain('Cevap 1: Serbest metin cevabi.');
    expect(reportCall.userData).not.toContain('Cevap 1: cevap verilmedi');

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.report.reportStatus ?? 'ready').toBeDefined();
  });
});
