import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

jest.setTimeout(60_000);

// 005-admin US2 / T021 — FR-004, FR-005, FR-007: admin herhangi bir kullanicinin
// gorusme detayini (sorular, cevaplar, rapor, token/maliyet) eksiksiz gorur;
// kayit soft-delete edilmis olsa dahi icerik korunur.
describe('US2-admin gorusme detayi', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];
  let ownerEmail: string;

  const stamp = Date.now();
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-detail-${stamp}@example.com`;
    ownerEmail = `owner-detail-${stamp}@example.com`;
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

    ids.ready = (
      await seedInterview(ctx.prisma, owner.id, {
        position: `AdminTest-Detail-${stamp}`,
        status: 'completed',
        reportStatus: 'ready',
        questionCount: 2,
        tokenUsages: [
          { inputTokens: 100, outputTokens: 50, costUsd: '0.001500' },
          { inputTokens: 200, outputTokens: 80, costUsd: '0.002500' },
        ],
      })
    ).id;

    ids.deleted = (
      await seedInterview(ctx.prisma, owner.id, {
        position: `AdminTest-Detail-${stamp}`,
        status: 'completed',
        reportStatus: 'ready',
        deleted: true,
        questionCount: 2,
        tokenUsages: [
          { inputTokens: 10, outputTokens: 5, costUsd: '0.000100' },
        ],
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

  it('tamamlanmis+raporlu gorusmede sorular, cevaplar ve rapor eksiksiz doner (FR-005)', async () => {
    const res = await detail(ids.ready);
    expect(res.status).toBe(200);
    expect(res.body.ownerEmail).toBe(ownerEmail);
    expect(res.body.status).toBe('completed');
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0]).toMatchObject({
      order: 1,
      text: 'Soru 1?',
      answer: 'Cevap 1',
    });
    expect(res.body.reportStatus).toBe('ready');
    expect(res.body.report).toMatchObject({
      technicalScore: 70,
      behavioralScore: 80,
      generalScore: 75,
    });
    expect(res.body.report.overallImpression).toBeTruthy();
    // #76: soru bazli geri bildirim de "eksiksiz" kapsamindadir (FR-005) —
    // select'ten dusurulurse alan sessizce kaybolur, bu assert onu yakalar.
    expect(res.body.report.questionFeedback).toEqual([
      {
        order: 1,
        verdict: 'kismen',
        correctAnswer: 'Beklenen cevap 1',
        explanation: 'Cevap eksik kaldi.',
      },
    ]);
  });

  it('token/maliyet toplami tum TokenUsage kayitlarinin toplamidir (FR-007)', async () => {
    const res = await detail(ids.ready);
    // (100+50) + (200+80) = 430 token, 0.001500 + 0.002500 = 0.004000 USD
    expect(res.body.tokenUsage.totalTokens).toBe(430);
    expect(Number(res.body.tokenUsage.estimatedCostUsd)).toBeCloseTo(0.004, 6);
  });

  it('mode/level/language bilgi alanlari doner', async () => {
    const res = await detail(ids.ready);
    expect(res.body).toMatchObject({
      mode: 'written',
      level: 'junior',
      language: 'tr',
    });
  });

  it('silinmis gorusmede deletedAt dolu ama icerik EKSIKSIZ (FR-004, SC-003)', async () => {
    const res = await detail(ids.deleted);
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).not.toBeNull();
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.report).not.toBeNull();
    expect(res.body.tokenUsage.totalTokens).toBe(15);
  });

  it('gercekten olmayan kayit -> 404', async () => {
    const res = await detail('does-not-exist');
    expect(res.status).toBe(404);
  });
});
