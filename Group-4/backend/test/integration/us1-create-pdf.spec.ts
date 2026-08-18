import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// unpdf'in gercek PDF.js motoru yalnizca ESM (bkz. test/fakes/fake-unpdf.ts
// basindaki gerekce) — Jest'in CJS derlemesinden dinamik import edilemez.
// PdfExtractionService'in SOZLESMESI test edilir (tip/boyut/metin akisi);
// PDF.js'in kendi ayristirma dogrulugu ayri bir kutuphanenin sorumlulugu.
jest.mock('unpdf', () => require('../fakes/fake-unpdf'));

// Hikaye 1 kriter 2: jobPostingSource=pdf yuklenir, sunucu metni cikarir, ayni
// akis calisir.
describe('POST /api/interviews (US1 PDF ile olusturma)', () => {
  let ctx: InterviewTestApp;
  const email = `us1-pdf-${Date.now()}@example.com`;
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

  it('PDF yuklenince metin cikarilir ve ayni akis calisir', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .field('jobPostingSource', 'pdf')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'senior')
      .attach(
        'jobPostingFile',
        // Servis artik icerikten tur dogrulamasi yapiyor (docs/SECURITY.md S10),
        // bu yuzden fixture gercek bir `%PDF-` sihirli bayti tasimali. Sahte
        // unpdf bu basligi kirpar; yankilanan metin yine ilan metnidir.
        Buffer.from('%PDF-1.4\nDeneyimli Yazilim Muhendisi Ariyoruz', 'utf-8'),
        {
          filename: 'ilan.pdf',
          contentType: 'application/pdf',
        },
      );

    expect(res.status).toBe(201);
    expect(res.body.interview.jobPostingFileName).toBe('ilan.pdf');

    // LLM'e giden veri PDF'ten cikarilan metni icermeli (userData -> data izolasyonu).
    const call = ctx.fakeLlm.calls.at(-1)!;
    expect(call.userData).toContain('Deneyimli Yazilim Muhendisi Ariyoruz');
  });
});
