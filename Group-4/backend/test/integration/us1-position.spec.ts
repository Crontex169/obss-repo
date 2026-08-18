import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// FR-023 / SC-011: pozisyon AYNI LLM yanitindan cikarilir — ek cagri yapilmaz.
describe('POST /api/interviews (US1 pozisyon cikarimi)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-position-${Date.now()}@example.com`;
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

  it('pozisyon icerince dolu doner ve TEK LLM cagrisi yapilir', async () => {
    ctx.fakeLlm.reset();
    ctx.fakeLlm.always({
      content: fakeQuestions(5, { position: 'Backend Gelistirici' }),
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send(body);

    expect(res.body.interview.position).toBe('Backend Gelistirici');
    expect(ctx.fakeLlm.calls).toHaveLength(1);
  });

  it('pozisyon cikarilamazsa position=null ama 201', async () => {
    ctx.fakeLlm.reset();
    ctx.fakeLlm.always({ content: fakeQuestions(5, { position: null }) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.interview.position).toBeNull();
  });
});
