import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers } from './helpers/admin-scenario';

// 005-admin US1 / T010 — FR-001, SC-004: admin uc noktalari yalnizca
// role="admin" oturumuna acik. Oturumsuz 401, rolu yetersiz 403; hicbir
// durumda veri sizmaz.
jest.setTimeout(60_000);

describe('US1-admin liste yetkilendirmesi', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];
  let userCookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const stamp = Date.now();
    const adminEmail = `admin-auth-${stamp}@example.com`;
    const userEmail = `user-auth-${stamp}@example.com`;
    emails.push(adminEmail, userEmail);
    adminCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      adminEmail,
      'admin',
    );
    userCookies = await registerAndSignIn(ctx.app, ctx.prisma, userEmail);
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  const ENDPOINTS = [
    '/api/admin/interviews',
    '/api/admin/interviews/some-id',
    '/api/admin/stats',
  ];

  it.each(ENDPOINTS)('oturumsuz %s -> 401, govdede veri yok', async (path) => {
    const res = await request(ctx.app.getHttpServer()).get(path);
    expect(res.status).toBe(401);
    expect(res.body).not.toHaveProperty('items');
    expect(res.body).not.toHaveProperty('countsByProfession');
  });

  it.each(ENDPOINTS)('role="user" oturumu %s -> 403', async (path) => {
    const res = await request(ctx.app.getHttpServer())
      .get(path)
      .set('Cookie', userCookies);
    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty('items');
    expect(res.body).not.toHaveProperty('countsByProfession');
  });

  it('role="admin" oturumu listeye erisebilir -> 200', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/api/admin/interviews')
      .set('Cookie', adminCookies);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
