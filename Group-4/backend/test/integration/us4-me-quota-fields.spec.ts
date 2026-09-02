// 010-odeme-abonelik US4 (T036): kullanici planini ve kalan hakkini gorebilmeli
// (spec.md FR-018). Kotaya ancak reddedildiginde carpmak kotu bir deneyimdir.
//
// Kota matrisi burada TEKRAR YAZILMAZ; /me yaniti da guard ile ayni kaynaktan
// (billing/plan.ts) okur. Iki yer ayri hesaplasaydi arayuz "2/3 hakkin var"
// derken sunucu 402 donebilirdi.
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

const email = `me-quota-${Date.now()}@example.com`;

describe('US4 — /api/users/me plan ve kota bilgisini doner', () => {
  let ctx: InterviewTestApp;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  const getMe = () =>
    request(ctx.app.getHttpServer()).get('/api/users/me').set('Cookie', cookies);

  it('yeni kullanici: free plan, 0/3', async () => {
    const res = await getMe();

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('free');
    expect(res.body.interviewsUsed).toBe(0);
    expect(res.body.interviewsLimit).toBe(3);
  });

  it('MEVCUT alanlar kaybolmadi (yanit genisletildi, degistirilmedi)', async () => {
    const res = await getMe();

    // Bu uc noktayi KVKK popup'i ve ayarlar ekrani da kullaniyor; alanlarin
    // birini dusurmek onlari sessizce kirardi.
    expect(res.body).toHaveProperty('kvkkConsentAt');
    expect(res.body).toHaveProperty('hasPassword');
    expect(res.body).toHaveProperty('cv');
  });

  it('bir gorusme acildiktan sonra interviewsUsed 1 olur', async () => {
    await createTestInterview(ctx, cookies);

    const res = await getMe();
    expect(res.body.interviewsUsed).toBe(1);
    expect(res.body.interviewsLimit).toBe(3);
  });

  it('ucretli plana gecince limit kademeye gore degisir', async () => {
    await ctx.prisma.user.update({
      where: { email },
      data: {
        planTier: 'pro_plus',
        proUntil: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await getMe();
    expect(res.body.plan).toBe('pro_plus');
    expect(res.body.interviewsLimit).toBe(100);
    // Kullanilan hak plan degisince SIFIRLANMAZ — ayni takvim ayi.
    expect(res.body.interviewsUsed).toBe(1);
  });

  it('suresi dolmus abonelikte free kotasi gosterilir', async () => {
    await ctx.prisma.user.update({
      where: { email },
      data: { proUntil: new Date(Date.now() - 86_400_000) },
    });

    const res = await getMe();
    expect(res.body.plan).toBe('free');
    expect(res.body.interviewsLimit).toBe(3);
  });

  it('silinen gorusme kullanilan haktan DUSMEZ (guard ile ayni sayim)', async () => {
    const interview = await ctx.prisma.interview.findFirstOrThrow({
      where: { user: { email } },
    });
    await ctx.prisma.interview.update({
      where: { id: interview.id },
      data: { deletedAt: new Date() },
    });

    const res = await getMe();
    expect(res.body.interviewsUsed).toBe(1);
  });

  it('oturumsuz -> 401', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});
