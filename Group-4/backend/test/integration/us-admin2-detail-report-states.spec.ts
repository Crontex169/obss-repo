import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

jest.setTimeout(60_000);

// 005-admin US2 / T022 — FR-006, FR-007 + API_CONVENTIONS.md §2:
// rapor hazir degilse report null doner ve IC HATA DETAYI sizmaz;
// TokenUsage kaydi yoksa tokenUsage null doner (zarif "veri yok").
describe('US2-admin detay: rapor durumlari ve eksik maliyet', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];

  const stamp = Date.now();
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-report-${stamp}@example.com`;
    const ownerEmail = `owner-report-${stamp}@example.com`;
    emails.push(adminEmail, ownerEmail);

    adminCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      adminEmail,
      'admin',
    );
    await registerAndSignIn(ctx.app, ctx.prisma, ownerEmail);
    const owner = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: ownerEmail },
    });

    const position = `AdminTest-Report-${stamp}`;
    ids.pending = (
      await seedInterview(ctx.prisma, owner.id, {
        position,
        status: 'completed',
        reportStatus: 'pending',
      })
    ).id;
    ids.failed = (
      await seedInterview(ctx.prisma, owner.id, {
        position,
        status: 'completed',
        reportStatus: 'failed',
      })
    ).id;
    // Yarim kalmis: rapor uygulanamaz + hic TokenUsage kaydi yok.
    ids.noTokens = (
      await seedInterview(ctx.prisma, owner.id, {
        position,
        status: 'in_progress',
        reportStatus: 'not_applicable',
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  function detail(id: string) {
    return request(ctx.app.getHttpServer())
      .get(`/api/admin/interviews/${id}`)
      .set('Cookie', adminCookies);
  }

  it.each(['pending', 'failed', 'noTokens'])(
    '%s durumunda sorular/cevaplar yine doner, report null (FR-006)',
    async (key) => {
      const res = await detail(ids[key]);
      expect(res.status).toBe(200);
      expect(res.body.report).toBeNull();
      expect(res.body.questions.length).toBeGreaterThan(0);
    },
  );

  it('reportStatus alani istemcinin zarif durum gosterebilmesi icin doner', async () => {
    expect((await detail(ids.pending)).body.reportStatus).toBe('pending');
    expect((await detail(ids.failed)).body.reportStatus).toBe('failed');
    expect((await detail(ids.noTokens)).body.reportStatus).toBe(
      'not_applicable',
    );
  });

  it('ic hata metni / saglayici yaniti / stack trace SIZMAZ (API_CONVENTIONS §2)', async () => {
    const res = await detail(ids.failed);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/stack|Error:|groq|deepseek|apiKey|prisma/i);
    expect(res.body).not.toHaveProperty('reportError');
    expect(res.body).not.toHaveProperty('errorMessage');
  });

  it('hic TokenUsage kaydi yoksa tokenUsage null doner (FR-007)', async () => {
    const res = await detail(ids.noTokens);
    expect(res.body.tokenUsage).toBeNull();
  });

  it('yarim kalmis gorusmede cevapsiz sorunun answer alani null', async () => {
    const res = await detail(ids.noTokens);
    const unanswered = res.body.questions.find(
      (q: { answer: string | null }) => q.answer === null,
    );
    expect(unanswered).toBeDefined();
  });
});
