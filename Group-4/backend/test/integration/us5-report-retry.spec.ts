import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// Hikaye 5 kriter 4: failed -> retry -> ready; failed OLMAYAN durumda retry -> 409.
describe('US5 rapor yeniden deneme', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let counter = 0;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  // Her test kendi kullanicisiyla: olusturma (3/saat) ve retry (5/saat)
  // kotalari testler arasinda tasmasin.
  async function freshCookies(): Promise<string[]> {
    counter += 1;
    const email = `us5-retry-${Date.now()}-${counter}@example.com`;
    emails.push(email);
    return registerAndSignIn(ctx.app, ctx.prisma, email);
  }

  it('failed durumda retry -> ready, rapor uretilir', async () => {
    const cookies = await freshCookies();
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { error: new Error('provider down') },
    });

    ctx.fakeLlm.always({ content: fakeReport() });
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report/retry`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.reportStatus).toBe('ready');
    expect(res.body.report.technicalScore).toBe(72);
  });

  it('retry tekrar basarisiz olursa 502 doner, veri kaybi olmaz', async () => {
    const cookies = await freshCookies();
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { error: new Error('provider down') },
    });

    // Hala basarisiz senaryo devrede.
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report/retry`)
      .set('Cookie', cookies);

    expect(res.status).toBe(502);

    const interview = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { questions: { include: { answer: true } } },
    });
    expect(interview.reportStatus).toBe('failed');
    expect(interview.questions.every((q) => q.answer !== null)).toBe(true);
  });

  it('ready durumda retry -> 409 (uygulanamaz durum)', async () => {
    const cookies = await freshCookies();
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { content: fakeReport() },
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report/retry`)
      .set('Cookie', cookies);

    expect(res.status).toBe(409);
  });
});
