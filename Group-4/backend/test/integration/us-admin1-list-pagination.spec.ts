import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

// 005-admin US1 / T012 — FR-014, Clarifications Q4 (varsayilan 20 kayit/sayfa).
// pageSize ust siniri 100 (contracts/admin-api.md §1; research.md §5'teki "20"
// ifadesiyle celiski 2026-08-04 analizinde sozlesme lehine cozuldu).
jest.setTimeout(60_000);

describe('US1-admin liste sayfalama', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];

  const stamp = Date.now();
  const POSITION = `AdminTest-Paged-${stamp}`;
  const SEEDED = 3;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-page-${stamp}@example.com`;
    const ownerEmail = `owner-page-${stamp}@example.com`;
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

    for (let i = 0; i < SEEDED; i++) {
      await seedInterview(ctx.prisma, owner.id, {
        position: POSITION,
        createdAt: new Date(stamp - i * 1000),
      });
    }
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  function get(query: string) {
    return request(ctx.app.getHttpServer())
      .get(`/api/admin/interviews${query}`)
      .set('Cookie', adminCookies);
  }

  it('pageSize verilmezse varsayilan 20 (Clarifications Q4)', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.page).toBe(1);
    expect(res.body.items.length).toBeLessThanOrEqual(20);
  });

  it('total filtreye gore hesaplanir, items sayfa boyutuyla sinirlanir', async () => {
    const res = await get(
      `?position=${encodeURIComponent(POSITION)}&pageSize=2`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(SEEDED);
    expect(res.body.items.length).toBe(2);
    expect(res.body.pageSize).toBe(2);
  });

  it('page=2 bir sonraki dilimi doner, sayfalar cakismaz', async () => {
    const first = await get(
      `?position=${encodeURIComponent(POSITION)}&pageSize=2&page=1`,
    );
    const second = await get(
      `?position=${encodeURIComponent(POSITION)}&pageSize=2&page=2`,
    );
    expect(second.status).toBe(200);
    expect(second.body.page).toBe(2);
    expect(second.body.items.length).toBe(SEEDED - 2);

    const firstIds = first.body.items.map((i: { id: string }) => i.id);
    const secondIds = second.body.items.map((i: { id: string }) => i.id);
    expect(firstIds.filter((id: string) => secondIds.includes(id))).toEqual([]);
  });

  it('aralik disi page/pageSize -> 400', async () => {
    await expect(get('?page=0').then((r) => r.status)).resolves.toBe(400);
    await expect(get('?pageSize=0').then((r) => r.status)).resolves.toBe(400);
    await expect(get('?pageSize=101').then((r) => r.status)).resolves.toBe(400);
    await expect(get('?page=abc').then((r) => r.status)).resolves.toBe(400);
  });

  it('pageSize ust siniri 100 kabul edilir', async () => {
    const res = await get('?pageSize=100');
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(100);
  });
});
