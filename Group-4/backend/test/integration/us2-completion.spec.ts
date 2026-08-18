import request from 'supertest';
import {
  createInterviewTestApp,
  type InterviewTestApp,
} from './helpers/interview-app';
import { registerAndSignIn } from './helpers/auth-session';
import {
  createTestInterview,
  validAnswerFor,
} from './helpers/create-test-interview';
import { fakeReport } from './helpers/complete-interview';

// Hikaye 2 kriter 2 / FR-012, FR-024, SC-012: son soru (N) cevaplanir ->
// status=completed, completedAt YAZILI, rapor uretimi tetiklenir.
//
// NOT (Faz 5 guncellemesi): reportStatus='pending' GECICI bir durumdur.
// contracts/interview-api.md §4 rapor uretimini "eszamanli tetiklenir" diyor;
// dolayisiyla istemcinin gordugu yanitta durum zaten 'ready' (veya LLM
// basarisizsa 'failed') olmustur. Faz 4'te bu test 'pending' bekliyordu cunku
// rapor uretimi henuz yoktu — o varsayim Faz 5 ile gecersiz kaldi.
describe('POST /api/interviews/:id/answers (US2 tamamlanma)', () => {
  let ctx: InterviewTestApp;
  const email = `us2-complete-${Date.now()}@example.com`;
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

  it('N. soru cevaplaninca gorusme tamamlanir ve rapor uretimi tetiklenir', async () => {
    const { interviewId, questions } = await createTestInterview(ctx, cookies, {
      questionCount: 5,
    });

    let res!: request.Response;
    for (const question of questions) {
      // Son cevaptan once rapor senaryosunu devreye al (yoksa soru-uretimi
      // yaniti rapor semasina uymaz ve reportStatus 'failed' olur).
      if (question.order === questions.length) {
        ctx.fakeLlm.always({ content: fakeReport() });
      }
      res = await request(ctx.app.getHttpServer())
        .post(`/api/interviews/${interviewId}/answers`)
        .set('Cookie', cookies)
        .send({
          questionOrder: question.order,
          content: validAnswerFor(question),
        });
    }

    expect(res.status).toBe(200);
    expect(res.body.interview.status).toBe('completed');
    expect(res.body.interview.completedAt).not.toBeNull();
    expect(res.body.currentQuestion).toBeNull();
    // 'not_applicable' DEGIL: tamamlanma rapor akisini baslatti.
    expect(res.body.interview.reportStatus).toBe('ready');

    const interview = await ctx.prisma.interview.findUniqueOrThrow({
      where: { id: interviewId },
    });
    expect(interview.completedAt).not.toBeNull();
    // Gorusme suresi = completedAt - createdAt (admin istatistigi, SC-012).
    expect(interview.completedAt!.getTime()).toBeGreaterThanOrEqual(
      interview.createdAt.getTime(),
    );
  });
});
