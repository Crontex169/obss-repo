import request from 'supertest';
import {
  createPreAssessmentTestApp,
  freshUser,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { validCreateBody } from './helpers/fake-competency-report';

// Hikaye 1 kriter 2 (H1-2): zorunlu alanlardan biri eksikse -> 400.
//
// Her senaryo TAZE kullanici acar (bkz. pa-app.ts freshUser yorumu): hiz siniri
// guard'i pipe'tan once calistigi icin 400 donen istekler de kotayi tuketir.
describe('POST /api/pre-assessments (US1 dogrulama hatalari)', () => {
  let ctx: PreAssessmentTestApp;
  const createdUsers: string[] = [];

  beforeAll(async () => {
    ctx = await createPreAssessmentTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.preAssessment.deleteMany({
      where: { user: { email: { in: createdUsers } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: createdUsers } },
    });
    await ctx.app.close();
  });

  async function user(tag: string) {
    const u = await freshUser(ctx, `us1-validation-${tag}`);
    createdUsers.push(u.email);
    return u.cookies;
  }

  // 008: learningStyle ve selfRatings artik zorunlu DEGIL - listeden cikarildi.
  it.each([
    'experienceYears',
    'workStatus',
    'workPreference',
    'teamPreference',
    'problemApproach',
  ])('zorunlu alan eksik (%s) -> 400', async (field) => {
    const cookies = await user(field.toLowerCase());
    const body = validCreateBody();
    delete body[field];

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BadRequest');
  });

  // 008: selfRatings madde sayisi/adi dogrulamalari kaldirildi - alan artik
  // istekte yok. Kaldirilan alanlarin YOK SAYILDIGI pa-us1-trim.spec.ts'de.

  it('oturumsuz istek -> 401 (H4-1)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .send(validCreateBody());

    expect(res.status).toBe(401);
  });
});
