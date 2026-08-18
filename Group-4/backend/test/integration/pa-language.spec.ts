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

// Faz 8 — Dil dogrulamasi (FR-017/018/019).
describe('Dil cozumlemesi ve sema kararliligi', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-language-${Date.now()}@example.com`;
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

  it('T069/FR-017: Accept-Language: de-DE -> language="en", prompt <dil>en</dil> tasir', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .set('Accept-Language', 'de-DE')
      .send(validCreateBody());

    expect(res.status).toBe(201);
    expect(res.body.language).toBe('en');
    expect(ctx.fakeLlm.calls.at(-1)?.userData).toContain('<dil>en</dil>');
  });

  it('T069/FR-017: Accept-Language: tr-TR -> language="tr", prompt <dil>tr</dil> tasir', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .set('Accept-Language', 'tr-TR,tr;q=0.9')
      .send(validCreateBody());

    expect(res.status).toBe(201);
    expect(res.body.language).toBe('tr');
    expect(ctx.fakeLlm.calls.at(-1)?.userData).toContain('<dil>tr</dil>');
  });

  it('T070/FR-018/SC-011: sema alan adlari ve guvenSeviyesi enum degerleri tr/en arasinda AYNI', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const trRes = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .set('Accept-Language', 'tr')
      .send(validCreateBody());

    ctx.fakeLlm.always({ content: fakeCompetencyReport() });
    const enRes = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .set('Accept-Language', 'en')
      .send(validCreateBody());

    expect(Object.keys(trRes.body.report).sort()).toEqual(
      Object.keys(enRes.body.report).sort(),
    );
    // Alan adlari her iki dilde de Turkce koklu SABITTIR (FR-018) - cevrilmez.
    for (const body of [trRes.body, enRes.body]) {
      expect(Object.keys(body.report)).toEqual(
        expect.arrayContaining([
          'genelOzet',
          'gucluYonler',
          'gelisimAlanlari',
          'calismaTarziOzeti',
          'guvenSeviyesi',
        ]),
      );
    }
    // guvenSeviyesi enum degeri (dusuk/orta/yuksek) dilden bagimsiz sabittir.
    expect(['dusuk', 'orta', 'yuksek']).toContain(
      trRes.body.report.guvenSeviyesi,
    );
    expect(['dusuk', 'orta', 'yuksek']).toContain(
      enRes.body.report.guvenSeviyesi,
    );
  });
});
