import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// specs/007-ui-design Rötuş Notları — Görüşmelerim listesi üç nokta menüsü
// "Bildir" aksiyonu: POST /api/interviews/:id/report-problem.
describe('"Bildir" aksiyonu (görüşme sorun bildirimi)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];

  async function createOwner(): Promise<string[]> {
    const email = `report-problem-${emails.length}-${Date.now()}@example.com`;
    emails.push(email);
    return registerAndSignIn(ctx.app, ctx.prisma, email);
  }

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.interviewProblemReport.deleteMany({
      where: { interview: { user: { email: { in: emails } } } },
    });
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  it('sahibi mesaj gonderir -> 204, kayit veritabanina yazilir', async () => {
    const cookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report-problem`)
      .set('Cookie', cookies)
      .send({ message: 'Rapor skoru yanlis hesaplanmis gibi duruyor.' });

    expect(res.status).toBe(204);

    const rows = await ctx.prisma.interviewProblemReport.findMany({
      where: { interviewId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe(
      'Rapor skoru yanlis hesaplanmis gibi duruyor.',
    );
  });

  it('bos mesaj -> 400', async () => {
    const cookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report-problem`)
      .set('Cookie', cookies)
      .send({ message: '' });

    expect(res.status).toBe(400);
  });

  it('yabanci kullanici baskasinin gorusmesini bildiremez -> 404', async () => {
    const ownerCookies = await createOwner();
    const otherCookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, ownerCookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report-problem`)
      .set('Cookie', otherCookies)
      .send({ message: 'Sorun var.' });

    expect(res.status).toBe(404);
  });

  it('oturumsuz istek -> 401', async () => {
    const cookies = await createOwner();
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/report-problem`)
      .send({ message: 'Sorun var.' });

    expect(res.status).toBe(401);
  });
});
