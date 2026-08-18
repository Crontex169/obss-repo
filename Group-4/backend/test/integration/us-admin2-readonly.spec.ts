import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { cleanupUsers, seedInterview } from './helpers/admin-scenario';

jest.setTimeout(60_000);

// 005-admin US2 / T023 — FR-008, SC-005: admin panelinin salt-okunurluk
// garantisi. AdminModule hicbir POST/PATCH/PUT/DELETE route'u TANIMLAMAZ;
// boyle bir istek router seviyesinde 404 alir ve kayit DEGISMEZ.
describe('US2-admin salt-okunurluk garantisi', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let adminCookies: string[];
  let interviewId: string;

  const stamp = Date.now();

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const adminEmail = `admin-readonly-${stamp}@example.com`;
    const ownerEmail = `owner-readonly-${stamp}@example.com`;
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

    interviewId = (
      await seedInterview(ctx.prisma, owner.id, {
        position: `AdminTest-ReadOnly-${stamp}`,
        status: 'completed',
        reportStatus: 'ready',
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupUsers(ctx.prisma, emails);
    await ctx.app.close();
  });

  const METHODS = ['post', 'patch', 'put', 'delete'] as const;

  it.each(METHODS)(
    '%s /api/admin/interviews/:id -> 404 (route tanimli degil)',
    async (method) => {
      const res = await request(ctx.app.getHttpServer())
        [method](`/api/admin/interviews/${interviewId}`)
        .set('Cookie', adminCookies)
        .send({ position: 'HACKED' });
      expect(res.status).toBe(404);
    },
  );

  it.each(METHODS)(
    '%s /api/admin/interviews -> 404 (route tanimli degil)',
    async (method) => {
      const res = await request(ctx.app.getHttpServer())
        [method]('/api/admin/interviews')
        .set('Cookie', adminCookies)
        .send({});
      expect(res.status).toBe(404);
    },
  );

  it('yazma denemelerinden sonra kayit hicbir sekilde degismemistir', async () => {
    const row = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
      include: { report: true, questions: true },
    });
    expect(row.position).toBe(`AdminTest-ReadOnly-${stamp}`);
    expect(row.deletedAt).toBeNull();
    expect(row.status).toBe('completed');
    expect(row.report).not.toBeNull();
  });
});
