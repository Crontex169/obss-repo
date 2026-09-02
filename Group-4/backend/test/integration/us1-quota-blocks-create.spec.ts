// 010-odeme-abonelik US1 (T012): aylik plan kotasi YENI gorusme olusturmayi
// kisitlar. Kota asimi 402'dir ve saatlik hiz sinirinin 429'undan AYRIDIR
// (spec.md FR-006/FR-007).
//
// NOT — neden her senaryo AYRI kullanici: POST /api/interviews'un saatlik LLM
// kotasi da 3'tur (@Throttle(llmQuota(3))) ve sayac kullanici bazlidir. Tek
// kullaniciyla dorduncu bir BASARILI olusturma denenirse 429'a carpar; bu test
// kota guard'ini olcmek istedigi icin her senaryo kendi kullanicisini kullanir.
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';
import { fakeQuestions } from './helpers/fake-questions';

const stamp = Date.now();
const freeEmail = `quota-free-${stamp}@example.com`;
const proEmail = `quota-pro-${stamp}@example.com`;

describe('US1 — aylik kota yeni gorusmeyi engeller', () => {
  let ctx: InterviewTestApp;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({
      where: { email: { in: [freeEmail, proEmail] } },
    });
    await ctx.app.close();
  });

  function createInterviewRequest(cookies: string[]) {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    return request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'written',
        level: 'mid',
        language: 'tr',
      });
  }

  describe('ucretsiz kullanici', () => {
    let cookies: string[];

    beforeAll(async () => {
      cookies = await registerAndSignIn(ctx.app, ctx.prisma, freeEmail);
    });

    it('free kotasi (3) kadar gorusme olusturulabilir', async () => {
      for (let i = 0; i < 3; i++) {
        await createTestInterview(ctx, cookies);
      }

      const count = await ctx.prisma.interview.count({
        where: { user: { email: freeEmail } },
      });
      expect(count).toBe(3);
    });

    it('4. gorusme 402 ile reddedilir; plan/used/limit doner', async () => {
      const res = await createInterviewRequest(cookies);

      expect(res.status).toBe(402);
      expect(res.body.error).toBe('PaymentRequired');
      expect(res.body.details).toEqual({ plan: 'free', used: 3, limit: 3 });
    });

    it('reddedilen istek 429 DEGILDIR — "bekle" ile "yukselt" karistirilmaz', async () => {
      const res = await createInterviewRequest(cookies);
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(402);
    });

    it('reddedilen istek yeni bir Interview satiri YARATMAZ', async () => {
      const count = await ctx.prisma.interview.count({
        where: { user: { email: freeEmail } },
      });
      expect(count).toBe(3);
    });
  });

  describe('ucretli kullanici', () => {
    it('proUntil ileride olan kullanici free sinirinin otesinde gorusme acabilir', async () => {
      const cookies = await registerAndSignIn(ctx.app, ctx.prisma, proEmail);

      // Kullanici pro: kota 50. Ucretsiz olsaydi da bu ilk gorusme gecerdi,
      // bu yuzden asil iddia asagidaki dogrudan-satir kurulumundadir.
      await ctx.prisma.user.update({
        where: { email: proEmail },
        data: {
          planTier: 'pro',
          proUntil: new Date(Date.now() + 86_400_000),
        },
      });

      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { email: proEmail },
      });

      // Free sinirini (3) asan sayida satir dogrudan yazilir — uc noktadan
      // olusturulsaydi saatlik limit (3) devreye girer ve olculen sey kota
      // olmaktan cikardi.
      await ctx.prisma.interview.createMany({
        data: Array.from({ length: 5 }, () => ({
          userId: user.id,
          jobPostingSource: 'text' as const,
          jobPostingText: 'Test ilan metni.',
          questionCount: 5,
          mode: 'written' as const,
          level: 'mid' as const,
          language: 'tr' as const,
        })),
      });

      const res = await createInterviewRequest(cookies);

      // free olsaydi 402 alirdi (used=5 >= limit=3); pro oldugu icin gecer.
      expect(res.status).toBe(201);
    });
  });
});
