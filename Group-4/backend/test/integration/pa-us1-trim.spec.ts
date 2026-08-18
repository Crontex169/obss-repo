import request from 'supertest';
import {
  createPreAssessmentTestApp,
  type PreAssessmentTestApp,
} from './helpers/pa-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  fakeCompetencyReport,
  validCreateBody,
} from './helpers/fake-competency-report';

// 008 (#69) — on degerlendirme sadelestirme, uctan uca.
//
// Iki sey kilitlenir:
//  1. Bes zorunlu alanla akis tamamlanir; kaldirilan alanlar DB'de null kalir.
//  2. Kaldirilan alanlari HALA gonderen eski bir istemci (onbellekteki sekme)
//     REDDEDILMEZ - alanlar yok sayilir. Bu, semanin .strict() OLMAMASINA
//     dayanir; sonradan .strict() eklenirse bu test kirilir ve sebebini soyler.
describe('POST /api/pre-assessments (008 sadelestirme)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us1-trim-${Date.now()}@example.com`;
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

  it('bes zorunlu alan yeterli -> 201, kaldirilan alanlar DB de null', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(201);

    const row = await ctx.prisma.preAssessment.findUnique({
      where: { id: res.body.id },
      select: {
        learningStyle: true,
        selfRatings: true,
        educationLevel: true,
        experienceLevel: true,
      },
    });

    expect(row?.learningStyle).toBeNull();
    expect(row?.selfRatings).toBeNull();
    expect(row?.educationLevel).toBeNull();
    // Turetilmis alan kaldirilan alanlara BAGLI DEGIL - deneyim yilindan gelir.
    expect(row?.experienceLevel).toBeTruthy();
  });

  it('prompt ta kaldirilan alanlarin satiri YOK', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    ctx.fakeLlm.reset();

    await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    const userData = ctx.fakeLlm.calls.at(-1)?.userData ?? '';
    expect(userData).not.toContain('ogrenme_tarzi');
    expect(userData).not.toContain('oz_degerlendirme');
    expect(userData).not.toContain('egitim_durumu');
    expect(userData).not.toContain('undefined');
  });

  it('eski istemci kaldirilan alanlari gonderirse REDDEDILMEZ, yok sayilir', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          learningStyle: 'shown',
          educationLevel: 'vocational',
          selfRatings: { dikkat_titizlik: 4, ogrenme_hizi: 5 },
        }),
      );

    expect(res.status).toBe(201);

    const row = await ctx.prisma.preAssessment.findUnique({
      where: { id: res.body.id },
      select: { learningStyle: true, selfRatings: true, educationLevel: true },
    });

    // Yok sayilmis olmali - gonderildi diye YAZILMAMALI.
    expect(row?.learningStyle).toBeNull();
    expect(row?.selfRatings).toBeNull();
    expect(row?.educationLevel).toBeNull();
  });
});
