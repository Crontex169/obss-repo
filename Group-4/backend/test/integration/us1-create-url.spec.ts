import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';

// 009-linkedin-ilan-cekme: ilan baglantisindan otomatik ilan cekme.
// GERCEK AGA CIKILMAZ — global fetch taklit edilir, kayitli HTML fixture
// kullanilir (specs/009 §3).

const JOB_URL =
  'https://www.linkedin.com/jobs/view/senior-backend-engineer-at-acme-4447384933';

const DESCRIPTION_HTML = `
<div class="show-more-less-html__markup show-more-less-html__markup--clamp-after-5">
  <p>Deneyimli Backend Muhendisi ariyoruz.</p>
  <ul><li>Node.js &amp; TypeScript ile en az 3 yil deneyim</li>
  <li>PostgreSQL ve iliskisel veri modelleme bilgisi</li></ul>
  <p>Takimimiza katilmak icin basvurun.</p>
</div>`;

function pageWith(body: string): string {
  return `<!DOCTYPE html><html><body><section>${body}</section></body></html>`;
}

function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Response;
}

// NOT (us1-create-validation.spec.ts ile ayni kisit): LlmRateLimitGuard
// (3/saat) DTO dogrulamasindan ONCE calisir, reddedilen istekler de kotayi
// tuketir. Bu yuzden her `it` KENDI kullanicisiyla calisir. Guard'in bu
// sirasi ayrica isteneni saglar: kota, hicbir DIS ISTEK yapilmadan devreye
// girer (specs/009 §2.6).
describe('POST /api/interviews (US1 ilan baglantisi ile olusturma)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  const cookiePool: string[][] = [];
  let poolIndex = 0;
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    // Oturumlar GERCEK fetch ile, taklit kurulmadan ONCE acilir.
    for (let i = 0; i < 6; i += 1) {
      const email = `us1-url-${Date.now()}-${i}@example.com`;
      emails.push(email);
      cookiePool.push(await registerAndSignIn(ctx.app, ctx.prisma, email));
    }
  });

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  function post(body: Record<string, unknown>) {
    const cookies = cookiePool[poolIndex];
    poolIndex += 1;
    return request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .send({
        questionCount: 5,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
        ...body,
      });
  }

  // SSRF: kullanici URL'si HICBIR ZAMAN fetch'e verilmez (specs/009 §1).
  // Reddedilen tasarim (alan adi icerik aramasi) bu girdiyi gecirirdi ve
  // sunucuyu bulut metadata servisine istek atmaya zorlardi.
  it('SSRF denemesi: bulut metadata adresi 400 alir, fetch HIC cagrilmaz', async () => {
    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: 'http://169.254.169.254/latest/meta-data/?linkedin.com',
    });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gecerli baglanti: 201 doner, metin cekilen icerikten gelir', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, pageWith(DESCRIPTION_HTML)));

    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: JOB_URL,
    });

    expect(res.status).toBe(201);
    expect(res.body.interview.jobPostingSource).toBe('url');
    expect(res.body.interview.jobPostingText).toContain(
      'Deneyimli Backend Muhendisi ariyoruz.',
    );
    // HTML varliklari cozulur, etiketler duser.
    expect(res.body.interview.jobPostingText).toContain('Node.js & TypeScript');
    expect(res.body.interview.jobPostingText).not.toContain('<li>');

    // Kullanici URL'si degil, SABIT misafir ucu + yalnizca sayisal ID cagrilir.
    const [calledUrl] = fetchMock.mock.calls[0] as [string];
    expect(calledUrl).toBe(
      'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4447384933',
    );

    // Cekilen metin soru uretimine VERI olarak besleniyor.
    expect(ctx.fakeLlm.calls.at(-1)!.userData).toContain(
      'Deneyimli Backend Muhendisi',
    );
  });

  it('baglanti bicimi gecersiz: 400, fetch HIC cagrilmaz', async () => {
    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: 'https://example.com/ilan/123',
    });

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('kaynak 404 donerse 400', async () => {
    fetchMock.mockResolvedValue(fakeResponse(404, ''));

    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: JOB_URL,
    });

    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aciklama blogu bulunamazsa 400', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(200, pageWith('<div class="baska-blok">bos</div>')),
    );

    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: JOB_URL,
    });

    expect(res.status).toBe(400);
  });

  it('cekilen metin 50 karakterden kisaysa 400', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(
        200,
        pageWith(
          '<div class="show-more-less-html__markup"><p>Cok kisa.</p></div>',
        ),
      ),
    );

    const res = await post({
      jobPostingSource: 'url',
      jobPostingUrl: JOB_URL,
    });

    expect(res.status).toBe(400);
  });
});
