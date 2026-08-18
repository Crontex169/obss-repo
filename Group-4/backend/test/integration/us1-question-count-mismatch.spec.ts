import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// SC-002 / §3.3: fake N-1 soru dondurur -> LlmSchemaError -> 502, hicbir kayit olusmaz.
// Sayi garantisi YALNIZCA katman-2 Zod dogrulamasinda (minItems/maxItems saglayiciya
// gonderilmez) — bkz. buildQuestionGenerationSchema(.length(N)).
describe('POST /api/interviews (US1 soru sayisi uyumsuzlugu)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-mismatch-${Date.now()}@example.com`;
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

  it('N-1 soru donerse 502 ve hicbir kayit olusmaz', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(7) }); // 8 istendi, 7 doner

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 8,
        mode: 'written',
        level: 'junior',
      });

    expect(res.status).toBe(502);
    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(0);
  });
});
