import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import { fakeQuestions } from './helpers/fake-questions';
import { TranscriptionProviderError } from '../../src/transcription/transcription.errors';

// ADR-0014 — POST /api/interviews/:id/transcribe (sozlu mod STT, Groq Whisper).
describe('POST /api/interviews/:id/transcribe (ADR-0014)', () => {
  let ctx: InterviewTestApp;
  const emails: string[] = [];
  let cookies: string[];
  let interviewId: string;

  beforeAll(async () => {
    ctx = await createInterviewTestApp();
    const email = `us8-owner-${Date.now()}@example.com`;
    emails.push(email);
    cookies = await registerAndSignIn(ctx.app, ctx.prisma, email);

    ctx.fakeLlm.always({ content: fakeQuestions(5, { mode: 'voice' }) });
    const created = await request(ctx.app.getHttpServer())
      .post('/api/interviews')
      .set('Cookie', cookies)
      .set('Accept-Language', 'tr-TR')
      .send({
        jobPostingSource: 'text',
        jobPostingText: 'Gecerli bir is ilani metni.',
        questionCount: 5,
        mode: 'voice',
        level: 'junior',
      });
    interviewId = (created.body.interview as { id: string }).id;
  });

  afterAll(async () => {
    await ctx.prisma.interview.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await ctx.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await ctx.app.close();
  });

  function post() {
    return request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies)
      .attach('audio', Buffer.from('sahte-ses-baytlari'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });
  }

  it('basarili: metni doner, saglayiciya gorusme diliyle gider', async () => {
    ctx.fakeTranscription.always({ text: 'Deneyimliyim.' });

    const res = await post();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'Deneyimliyim.' });
    expect(ctx.fakeTranscription.calls.at(-1)).toMatchObject({
      mimeType: 'audio/webm',
      language: 'tr',
    });
  });

  it('audio alani eksikse 400', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies);

    expect(res.status).toBe(400);
  });

  it('audio disinda bir dosya turu 400 alir', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', cookies)
      .attach('audio', Buffer.from('%PDF-1.4'), {
        filename: 'yanlislikla.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
  });

  it('yabanci kullanici 404 alir (InterviewOwnershipGuard)', async () => {
    const strangerEmail = `us8-stranger-${Date.now()}@example.com`;
    emails.push(strangerEmail);
    const strangerCookies = await registerAndSignIn(
      ctx.app,
      ctx.prisma,
      strangerEmail,
    );

    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .set('Cookie', strangerCookies)
      .attach('audio', Buffer.from('x'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(404);
  });

  it('saglayici hatasinda 502', async () => {
    ctx.fakeTranscription.always({
      error: new TranscriptionProviderError(undefined, new Error('groq coktu')),
    });

    const res = await post();

    expect(res.status).toBe(502);
  });

  it('oturumsuz istek 401 alir', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/transcribe`)
      .attach('audio', Buffer.from('x'), {
        filename: 'kayit.webm',
        contentType: 'audio/webm',
      });

    expect(res.status).toBe(401);
  });

  // FIX4 (final review): SttRateLimitGuard + sttQuota'nin izole bir birim
  // testinden ote, GERCEKTEN uca (@UseGuards + @Throttle) baglandigini
  // kanitlar — us2-answer-rate-limit.spec.ts ile AYNI desen. sttQuota(60)
  // (bkz. interview.controller.ts, FIX5: 30 -> 60), bu yuzden 61 istek.
  it('61. transcribe istegi 429 doner (SttRateLimitGuard uca gercekten bagli)', async () => {
    ctx.fakeTranscription.always({ text: 'Deneyimliyim.' });

    let last!: request.Response;
    for (let i = 0; i < 61; i += 1) {
      last = await post();
    }

    expect(last.status).toBe(429);
    expect(last.body.details.retryAfterSeconds).toBeGreaterThan(0);
  }, 30_000);
});
