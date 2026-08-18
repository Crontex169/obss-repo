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

// Hikaye 1 kriter 1 (H1-1): gecerli secimlerle POST -> 201, rapor DB'ye yazilir,
// isActive=true, status=completed (quickstart.md Hikaye 1 tablosu 1.1).
describe('POST /api/pre-assessments (US1 mutlu yol)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us1-happy-${Date.now()}@example.com`;
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

  it("201 doner, rapor DB'ye yazilir, isActive=true, status=completed", async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('completed');
    expect(res.body.isActive).toBe(true);
    expect(res.body.report.genelOzet).toBeDefined();
    expect(res.body.report.gucluYonler.length).toBeGreaterThanOrEqual(2);
    expect(res.body.report.gelisimAlanlari.length).toBeGreaterThanOrEqual(2);
    expect(res.body.report.calismaTarziOzeti).toBeDefined();
    expect(res.body.report.guvenSeviyesi).toBe('orta');

    const dbRecord = await ctx.prisma.preAssessment.findUnique({
      where: { id: res.body.id },
      include: { report: true },
    });
    expect(dbRecord?.status).toBe('completed');
    expect(dbRecord?.isActive).toBe(true);
    expect(dbRecord?.report).not.toBeNull();
  });

  it('FR-002d: experienceLevel istemciden SORULMAZ, deneyim suresinden turetilir', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      // Istemci gondermeye calissa bile YOK SAYILIR: y5_10 -> senior beklenir.
      .send(
        validCreateBody({
          experienceYears: 'y5_10',
          experienceLevel: 'intern',
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.experienceLevel).toBe('senior');
  });

  it('rapor sayisal skor, yol haritasi VEYA meslege gore bolumleme icermez (FR-006, FR-006b)', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ experienceYears: 'none' }));

    expect(res.status).toBe(201);
    expect(res.body.report.skor).toBeUndefined();
    expect(res.body.report.yolHaritasi).toBeUndefined();
    expect(res.body.report.alanlar).toBeUndefined();
  });
});
