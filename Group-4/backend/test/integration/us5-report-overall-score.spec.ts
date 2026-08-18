import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// FR-026, SC-014, FR-014 — T127.
describe('US5 genel puan (overallScore)', () => {
  let ctx: InterviewTestApp;
  const email = `us5-overall-score-${Date.now()}@example.com`;
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

  it('overallScore = round((technical+behavioral+general)/3), tekrar acilinca ayni deger doner', async () => {
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: {
        content: fakeReport({
          scores: { technical: 72, behavioral: 80, general: 75 },
        }),
      },
    });

    const first = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);

    expect(first.status).toBe(200);
    expect(first.body.report.overallScore).toBe(76); // round(227/3) = round(75.67) = 76

    const callCountBefore = ctx.fakeLlm.calls.length;

    // Rapor tekrar acildiginda AYNI deger doner, yeni LLM cagrisi YAPILMAZ.
    const second = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);

    expect(second.body.report.overallScore).toBe(76);
    expect(ctx.fakeLlm.calls.length).toBe(callCountBefore);
  });

  it('LLM yanitinda genel puan alani gelirse yok sayilir (eksenlerle celisen puan uretilemez)', async () => {
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: {
        // LLM sozlesmede olmayan bir alan gondermeye calisiyor — Zod
        // stripUnknownKeys varsayilaniyla dusurulur, sunucu hesabi gecerli olur.
        content: {
          ...fakeReport({
            scores: { technical: 0, behavioral: 0, general: 0 },
          }),
          overallScore: 999,
        },
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);

    expect(res.body.report.overallScore).toBe(0);
  });
});
