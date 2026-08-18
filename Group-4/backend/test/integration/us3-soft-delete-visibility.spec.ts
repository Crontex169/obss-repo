import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// §4.3 soft-delete gorunurlugu:
//   sahibi (role=user) -> deletedAt != null kayit listede YOK, detayda 404
//   admin              -> listede VAR ve deletedAt alani doner ("silindi" isareti)
// Kayit FIZIKSEL olarak silinmez. Silme UC NOKTASI 004-history kapsaminda;
// bu dilim yalnizca alani ve gorunurluk kuralini saglar.
describe('US3 soft-delete gorunurlugu', () => {
  let ctx: InterviewTestApp;
  const ownerEmail = `us3-sd-owner-${Date.now()}@example.com`;
  const adminEmail = `us3-sd-admin-${Date.now()}@example.com`;
  let ownerCookies: string[];
  let adminCookies: string[];
  let deletedId: string;
  let activeId: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    ownerCookies = await registerAndSignIn(ctx.app, ctx.prisma, ownerEmail);
    adminCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      adminEmail,
      'admin',
    );

    ({ interviewId: deletedId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    }));
    ({ interviewId: activeId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    }));

    // Silme uc noktasi bu dilimde YOK — alan dogrudan isaretleniyor.
    await ctx.prisma.interview.update({
      where: { id: deletedId },
      data: { deletedAt: new Date() },
    });
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: [ownerEmail, adminEmail] } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: [ownerEmail, adminEmail] } },
    });
    await ctx.app.close();
  });

  it('sahibin listesinde silinmis kayit YOK, aktif olan VAR', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/interviews')
      .set('Cookie', ownerCookies);

    const ids = res.body.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(deletedId);
    expect(ids).toContain(activeId);
  });

  it('sahip silinmis kaydin detayina erisemez -> 404', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${deletedId}`)
      .set('Cookie', ownerCookies);
    expect(res.status).toBe(404);
  });

  it('admin listesinde silinmis kayit VAR ve deletedAt doner', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/interviews')
      .set('Cookie', adminCookies);

    const found = res.body.find((i: { id: string }) => i.id === deletedId);
    expect(found).toBeDefined();
    expect(found.deletedAt).not.toBeNull();
  });

  it('kayit FIZIKSEL olarak silinmedi', async () => {
    const row = await ctx.prisma.interview.findUnique({
      where: { id: deletedId },
    });
    expect(row).not.toBeNull();
    expect(row!.deletedAt).not.toBeNull();
  });

  it('kullanici listesinde admin-ozel alanlar (userId/deletedAt) DONMEZ', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/interviews')
      .set('Cookie', ownerCookies);

    for (const item of res.body) {
      expect(item.deletedAt).toBeUndefined();
      expect(item.userId).toBeUndefined();
    }
  });
});
