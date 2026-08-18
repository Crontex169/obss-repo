import { REPORT_TIMEOUT_MS } from '../../src/interview/llm/report';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// SC-005 / §3.2: rapor cagrisi timeoutMs=60000 ile yapilir — varsayilan 30 sn
// onu keserdi. Gercek 45 sn beklemek yerine, cagriya GECEN timeoutMs degeri
// dogrulanir (birim seviyesinde 45sn/60sn yarisi zaten llm-timeout.spec.ts'te
// sahte zamanlayiciyla test edildi).
describe('US5 rapor timeout override', () => {
  let ctx: InterviewTestApp;
  const email = `us5-timeout-${Date.now()}@example.com`;
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

  it('rapor cagrisi 60 sn timeout ile yapilir, soru uretimi varsayilanla', async () => {
    await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { content: fakeReport() },
    });

    const [questionCall, reportCall] = ctx.fakeLlm.calls;

    expect(REPORT_TIMEOUT_MS).toBe(60_000);
    expect(reportCall.timeoutMs).toBe(60_000);
    // Soru uretimi override ETMEZ — env varsayilani (30 sn) kullanilir.
    expect(questionCall.timeoutMs).toBe(30_000);
    expect(reportCall.timeoutMs).toBeGreaterThan(questionCall.timeoutMs);
  });
});
