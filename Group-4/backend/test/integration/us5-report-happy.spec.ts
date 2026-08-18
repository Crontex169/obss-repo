import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// Hikaye 5 kriter 1 / FR-013: son cevap sonrasi rapor OTOMATIK uretilir;
// 3 eksen skor 0-100 araliginda; reportStatus=ready.
describe('US5 rapor uretimi (mutlu yol)', () => {
  let ctx: InterviewTestApp;
  const email = `us5-happy-${Date.now()}@example.com`;
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

  it('son cevaptan sonra rapor uretilir ve skorlar 0-100 arasindadir', async () => {
    const { interviewId, lastResponse } = await completeInterview(
      ctx,
      cookies,
      {
        questionCount: 5,
        reportScenario: { content: fakeReport() },
      },
    );

    expect(lastResponse.status).toBe(200);
    expect(lastResponse.body.interview.reportStatus).toBe('ready');

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.reportStatus).toBe('ready');

    const report = res.body.report;
    expect(report.overallImpression).toEqual(expect.any(String));
    expect(Array.isArray(report.strengths)).toBe(true);
    expect(Array.isArray(report.improvementAreas)).toBe(true);
    for (const score of [
      report.technicalScore,
      report.behavioralScore,
      report.generalScore,
    ]) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('sema disi skor (>100) -> LlmSchemaError, rapor yazilmaz', async () => {
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: {
        content: fakeReport({
          scores: { technical: 150, behavioral: 80, general: 75 },
        }),
      },
    });

    const interview = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { report: true },
    });
    expect(interview.reportStatus).toBe('failed');
    expect(interview.report).toBeNull();
  });
});
