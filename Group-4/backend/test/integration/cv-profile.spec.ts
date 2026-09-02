import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// unpdf gercek motoru ESM — us1-create-pdf.spec.ts ile ayni gerekce.
jest.mock('unpdf', () => require('../fakes/fake-unpdf'));

// Kalici CV profili: CV BIR kez yuklenir (Ayarlar), sonraki gorusmeler dosya
// istemeden onu baglam olarak kullanir. Sozlesme:
//   - CV METNI istemciye HIC donmez (yalnizca dosya adi + tarih),
//   - yeni gorusme kayitli CV'yi varsayilan olarak kullanir,
//   - useStoredCv=false onu kapatir,
//   - silme idempotenttir.
describe('Kalici CV profili (api/users/me/cv)', () => {
  let ctx: InterviewTestApp;
  const email = `cv-profile-${Date.now()}@example.com`;
  let cookies: string[];

  const cvPdf = Buffer.from(
    '%PDF-1.4\nAli Celenk — 5 yil Kubernetes ve Go deneyimi',
    'utf-8',
  );

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({ where: { user: { email } } });
    await ctx.prisma.user.deleteMany({ where: { email } });
    await ctx.app.close();
  });

  it('oturum yok -> 401', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/users/me/cv')
      .attach('cvFile', cvPdf, {
        filename: 'cv.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(401);
  });

  it('dosyasiz istek -> 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/users/me/cv')
      .set('Cookie', cookies);
    expect(res.status).toBe(400);
  });

  it('PDF olmayan dosya reddedilir', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/users/me/cv')
      .set('Cookie', cookies)
      .attach('cvFile', Buffer.from('duz metin'), {
        filename: 'cv.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
  });

  it('yuklenen CV kaydedilir; GET /api/users/me dosya adini doner, METNI DONMEZ', async () => {
    const upload = await request(ctx.app.getHttpServer())
      .post('/api/users/me/cv')
      .set('Cookie', cookies)
      .attach('cvFile', cvPdf, {
        filename: 'ali-cv.pdf',
        contentType: 'application/pdf',
      });
    expect(upload.status).toBe(200);
    expect(upload.body.fileName).toBe('ali-cv.pdf');

    const me = await request(ctx.app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);
    expect(me.status).toBe(200);
    expect(me.body.cv.fileName).toBe('ali-cv.pdf');
    expect(me.body.cv.updatedAt).not.toBeNull();
    // Veri asgarisi: metin istemciye gitmez.
    expect(JSON.stringify(me.body)).not.toContain('Kubernetes');

    // Metin yine de SUNUCUDA saklanir (gorusme promptu icin).
    const row = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
      select: { cvText: true },
    });
    expect(row.cvText).toContain('Kubernetes');
  });

  it("yeni gorusme kayitli CV'yi dosya YUKLEMEDEN baglam olarak kullanir", async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .field('jobPostingSource', 'text')
      .field('jobPostingText', 'Platform muhendisi araniyor. Kubernetes, Go.')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'mid');

    expect(res.status).toBe(201);
    expect(ctx.fakeLlm.calls.at(-1)!.userData).toContain('Kubernetes ve Go');
  });

  it('useStoredCv=false gonderilirse kayitli CV promptta YER ALMAZ', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(5) });

    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .field('jobPostingSource', 'text')
      .field('jobPostingText', 'Platform muhendisi araniyor. Kubernetes, Go.')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'mid')
      // Multipart: STRING "false" gelir (frontend'in gercek yolu).
      .field('useStoredCv', 'false');

    expect(res.status).toBe(201);
    expect(ctx.fakeLlm.calls.at(-1)!.userData).not.toContain('Ali Celenk');
  });

  it('silme 204 doner ve idempotenttir', async () => {
    const first = await request(ctx.app.getHttpServer())
      .delete('/api/users/me/cv')
      .set('Cookie', cookies);
    expect(first.status).toBe(204);

    const second = await request(ctx.app.getHttpServer())
      .delete('/api/users/me/cv')
      .set('Cookie', cookies);
    expect(second.status).toBe(204);

    const me = await request(ctx.app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookies);
    expect(me.body.cv).toBeNull();
  });
});
