import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { completeInterview, fakeReport } from './helpers/complete-interview';
import { fakeQuestions } from './helpers/fake-questions';

// Rapor paylasim linki: aday raporunu HESAP ISTEMEDEN gosterebilmeli, ama
// link tahmin edilemez ve SURELI olmali, sahibi istedigi an iptal edebilmeli.
// Kritik sozlesme maddeleri:
//   - paylasilan govdede kullanicinin kimligi (ad/e-posta) YER ALMAZ,
//   - gecersiz/suresi dolmus/silinmis her durum AYNI 404,
//   - baskasinin gorusmesi icin link uretilemez (sahiplik guard'i).
describe('Rapor paylasim linki', () => {
  let ctx: InterviewTestApp;
  const email = `share-${Date.now()}@example.com`;
  const otherEmail = `share-other-${Date.now()}@example.com`;
  let cookies: string[];
  let otherCookies: string[];
  let interviewId: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);
    otherCookies = await registerAndSignIn(ctx.app, ctx.prisma, otherEmail);
    ({ interviewId } = await completeInterview(ctx, cookies, {
      reportScenario: { content: fakeReport() },
    }));
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: [email, otherEmail] } } },
    });
    await ctx.prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await ctx.app.close();
  });

  it('sahibi link uretir; ayni cagri AYNI token\'i doner (eski link olmez)', async () => {
    const first = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);
    expect(first.status).toBe(200);
    expect(typeof first.body.token).toBe('string');
    expect(first.body.token.length).toBeGreaterThan(20);

    const second = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);
    expect(second.body.token).toBe(first.body.token);
  });

  it('baskasi ayni gorusme icin link uretemez (404)', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', otherCookies);
    expect(res.status).toBe(404);
  });

  it('token ile OTURUMSUZ okunur; kullanici kimligi govdede YOKTUR', async () => {
    const { body } = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);

    // Cookie GONDERILMEZ — anonim okuyucu senaryosu.
    const shared = await request(ctx.app.getHttpServer()).get(
      `/api/shared-reports/${body.token}`,
    );

    expect(shared.status).toBe(200);
    expect(shared.body.report.overallScore).toBeGreaterThan(0);
    expect(shared.body.answeredPairs.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(shared.body);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain('userId');
  });

  it('bilinmeyen token -> 404', async () => {
    const res = await request(ctx.app.getHttpServer()).get(
      '/api/shared-reports/bilinmeyen-token',
    );
    expect(res.status).toBe(404);
  });

  it('suresi dolmus link -> 404 (var olan token da olsa)', async () => {
    const { body } = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);
    await ctx.prisma.interview.update({
      where: { id: interviewId },
      data: { shareExpiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(ctx.app.getHttpServer()).get(
      `/api/shared-reports/${body.token}`,
    );
    expect(res.status).toBe(404);
  });

  it('iptal edilen link bir daha calismaz; iptal idempotenttir', async () => {
    const { body } = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);

    const first = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);
    expect(first.status).toBe(204);

    const second = await request(ctx.app.getHttpServer())
      .delete(`/api/interviews/${interviewId}/share`)
      .set('Cookie', cookies);
    expect(second.status).toBe(204);

    const res = await request(ctx.app.getHttpServer()).get(
      `/api/shared-reports/${body.token}`,
    );
    expect(res.status).toBe(404);
  });

  it('raporu hazir olmayan gorusme paylasilamaz (409)', async () => {
    // Yeni, yarim birakilmis bir gorusme: reportStatus not_applicable.
    // Soru seti ELDE kurulmaz — plan kurallari (question-blueprint.ts)
    // degistiginde fixture sessizce gecersizlesirdi.
    ctx.fakeLlm.always({ content: fakeQuestions(5) });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .field('jobPostingSource', 'text')
      .field('jobPostingText', 'Backend gelistirici araniyor.')
      .field('questionCount', '5')
      .field('mode', 'written')
      .field('level', 'junior');

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${created.body.interview.id}/share`)
      .set('Cookie', cookies);
    expect(res.status).toBe(409);
  });
});
