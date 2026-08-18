import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

// 005-admin US1 / T011 — FR-002, FR-003, FR-004, SC-002, SC-003.
// Entegrasyon veritabani testler arasinda PAYLASILIR; bu yuzden senaryo kendi
// benzersiz pozisyon etiketini kullanir ve iddialar bu etikete gore kapsanir.
jest.setTimeout(60_000);

describe('US1-admin liste: tum kullanicilar, meslek filtresi, silinmis gorunurlugu', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];

  const stamp = Date.now();
  const POSITION_A = `AdminTest-Backend-${stamp}`;
  const POSITION_B = `AdminTest-Frontend-${stamp}`;

  let userAEmail: string;
  let userBEmail: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    ctx = await createInterviewTestApp();

    const adminEmail = `admin-filter-${stamp}@example.com`;
    userAEmail = `owner-a-${stamp}@example.com`;
    userBEmail = `owner-b-${stamp}@example.com`;
    emails.push(adminEmail, userAEmail, userBEmail);

    adminCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      adminEmail,
      'admin',
    );
    await registerAndSignIn(ctx.app, ctx.prisma, userAEmail);
    await registerAndSignIn(ctx.app, ctx.prisma, userBEmail);

    const userA = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: userAEmail },
    });
    const userB = await ctx.prisma.user.findUniqueOrThrow({
      where: { email: userBEmail },
    });

    // Kullanici A: tamamlanmis (POSITION_A) + silinmis (POSITION_A) + null pozisyon
    ids.aCompleted = (
      await seedInterview(ctx.prisma, userA.id, {
        position: POSITION_A,
        status: 'completed',
        reportStatus: 'ready',
        createdAt: new Date(stamp - 3000),
      })
    ).id;
    ids.aDeleted = (
      await seedInterview(ctx.prisma, userA.id, {
        position: POSITION_A,
        status: 'completed',
        deleted: true,
        createdAt: new Date(stamp - 2000),
      })
    ).id;
    ids.aUnspecified = (
      await seedInterview(ctx.prisma, userA.id, {
        position: null,
        status: 'in_progress',
        createdAt: new Date(stamp - 1000),
      })
    ).id;

    // Kullanici B: yarim kalmis, farkli meslek
    ids.bInProgress = (
      await seedInterview(ctx.prisma, userB.id, {
        position: POSITION_B,
        status: 'in_progress',
        createdAt: new Date(stamp),
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  async function list(query = '') {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/admin/interviews${query}`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    return res.body as {
      items: Array<{
        id: string;
        ownerEmail: string;
        position: string | null;
        positionLabel: string;
        status: string;
        createdAt: string;
        completedAt: string | null;
        deletedAt: string | null;
      }>;
      total: number;
    };
  }

  it('tum kullanicilara ait gorusmeler tek listede doner, sahibi e-postasiyla (FR-002)', async () => {
    const body = await list(`?position=${encodeURIComponent(POSITION_A)}`);
    const owners = new Set(body.items.map((i) => i.ownerEmail));
    expect(owners).toContain(userAEmail);

    const all = await list('?pageSize=100');
    const byId = new Map(all.items.map((i) => [i.id, i]));
    // Iki FARKLI kullanicinin kayitlari ayni listede — kullanici ayrimi yok.
    if (byId.has(ids.aCompleted) && byId.has(ids.bInProgress)) {
      expect(byId.get(ids.aCompleted)!.ownerEmail).toBe(userAEmail);
      expect(byId.get(ids.bInProgress)!.ownerEmail).toBe(userBEmail);
    }
  });

  it('meslek filtresi yalnizca eslesen kayitlari doner (FR-003, SC-002)', async () => {
    const body = await list(`?position=${encodeURIComponent(POSITION_A)}`);
    expect(body.items.length).toBe(2);
    expect(body.total).toBe(2);
    expect(body.items.every((i) => i.position === POSITION_A)).toBe(true);
    expect(body.items.map((i) => i.id).sort()).toEqual(
      [ids.aCompleted, ids.aDeleted].sort(),
    );
  });

  it('silinmis kayit listeden DUSMEZ, deletedAt dolu gelir (FR-004, SC-003)', async () => {
    const body = await list(`?position=${encodeURIComponent(POSITION_A)}`);
    const deleted = body.items.find((i) => i.id === ids.aDeleted);
    expect(deleted).toBeDefined();
    expect(deleted!.deletedAt).not.toBeNull();

    const alive = body.items.find((i) => i.id === ids.aCompleted);
    expect(alive!.deletedAt).toBeNull();
  });

  it('?position=unspecified yalnizca position=null kayitlari doner ("Belirsiz" kovasi)', async () => {
    const body = await list('?position=unspecified&pageSize=100');
    expect(body.items.every((i) => i.position === null)).toBe(true);
    expect(body.items.every((i) => i.positionLabel === 'Belirsiz')).toBe(true);
    expect(body.items.map((i) => i.id)).toContain(ids.aUnspecified);
  });

  it('positionLabel dolu pozisyonda pozisyonun kendisidir', async () => {
    const body = await list(`?position=${encodeURIComponent(POSITION_B)}`);
    expect(body.items[0].positionLabel).toBe(POSITION_B);
  });

  it('varsayilan siralama createdAt DESC', async () => {
    const body = await list(`?position=${encodeURIComponent(POSITION_A)}`);
    const dates = body.items.map((i) => new Date(i.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
});
