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
import { fakeAdaptive } from './helpers/fake-adaptive';

// DTO questionCount min=5 (FR-003); yalnizca ILK sorunun tip/rationale'i test
// edilir, geri kalani null.
function questionsWithFirstHint(first: {
  tip: string | null;
  rationale: string | null;
}) {
  return Array.from({ length: 5 }, (_, i) => ({
    type: 'open_ended' as const,
    text: `Soru ${i + 1}: deneyiminizi anlatin.`,
    options: [] as string[],
    tip: i === 0 ? first.tip : null,
    rationale: i === 0 ? first.rationale : null,
  }));
}

// FR-031 (Ipucu & Rehberlik paneli, issue #48): tip/rationale AYNI LLM
// cagrisinda gelir, ZORUNLU DEGIL — null donerse soru yine gecerlidir.
describe('US6 Ipucu & Rehberlik alanlari (tip/rationale)', () => {
  let ctx: InterviewTestApp;
  const email = `us6-hints-${Date.now()}@example.com`;
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

  it('LLM tip/rationale doldurursa Question kaydinda ve API yanitinda gorunur', async () => {
    ctx.fakeLlm.always({
      content: {
        rejection: null,
        position: 'Backend Gelistirici',
        questions: questionsWithFirstHint({
          tip: 'Somut bir proje/orayla ilgili kisa ama net anlatim yap.',
          rationale: 'Ilanda istenen 3+ yil deneyimi olcuyor.',
        }),
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText:
          'Aramizda 3 yil deneyimli backend gelistirici ariyoruz.',
        questionCount: 5,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.currentQuestion.tip).toBe(
      'Somut bir proje/orayla ilgili kisa ama net anlatim yap.',
    );
    expect(res.body.currentQuestion.rationale).toBe(
      'Ilanda istenen 3+ yil deneyimi olcuyor.',
    );

    const stored = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId: res.body.interview.id, order: 1 },
    });
    expect(stored.tip).not.toBeNull();
    expect(stored.rationale).not.toBeNull();
  });

  it('LLM tip/rationale uretemezse (null) gorusme yine basariyla olusur', async () => {
    ctx.fakeLlm.always({
      content: {
        rejection: null,
        position: null,
        questions: questionsWithFirstHint({ tip: null, rationale: null }),
      },
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.currentQuestion.tip).toBeNull();
    expect(res.body.currentQuestion.rationale).toBeNull();
  });

  it('adaptif uyarlama tip/rationale gunceller (FR-010/FR-031)', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });

    ctx.fakeLlm.always({
      content: fakeAdaptive('Uyarlanmis daha zor soru: mimariyi anlatin.', {
        tip: 'Trade-off ları kisaca sirala.',
        rationale: 'Ileri seviye tasarim kararlarini olcuyor.',
      }),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.currentQuestion.tip).toBe('Trade-off ları kisaca sirala.');
    expect(res.body.currentQuestion.rationale).toBe(
      'Ileri seviye tasarim kararlarini olcuyor.',
    );
  });
});
