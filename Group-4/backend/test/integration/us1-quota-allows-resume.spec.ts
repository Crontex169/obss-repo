// 010-odeme-abonelik US1 (T013): kotasi DOLMUS kullanici, YARIM KALMIS
// gorusmesine devam edebilir. Bu dilimin en onemli davranis iddiasi
// (spec.md FR-004): hak yalnizca YENI gorusme olusturulurken duser; cevap
// vermek, rapor uretmek ya da yeniden denemek kota TUKETMEZ.
//
// Kod tarafinda bunun karsiligi PlanQuotaGuard'in SADECE POST /api/interviews
// uzerinde olmasidir; :id/* uclari guard ALMAZ.
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  createTestInterview,
  validAnswerFor,
} from './helpers/create-test-interview';
import { fakeQuestions } from './helpers/fake-questions';

const email = `quota-resume-${Date.now()}@example.com`;

describe('US1 — kotasi dolmus kullanici yarim gorusmesine devam edebilir', () => {
  let ctx: InterviewTestApp;
  let cookies: string[];
  let interviewId: string;
  let questions: { order: number; type: string; options: string[] }[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);

    // 1) Gercek bir gorusme ac (uc noktadan, sorulariyla birlikte).
    const created = await createTestInterview(ctx, cookies);
    interviewId = created.interviewId;
    questions = created.questions;

    // 2) Kotayi doldur. Kalan iki satir DOGRUDAN yazilir: uc noktadan
    //    olusturulsaydi saatlik limit (3/saat) devreye girer ve olculen sey
    //    kota olmaktan cikardi.
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    await ctx.prisma.interview.createMany({
      data: Array.from({ length: 2 }, () => ({
        userId: user.id,
        jobPostingSource: 'text' as const,
        jobPostingText: 'Test ilan metni.',
        questionCount: 5,
        mode: 'written' as const,
        level: 'mid' as const,
        language: 'tr' as const,
      })),
    });
  });

  afterAll(async () => {
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('on kosul: kullanicinin free kotasi (3) dolmus durumda', async () => {
    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(3);
  });

  it('kota dolu: YENI gorusme 402 alir', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const res = await request(ctx.app.getHttpServer())
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

    expect(res.status).toBe(402);
  });

  it('AYNI kullanici yarim kalan gorusmesine cevap verebilir (402 DEGIL)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({
        questionOrder: 1,
        content: validAnswerFor(questions[0]),
      });

    expect(res.status).not.toBe(402);
    expect(res.status).toBe(200);
  });

  it('devam etmek kotayi TUKETMEDI — satir sayisi degismedi', async () => {
    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(3);
  });

  it('ikinci bir cevap da gecer — devam etmek her seferinde bedava', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({
        questionOrder: 2,
        content: validAnswerFor(questions[1]),
      });

    expect(res.status).toBe(200);
  });
});
