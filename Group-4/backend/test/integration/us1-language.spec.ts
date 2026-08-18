import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// FR-020 / SC-009: Accept-Language -> tr | en; kayit sonradan farkli baslikla
// okundugunda dil DEGISMEZ (kaydin kendisinde saklanir).
// NOT: LlmRateLimitGuard (3/saat) kullanici basina; bu dosyadaki 4 test de
// POST atiyor, bu yuzden HER test kendi kullanicisiyla calisir (aksi halde
// 4. istek kotaya takilir — bkz. us1-rate-limit.spec.ts, o davranisi ayrica test eder).
describe('POST /api/interviews (US1 dil cozumlemesi)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let counter = 0;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  async function freshCookies(): Promise<string[]> {
    counter += 1;
    const email = `us1-lang-${Date.now()}-${counter}@example.com`;
    emails.push(email);
    return registerAndSignIn(ctx.app, ctx.prisma, email);
  }

  const body = {
    jobPostingSource: 'text' as const,
    jobPostingText: 'Gecerli bir is ilani metni.',
    questionCount: 5,
    mode: 'written' as const,
    level: 'junior' as const,
  };

  it('Accept-Language: tr-TR -> language=tr', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .set('Accept-Language', 'tr-TR')
      .send(body);
    expect(res.body.interview.language).toBe('tr');
  });

  it('Accept-Language: de-DE -> language=en', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .set('Accept-Language', 'de-DE')
      .send(body);
    expect(res.body.interview.language).toBe('en');
  });

  it('baslik yok -> language=en', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .unset('Accept-Language')
      .send(body);
    expect(res.body.interview.language).toBe('en');
  });

  it('kayit olusturulduktan sonra farkli baslikla okundugunda dil degismez', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const cookies = await freshCookies();
    const created = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .set('Accept-Language', 'tr-TR')
      .send(body);

    const read = await request(ctx.app.getHttpServer())
      .get(`/api/interviews/${created.body.interview.id}`)
      .set('Cookie', cookies)
      .set('Accept-Language', 'en-US');

    expect(read.body.language).toBe('tr');
  });
});
