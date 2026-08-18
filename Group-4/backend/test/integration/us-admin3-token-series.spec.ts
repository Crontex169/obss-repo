import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, daysAgo, seedInterview } from './helpers/admin-scenario';

jest.setTimeout(60_000);

// 005-admin US3 / T032 — FR-012, Clarifications Q3 (gunluk granularite,
// varsayilan son 30 gun), research.md §4 (veri olmayan gunler 0 ile doldurulur).
describe('US3-admin gunluk token zaman serisi', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];

  const stamp = Date.now();
  const SEEDED_DAY = 3;
  const SEEDED_TOKENS = 150 + 70; // input + output

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-series-${stamp}@example.com`;
    const ownerEmail = `owner-series-${stamp}@example.com`;
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

    await seedInterview(ctx.prisma, owner.id, {
      position: `AdminTest-Series-${stamp}`,
      createdAt: daysAgo(SEEDED_DAY),
      tokenUsages: [
        {
          inputTokens: 150,
          outputTokens: 70,
          costUsd: '0.003000',
          createdAt: daysAgo(SEEDED_DAY),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  async function series(query = '') {
    const res = await request(ctx.app.getHttpServer())
      .get(`/api/admin/stats${query}`)
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    return res.body.dailyTokenUsage as Array<{
      date: string;
      totalTokens: number;
    }>;
  }

  it('varsayilan pencere 30 gun, her gun icin bir kayit (sifir doldurmali)', async () => {
    const rows = await series();
    expect(rows).toHaveLength(30);
    expect(rows.every((r) => typeof r.totalTokens === 'number')).toBe(true);
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true);
  });

  it('gunler artan sirada ve ardisiktir (grafikte bosluk olusmaz)', async () => {
    const rows = await series();
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(`${rows[i - 1].date}T00:00:00Z`).getTime();
      const curr = new Date(`${rows[i].date}T00:00:00Z`).getTime();
      expect(curr - prev).toBe(86_400_000);
    }
  });

  it('tokenWindowDays penceresi uygulanir', async () => {
    expect(await series('?tokenWindowDays=7')).toHaveLength(7);
    expect(await series('?tokenWindowDays=90')).toHaveLength(90);
  });

  it('aralik disi tokenWindowDays -> 400', async () => {
    for (const value of ['0', '91', 'abc']) {
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/admin/stats?tokenWindowDays=${value}`)
        .set('Cookie', adminCookies);
      expect(res.status).toBe(400);
    }
  });

  it('seed edilen token kaydi kendi gun kovasinda gorunur (FR-012)', async () => {
    const rows = await series();
    const day = daysAgo(SEEDED_DAY).toISOString().slice(0, 10);
    const bucket = rows.find((r) => r.date === day);
    expect(bucket).toBeDefined();
    // Paylasilan veritabaninda ayni gune baska testler de yazabilir; alt sinir
    // deterministiktir. Tam aritmetik us-admin3-empty.spec.ts'te dogrulanir.
    expect(bucket!.totalTokens).toBeGreaterThanOrEqual(SEEDED_TOKENS);
  });

  it('pencere disindaki gunler seride YOKTUR', async () => {
    const rows = await series('?tokenWindowDays=1');
    expect(rows).toHaveLength(1);
    const oldDay = daysAgo(SEEDED_DAY).toISOString().slice(0, 10);
    expect(rows.map((r) => r.date)).not.toContain(oldDay);
  });
});
