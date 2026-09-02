// 010-odeme-abonelik US1 (T014): SILINEN gorusme de kotadan dusmus sayilir
// (spec.md FR-005). Sayim sorgusunda `deletedAt` filtresi BILEREK yoktur.
//
// Filtre konsaydi "olustur -> sil -> olustur" sinirsiz kota olurdu; oysa soru
// uretiminin LLM maliyeti olusturma aninda zaten harcanmistir. Bu test o
// filtrenin ileride "temizlik" niyetiyle eklenmesine karsi bir bekcidir.
import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

const email = `quota-deleted-${Date.now()}@example.com`;

describe('US1 — silme kota hakki iade ETMEZ', () => {
  let ctx: InterviewTestApp;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);

    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email } });

    // Free kotasi kadar (3) satir; uc noktadan degil dogrudan yazilir ki
    // saatlik limit olcume karismasin.
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

  it('uc gorusmeden biri silinince aktif satir sayisi 2 olur', async () => {
    const first = await ctx.prisma.interview.findFirstOrThrow({
      where: { user: { email } },
    });
    await ctx.prisma.interview.update({
      where: { id: first.id },
      data: { deletedAt: new Date() },
    });

    const aktif = await ctx.prisma.interview.count({
      where: { user: { email }, deletedAt: null },
    });
    expect(aktif).toBe(2);
  });

  it('buna ragmen yeni gorusme 402 alir — silinen satir hala sayiliyor', async () => {
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
    // used=3: silinen satir dahil. used=2 gorursen deletedAt filtresi
    // sayima sizmis demektir.
    expect(res.body.details).toEqual({ plan: 'free', used: 3, limit: 3 });
  });
});
