import request from 'supertest';
import { buildQuestionBlueprint } from '../../src/interview/llm/question-blueprint';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { createTestInterview } from './helpers/create-test-interview';

// Hikaye 2 kriter 5 / FR-008: coktan secmeli soruda options listesinde
// olmayan bir deger -> 400.
describe('POST /api/interviews/:id/answers (US2 coktan secmeli dogrulama)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-mc-${Date.now()}@example.com`;
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

  it('options disinda bir deger -> 400; gecerli secenek -> 200', async () => {
    const { interviewId } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
      mode: 'written',
    });

    // Hangi sorunun coktan secmeli oldugu artik KATMANLI PLANDAN gelir
    // (question-blueprint.ts), fixture'in kendi i%2 kuralindan degil. Sabit bir
    // sira numarasi yazilirsa plan degistiginde bu test sessizce ACIK UCLU bir
    // soruyu dogrulamaya baslar ve hicbir sey olcmez.
    const mcOrder = buildQuestionBlueprint(5, 'written').find(
      (slot) => slot.type === 'multiple_choice',
    )?.order;
    // Ilk soru: sirali cevaplama akisi ek adim gerektirmesin.
    expect(mcOrder).toBe(1);

    const invalid = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: mcOrder, content: 'Listede olmayan secenek' });
    expect(invalid.status).toBe(400);

    const valid = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({ questionOrder: mcOrder, content: 'Secenek A' });
    expect(valid.status).toBe(200);
  });
});
