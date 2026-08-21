import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// FR-022 / SC-010: ayni kullanici saat icinde 4. gorusmeyi baslatir -> 429 +
// details.retryAfterSeconds; mevcut gorusmeler etkilenmez (§3.5: 3/saat).
describe('POST /api/interviews (US1 hiz siniri)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-ratelimit-${Date.now()}@example.com`;
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

  it('4. istek 429 doner, ilk 3 gorusme etkilenmez', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });

    const results: request.Response[] = [];
    for (let i = 0; i < 4; i += 1) {
      results.push(
        await request(ctx.app.getHttpServer())
          .post('/api/interviews')
          .set('Cookie', cookies)
          .send(body),
      );
    }

    expect(results.slice(0, 3).map((r) => r.status)).toEqual([201, 201, 201]);
    expect(results[3].status).toBe(429);
    expect(results[3].body.details.retryAfterSeconds).toBeGreaterThan(0);

    // S4: sure govdenin yani sira STANDART basligta da bulunur — istemci
    // kutuphaneleri, vekiller ve izleme araclari govdeyi degil bunu okur.
    // Tam saniye olmali (RFC 9110 §10.2.3) ve govdedeki degerle ortusmeli.
    const retryAfter = results[3].headers['retry-after'];
    expect(retryAfter).toMatch(/^\d+$/);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(
      Math.floor(results[3].body.details.retryAfterSeconds as number),
    );

    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(3);
  });
});
