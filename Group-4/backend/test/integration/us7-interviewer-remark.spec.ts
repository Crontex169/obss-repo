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

// Hikaye 2 / FR-038: sozlu modda cevaptan sonra okunan gecis repligi.
// Replik MEVCUT adaptif cagriyla ayni yanittan gelir — ek LLM cagrisi YOK.
//
// Not: gorusme olusturma kullanici basina 3/saat ile sinirli (FR-022), bu
// yuzden testler IKI kullaniciya bolunmustur — tek kullanicida son testler
// 429 alirdi.
describe('US7 gorusmeci gecis repligi', () => {
  let ctx: InterviewTestApp;
  const emailA = `us7-remark-a-${Date.now()}@example.com`;
  const emailB = `us7-remark-b-${Date.now()}@example.com`;
  let cookiesA: string[];
  let cookiesB: string[];

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookiesA = await registerAndSignIn(ctx.app, ctx.prisma, emailA);
    cookiesB = await registerAndSignIn(ctx.app, ctx.prisma, emailB);
  });

  afterAll(async () => {
    const emails = { in: [emailA, emailB] };
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: emails } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: emails } });
    await ctx.app.close();
  });

  it('replik yanitta doner ve EK LLM cagrisi yapilmaz', async () => {
    const { interviewId, questions } = await createTestInterview(
      ctx,
      cookiesA,
      {
        questionCount: 5,
        mode: 'voice',
        adaptiveEnabled: true,
      },
    );
    const callsAfterCreate = ctx.fakeLlm.calls.length;

    ctx.fakeLlm.always({
      content: fakeAdaptive('Siradaki soru.', {
        interviewerRemark: 'Anladim, tesekkurler.',
      }),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookiesA)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.interviewerRemark).toBe('Anladim, tesekkurler.');
    // KRITIK (FR-038): replik icin AYRI bir cagri yapilmadi — uyarlama cagrisi
    // basina yalnizca 1 artis.
    expect(ctx.fakeLlm.calls.length).toBe(callsAfterCreate + 1);
  });

  it('LLM replik uretmezse null doner, akis kesilmez', async () => {
    const { interviewId, questions } = await createTestInterview(
      ctx,
      cookiesA,
      {
        questionCount: 5,
        mode: 'voice',
        adaptiveEnabled: true,
      },
    );

    ctx.fakeLlm.always({
      content: fakeAdaptive('Siradaki soru.', { interviewerRemark: null }),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookiesA)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.interviewerRemark).toBeNull();
    expect(res.body.currentQuestion.text).toBe('Siradaki soru.');
  });

  it('adaptif akis KAPALIYSA replik uretilmez (ek maliyet yok)', async () => {
    const { interviewId, questions } = await createTestInterview(
      ctx,
      cookiesA,
      {
        questionCount: 5,
        mode: 'voice',
        adaptiveEnabled: false,
      },
    );
    const callsAfterCreate = ctx.fakeLlm.calls.length;

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookiesA)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.interviewerRemark).toBeNull();
    expect(ctx.fakeLlm.calls.length).toBe(callsAfterCreate);
  });

  it('replik HTML/markdown tasiyorsa duz metne indirgenir (Ilke V, FR-033)', async () => {
    const { interviewId, questions } = await createTestInterview(
      ctx,
      cookiesB,
      {
        questionCount: 5,
        mode: 'voice',
        adaptiveEnabled: true,
      },
    );

    ctx.fakeLlm.always({
      content: fakeAdaptive('Siradaki soru.', {
        interviewerRemark: '<b>Anladim</b>, tesekkurler.',
      }),
    });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookiesB)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.interviewerRemark).not.toContain('<b>');
  });

  it('adaptif uyarlama BASARISIZ olursa replik null doner, cevap kaybolmaz', async () => {
    const { interviewId, questions } = await createTestInterview(
      ctx,
      cookiesB,
      {
        questionCount: 5,
        mode: 'voice',
        adaptiveEnabled: true,
      },
    );

    ctx.fakeLlm.always({ error: new Error('saglayici hatasi') });

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookiesB)
      .send({ questionOrder: 1, content: validAnswerFor(questions[0]) });

    expect(res.status).toBe(200);
    expect(res.body.interviewerRemark).toBeNull();
    // FR-011: baseline soru korunur, akis devam eder.
    expect(res.body.currentQuestion.text).toBe(questions[1].text);
  });
});
