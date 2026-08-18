import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// FR-004 / Netlestirmeler: mode=voice -> tum uretilen sorular open_ended
// olmali; fake multiple_choice donerse LlmSchemaError -> 502.
describe('POST /api/interviews (US1 sozlu mod soru tipi)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-voice-${Date.now()}@example.com`;
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
    mode: 'voice' as const,
    level: 'junior' as const,
  };

  it('gecerli sozlu yanit (hepsi open_ended) -> 201', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5, { mode: 'voice' }) });
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send(body);
    expect(res.status).toBe(201);

    const questions = await ctx.prisma.question.findMany({
      where: { interviewId: res.body.interview.id },
    });
    expect(questions.every((q) => q.type === 'open_ended')).toBe(true);
  });

  it('fake multiple_choice donerse -> 502, kayit olusmaz', async () => {
    // Ayni N (4), ama "written" fabrikasi karisik tip uretir (i%2===1 -> multiple_choice) —
    // sayi degil, TIP kuralini izole test eder.
    ctx.fakeLlm.always({ content: fakeQuestions(5, { mode: 'written' }) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send(body);

    expect(res.status).toBe(502);
    const count = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(count).toBe(1); // yalnizca ilk (gecerli) testten kalan kayit
  });
});
