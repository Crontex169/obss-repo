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

// data-model.md dogrulama kurali / research.md §4: bir Question'a bagli Answer
// VARSA, o sorunun text/options/type alanlari ARTIK DEGISTIRILEMEZ — kullaniciya
// gosterilmis ve cevaplanmis soru DONAR. Uyarlama yalnizca henuz gosterilmemis
// order'a uygulanir.
describe('US4 cevaplanmis soru donmasi', () => {
  let ctx: InterviewTestApp;
  const email = `us4-frozen-${Date.now()}@example.com`;
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

  it('uyarlama, cevaplanmis sorulari DEGISTIRMEZ', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });

    ctx.fakeLlm.always({ content: fakeAdaptive('Uyarlanmis soru 2') });
    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    ctx.fakeLlm.always({ content: fakeAdaptive('Uyarlanmis soru 3') });
    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 2, content: 'Ikinci cevap.' });

    const stored = await ctx.prisma.question.findMany({
      where: { interviewId },
      orderBy: { order: 'asc' },
    });

    // Soru 1 hic cevaplandiktan sonra dokunulmadi (uretim anindaki metni).
    expect(stored[0].text).toBe(questions[0].text);
    expect(stored[0].isBaseline).toBe(true);

    // Soru 2, CEVAPLANMADAN once uyarlandi; cevaplandiktan sonra ise
    // 3. uyarlama cagrisinda hedef DEGILDI, metni sabit kaldi.
    expect(stored[1].text).toBe('Uyarlanmis soru 2');

    // Soru 3, henuz gosterilmemis oldugu icin uyarlandi.
    expect(stored[2].text).toBe('Uyarlanmis soru 3');
  });

  it('cevaplanmis soruya dogrudan uyarlama denemesi de bloklanir', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'voice',
      adaptiveEnabled: true,
    });

    ctx.fakeLlm.always({ content: fakeAdaptive('Uyarlanmis soru 2') });
    await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    const firstBefore = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 1 },
    });

    // Sira kilidi zaten 409 verir; asil kontrol: 1. sorunun metni degismedi.
    const retry = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: 1, content: 'Tekrar cevap' });
    expect(retry.status).toBe(409);

    const firstAfter = await ctx.prisma.question.findFirstOrThrow({
      where: { interviewId, order: 1 },
    });
    expect(firstAfter.text).toBe(firstBefore.text);
    expect(firstAfter.options).toEqual(firstBefore.options);
    expect(firstAfter.type).toBe(firstBefore.type);
  });
});
