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

// H1-6 / FR-002b / FR-002c — opsiyonel alanlar (egitim, yetenek etiketleri,
// acik uclu cevaplar) hic gonderilmeden akis normal tamamlanir; gonderildiginde
// prompt'a VERI olarak girer.
describe('POST /api/pre-assessments (opsiyonel alanlar)', () => {
  let ctx: PreAssessmentTestApp;
  const email = `pa-us1-optional-${Date.now()}@example.com`;
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

  it("opsiyonel alanlar HIC gonderilmeden -> 201; prompt'ta ilgili satirlar YOK", async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody());

    expect(res.status).toBe(201);

    const userData = ctx.fakeLlm.calls.at(-1)?.userData ?? '';
    // Bos dizi/bos string olarak DA gorunmemeli (llm-contract.md §3).
    expect(userData).not.toContain('yetenekler');
    expect(userData).not.toContain('egitim_durumu');
    expect(userData).not.toContain('en_iyi_oldugum');
  });

  it("bos dizi / bos string gonderilse bile prompt'ta satir olusmaz", async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          skills: [],
          openAnswers: { enIyiOldugum: '', gelistirmekIstedigim: '' },
        }),
      );

    expect(res.status).toBe(201);
    const userData = ctx.fakeLlm.calls.at(-1)?.userData ?? '';
    expect(userData).not.toContain('yetenekler');
    expect(userData).not.toContain('en_iyi_oldugum');
  });

  it("gecerli opsiyonel alanlar prompt'a veri olarak girer ve DB'ye yazilir", async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(
        validCreateBody({
          skills: ['forklift kullanimi', 'is guvenligi'],
          openAnswers: { enIyiOldugum: 'Ekip icinde uyumlu calisirim' },
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.skills).toEqual(['forklift kullanimi', 'is guvenligi']);

    const userData = ctx.fakeLlm.calls.at(-1)?.userData ?? '';
    expect(userData).toContain('forklift kullanimi');
    expect(userData).toContain('en_iyi_oldugum');
  });

  it('tekrarli etiketler tekillestirilir (kullaniciya hata gosterilmez)', async () => {
    ctx.fakeLlm.always({ content: fakeCompetencyReport() });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/pre-assessments')
      .set('Cookie', cookies)
      .send(validCreateBody({ skills: ['kaynak', 'kaynak', 'boya'] }));

    expect(res.status).toBe(201);
    expect(res.body.skills).toEqual(['kaynak', 'boya']);
  });
});
