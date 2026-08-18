import request from 'supertest';
import {
  createPreAssessmentTestApp,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { registerAndSignIn } from './helpers/auth-session';
import { validCreateBody } from './helpers/fake-competency-report';

// §2: ham saglayici hata metni / stack trace kullaniciya SIZMAZ.
describe('POST /api/pre-assessments (US3 hata sizintisi onleme)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us3-leak-${Date.now()}@example.com`;
  let cookies: string[];

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('saglayici hatasinin ham metni / stack trace govdede YOK', async () => {
    ctx.fakeLlm.always({
      error: new Error(
        'sk-secret-api-key-12345 gecersiz, connection reset at internal.ts:42',
      ),
    });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    const asText = JSON.stringify(res.body);
    expect(asText).not.toContain('sk-secret-api-key');
    expect(asText).not.toContain('internal.ts');
    expect(asText).not.toContain('stack');
    expect(Object.keys(res.body).sort()).toEqual(
      ['details', 'error', 'message', 'statusCode'].sort(),
    );
  });
});
