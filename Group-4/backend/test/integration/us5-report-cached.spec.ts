import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// Hikaye 5 kriter 3 / FR-014, SC-007: rapor iki kez cagrilir -> ayni icerik ve
// fake LLM cagri sayaci ARTMAZ (kaydedilmis rapordan okunur).
describe('US5 rapor yeniden goruntuleme (LLM cagrisi yok)', () => {
  let ctx: InterviewTestApp;
  const email = `us5-cached-${Date.now()}@example.com`;
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

  it('iki GET ayni raporu doner, LLM tekrar cagrilmaz', async () => {
    const { interviewId } = await completeInterview(ctx, cookies, {
      questionCount: 5,
      reportScenario: { content: fakeReport() },
    });

    // Soru uretimi (1) + rapor uretimi (1) = 2 cagri yapilmis olmali.
    const callsAfterGeneration = ctx.fakeLlm.calls.length;
    expect(callsAfterGeneration).toBe(2);

    const first = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);
    const second = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}/report`)
      .set('Cookie', cookies);

    expect(first.status).toBe(200);
    expect(second.body.report).toEqual(first.body.report);
    // KRITIK: goruntuleme LLM'e gitmez.
    expect(ctx.fakeLlm.calls.length).toBe(callsAfterGeneration);
  });
});
