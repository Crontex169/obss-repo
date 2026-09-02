// 010-odeme-abonelik US3 (T032): odenmis donem bitince kullanici KENDILIGINDEN
// ucretsiz plana duser (spec.md FR-016/FR-017).
//
// Bu testin asil iddiasi ne calistigi degil, NE CALISMADIGIdir: dusme icin
// zamanlanmis is (cron), bir "abonelik suresi doldu" isleyicisi ya da herhangi
// bir yazma islemi YOKTUR. Plan `proUntil` karsilastirmasindan turetildigi icin
// tarih gectigi anda sonuc kendiliginden degisir.
//
// planTier kayitta KALIR (kullanicinin en son hangi kademede oldugu bilgisi)
// ama hicbir hak vermez.
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

const email = `expired-${Date.now()}@example.com`;

describe('US3 — suresi dolmus abonelik ucretsiz plana duser', () => {
  let ctx: InterviewTestApp;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);

    // Kullanici DUNE KADAR pro'ydu. planTier siliNMEZ, proUntil gecmiste.
    const user = await ctx.prisma.user.update({
      where: { email },
      data: {
        planTier: 'pro',
        proUntil: new Date(Date.now() - 86_400_000),
      },
    });

    // Ucretsiz kotayi (3) dolduracak kadar satir. Uc noktadan olusturulsaydi
    // saatlik limit olcume karisirdi.
    await ctx.prisma.interview.createMany({
      data: Array.from({ length: 3 }, () => ({
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

  it('planTier hala kayitta ("pro") ama proUntil gecmiste', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.planTier).toBe('pro');
    expect(user.proUntil!.getTime()).toBeLessThan(Date.now());
  });

  it('pro kotasi (50) DEGIL, free kotasi (3) uygulanir', async () => {
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
    // limit=50 gorursen suresi dolmus abonelik hala hak veriyor demektir.
    expect(res.body.details).toEqual({ plan: 'free', used: 3, limit: 3 });
  });

  it('proUntil ileri alininca ayni kullanici aninda pro kotasina doner', async () => {
    // Dusme ve geri donme icin hicbir arka plan isi kosmadi; tek degisen tarih.
    await ctx.prisma.user.update({
      where: { email },
      data: { proUntil: new Date(Date.now() + 86_400_000) },
    });

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

    expect(res.status).toBe(201);
  });
});
