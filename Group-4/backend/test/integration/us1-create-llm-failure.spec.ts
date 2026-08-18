import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';

// Hikaye 1 kriter 5 / FR-019: LLM hata/zaman asimi -> Interview OLUSTURULMAZ,
// 502/504, tekrar deneme mesaji.
describe('POST /api/interviews (US1 LLM hatasi)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-llmfail-${Date.now()}@example.com`;
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

  const body = {
    jobPostingSource: 'text' as const,
    jobPostingText: 'Gecerli bir is ilani metni.',
    questionCount: 5,
    mode: 'written' as const,
    level: 'junior' as const,
  };

  it('saglayici hatasi -> 502, Interview olusturulmaz', async () => {
    ctx.fakeLlm.always({ error: new Error('provider down') });

    const before = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send(body);

    expect(res.status).toBe(502);
    expect(res.body.message).toEqual(expect.any(String));
    const after = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(after).toBe(before);
  });
});
