import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// FR-034 (Ipucu & Rehberlik paneli telemetrisi, issue #48): salt log, LLM
// cagrisi/hiz siniri/rapor etkisi YOK — contracts/interview-api.md §7.
describe('POST /api/interviews/:id/panel-events', () => {
  let ctx: InterviewTestApp;
  const email = `us6-panel-events-${Date.now()}@example.com`;
  let otherEmail: string;
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

  it('gecerli govde -> 204, gorusme/rapor verisini degistirmez', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const before = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/panel-events`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, tab: 'hint' });

    expect(res.status).toBe(204);

    const after = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });
    expect(after).toEqual(before);
  });

  it('gecersiz tab -> 400', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/panel-events`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, tab: 'not_a_real_tab' });

    expect(res.status).toBe(400);
  });

  it('yabanci gorusme -> 404 (sahiplik gizliligi)', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    otherEmail = `us6-panel-events-other-${Date.now()}@example.com`;
    const otherCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      otherEmail,
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/panel-events`)
      .set('Cookie', otherCookies)
      .send({ questionOrder: 1, tab: 'rationale' });

    expect(res.status).toBe(404);

    await ctx.prisma.user.deleteMany({ where: { email: otherEmail } });
  });
});
