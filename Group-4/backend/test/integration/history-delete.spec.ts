import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';
import { completeInterview, fakeReport } from './helpers/complete-interview';

// 004-history contracts/history-api.md §3 (US4, FR-010-013): soft-delete uc
// noktasi. InterviewOwnershipGuard DEGISTIRILMEDEN yeniden kullanilir — zaten
// silinmis bir kayit icin ikinci cagri servise hic ulasmadan guard seviyesinde
// 404 doner (2026-08-03 bulgusu, FR-013 "veya kayit bulunamadi" dali; bkz.
// specs/004-history/contracts/history-api.md §3 netlestirmesi).
//
// Not: POST /api/interviews saatlik 3/kullanici sinirlidir (FR-022); bu yuzden
// her senaryo, ayni kullanicida ust uste birden fazla gorusme olusturmamak
// icin KENDI TAZE kullanicisini acar (createOwner()).
//
// Merge notu (2026-08-04): soru sayilari 2/3'ten 5'e cikarildi — main'deki
// PR #23 alt siniri 5 yapti (create-interview.dto.ts min(5)), bu testler o
// karardan once yazildigi icin merge sonrasi 400 aliyorlardi.
describe('US4 gorusmeyi silme (soft-delete)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];

  async function createOwner(): Promise<string[]> {
    const email = `us4-del-${emails.length}-${Date.now()}@example.com`;
    emails.push(email);
    return registerAndSignIn(ctx.app, ctx.prisma, email);
  }

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

  it('sahibi tamamlanmis+raporlu gorusmeyi siler -> 204, icerik fiziksel olarak korunur (FR-011, FR-012)', async () => {
    const ownerCookies = await createOwner();
    const { interviewId } = await completeInterview(ctx, ownerCookies, {
      questionCount: 5,
      reportScenario: { content: fakeReport() },
    });

    const res = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}`)
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const row = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { report: true, questions: true },
    });
    expect(row.deletedAt).not.toBeNull();
    // Fiziksel silme YOK — status/reportStatus/sorular/rapor degismeden kaldi.
    expect(row.status).toBe('completed');
    expect(row.reportStatus).toBe('ready');
    expect(row.report).not.toBeNull();
    expect(row.questions.length).toBe(5);
  });

  it('yabanci kullanici baskasinin gorusmesini silmeye calisir -> 404, kayit degismez', async () => {
    const ownerCookies = await createOwner();
    const otherCookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}`)
      .set('Cookie', otherCookies);
    expect(res.status).toBe(404);

    const row = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });
    expect(row.deletedAt).toBeNull();
  });

  it('olmayan kayit icin 404', async () => {
    const ownerCookies = await createOwner();
    const res = await request(ctx.app.getHttpServer())
      .delete('/api/interviews/does-not-exist')
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(404);
  });

  it('oturumsuz istek -> 401', async () => {
    const ownerCookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer()).delete(
      `/api/interviews/${interviewId}`,
    );
    expect(res.status).toBe(401);
  });

  it('ikinci silme istegi -> 404 (guard zaten-silinmis kaydi "yok" sayar)', async () => {
    const ownerCookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });

    const first = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}`)
      .set('Cookie', ownerCookies);
    expect(first.status).toBe(204);

    const second = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}`)
      .set('Cookie', ownerCookies);
    expect(second.status).toBe(404);
  });

  it('yarim kalmis (in_progress) gorusme de silinebilir, sonrasinda listede/detayda gorunmez', async () => {
    const ownerCookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });

    const del = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}`)
      .set('Cookie', ownerCookies);
    expect(del.status).toBe(204);

    const list = await request(ctx.app.getHttpServer())
      .get('/api/interviews')
      .set('Cookie', ownerCookies);
    expect(list.body.map((i: { id: string }) => i.id)).not.toContain(
      interviewId,
    );

    const detail = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${interviewId}`)
      .set('Cookie', ownerCookies);
    expect(detail.status).toBe(404);
  });
});
