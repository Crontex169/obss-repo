import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions, fakeRejection } from './helpers/fake-questions';

// FR-028, SC-016, contracts/interview-flow-rules.md §4.1 — T121.
describe('POST /api/interviews (US1 gecersiz is ilani)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-invalid-posting-${Date.now()}@example.com`;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.tokenUsage.deleteMany({ where: { user: { email } } });
    await ctx.prisma.interview.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('rejection dolu -> 422 + details.reason, hicbir kayit olusmaz, TokenUsage yazilir', async () => {
    ctx.fakeLlm.always({ content: fakeRejection() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Bu bir is ilani degil, rastgele bir metin.',
        questionCount: 8,
        mode: 'written',
        level: 'junior',
      });

    expect(res.status).toBe(422);
    expect(res.body.details).toMatchObject({ reason: 'not_a_job_posting' });
    // Yanit govdesinde modelin serbest metni bulunmaz — mesaj sunucudan gelir.
    expect(res.body.message).not.toMatch(/rastgele/i);

    const interviewCount = await ctx.prisma.interview.count({
      where: { user: { email } },
    });
    expect(interviewCount).toBe(0);
    const questionCount = await ctx.prisma.question.count({
      where: { interview: { user: { email } } },
    });
    expect(questionCount).toBe(0);

    const usage = await ctx.prisma.tokenUsage.findFirst({
      where: { user: { email }, operation: 'question_generation' },
    });
    expect(usage).toMatchObject({ interviewId: null, succeeded: true });
  });

  it('kontrol grubu: rejection null + N soru -> 201 (dar ret esigi gercek ilani bloklamiyor)', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(6) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText:
          'Aramizda 3 yil deneyimli backend gelistirici ariyoruz.',
        questionCount: 6,
        mode: 'written',
        level: 'junior',
      });

    expect(res.status).toBe(201);
  });

  it('tutarsiz yanit (rejection dolu ama questions dolu) -> LlmSchemaError -> 502', async () => {
    ctx.fakeLlm.always({
      content: { ...fakeRejection(), questions: fakeQuestions(5).questions },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Tutarsiz yanit senaryosu.',
        questionCount: 5,
        mode: 'written',
        level: 'junior',
      });

    expect(res.status).toBe(502);
  });
});
