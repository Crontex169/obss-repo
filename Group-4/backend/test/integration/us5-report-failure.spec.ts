import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview } from './helpers/complete-interview';

// Hikaye 5 kriter 2 / FR-015, SC-008: LLM hatasi -> reportStatus=failed,
// Report YAZILMAZ, cevaplanmis soru/cevaplar KORUNUR, GET -> 409 + retry talimati.
describe('US5 rapor uretimi hatasi', () => {
  let ctx: InterviewTestApp;
  const email = `us5-failure-${Date.now()}@example.com`;
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

  it('LLM hatasinda cevaplar korunur, rapor yazilmaz, GET 409 doner', async () => {
    const { interviewId, lastResponse } = await completeInterview(
      ctx,
      cookies,
      {
        questionCount: 5,
        reportScenario: { error: new Error('provider down') },
      },
    );

    // Son cevap KAYBEDILMEZ: gorusme tamamlandi, yalnizca rapor basarisiz.
    expect(lastResponse.status).toBe(200);
    expect(lastResponse.body.interview.status).toBe('completed');
    expect(lastResponse.body.interview.reportStatus).toBe('failed');

    const interview = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { report: true, questions: { include: { answer: true } } },
    });
    expect(interview.report).toBeNull();
    expect(interview.questions.every((q) => q.answer !== null)).toBe(true);

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
    expect(res.body.message).toEqual(expect.any(String));
  });
});
