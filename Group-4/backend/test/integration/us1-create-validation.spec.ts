import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// Bkz. test/fakes/fake-unpdf.ts basindaki gerekce (Jest CJS + unpdf ESM
// dinamik import kisitlamasi). "10 MB ustu"/"desteklenmeyen tur" testleri
// unpdf'e hic ulasmaz (tip/boyut kontrolu ondan once); "metni cikarilamayan"
// testi ise dogrudan bu sahteyi kullanir.
jest.mock('unpdf', () => require('../fakes/fake-unpdf'));

// Hikaye 1 kriter 3,4 / FR-003: dogrulama hatalari.
//
// NOT: LlmRateLimitGuard (3/saat) SessionGuard'dan hemen sonra, DTO
// dogrulamasindan ONCE calisir (guard -> pipe sirasi) — yani dogrulama
// hatasi verecek istekler de kotayi tuketir. Bu yuzden her `it` KENDI
// kullanicisiyla calisir; ayni kullanicida >3 istek testi kirar.
describe('POST /api/interviews (US1 dogrulama)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let counter = 0;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  async function freshCookies(): Promise<string[]> {
    counter += 1;
    const email = `us1-valid-${Date.now()}-${counter}@example.com`;
    emails.push(email);
    return registerAndSignIn(ctx.app, ctx.prisma, email);
  }

  const base = {
    jobPostingSource: 'text' as const,
    jobPostingText: 'Gecerli bir is ilani metni.',
    mode: 'written' as const,
    level: 'junior' as const,
  };

  async function post(body: Record<string, unknown>) {
    return request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .send(body);
  }

  it('questionCount 5-20 disi -> 400', async () => {
    ctx.fakeLlm.always({ content: fakeQuestions(0) });
    await expect(post({ ...base, questionCount: 0 })).resolves.toMatchObject({
      status: 400,
    });
    // Alt sinir 5: 4 hala reddedilir (en az 5 degerlendirme kriteri).
    await expect(post({ ...base, questionCount: 4 })).resolves.toMatchObject({
      status: 400,
    });
    await expect(post({ ...base, questionCount: 21 })).resolves.toMatchObject({
      status: 400,
    });
  });

  it('bos/bosluk metin -> 400', async () => {
    await expect(
      post({ ...base, jobPostingText: '   ', questionCount: 5 }),
    ).resolves.toMatchObject({ status: 400 });
  });

  it('level eksik veya enum disi -> 400', async () => {
    const { level: _omit, ...withoutLevel } = base;
    await expect(
      post({ ...withoutLevel, questionCount: 5 }),
    ).resolves.toMatchObject({ status: 400 });
    await expect(
      post({ ...base, level: 'expert', questionCount: 5 }),
    ).resolves.toMatchObject({ status: 400 });
  });

  it('desteklenmeyen dosya turu -> 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .field('jobPostingSource', 'pdf')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'junior')
      .attach('jobPostingFile', Buffer.from('not a pdf'), {
        filename: 'ilan.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
  });

  it('10 MB ustu dosya -> 400', async () => {
    // Sihirli bayt basta durur ki dosya "cok buyuk" yanitini alsin,
    // "desteklenmeyen tur" degil (docs/SECURITY.md S10 — boyut kontrolu once).
    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.4\n', 'utf-8'),
      Buffer.alloc(10 * 1024 * 1024 + 1, 0x41),
    ]);
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .field('jobPostingSource', 'pdf')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'junior')
      .attach('jobPostingFile', oversized, {
        filename: 'buyuk.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(400);
  });

  it('metni cikarilamayan PDF -> 422', async () => {
    // Sahte unpdf yuklenen bayt dizisini DOGRUDAN metin olarak yankilar;
    // bos/bosluk icerik -> normalize sonrasi bos metin -> 422.
    const res = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', await freshCookies())
      .field('jobPostingSource', 'pdf')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'junior')
      .attach('jobPostingFile', Buffer.from('%PDF-1.4\n   \n  ', 'utf-8'), {
        filename: 'bos.pdf',
        contentType: 'application/pdf',
      });
    expect(res.status).toBe(422);
  });
});
