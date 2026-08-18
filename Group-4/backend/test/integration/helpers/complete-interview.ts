import request from 'supertest';
import type { InterviewTestApp } from './interview-app';
import { createTestInterview, validAnswerFor } from './create-test-interview';

// US5 testleri icin: bir gorusmeyi olusturup TUM sorularini cevaplayarak
// completed duruma getirir. Son cevapta rapor uretimi eszamanli tetiklenir —
// bu yuzden cagiran, son cevaptan ONCE fakeLlm'e rapor senaryosunu kuyruklamali.
//
// fakeLlm cagri sirasi: [0] soru uretimi, [1] rapor uretimi.
export async function completeInterview(
  ctx: InterviewTestApp,
  cookies: string[],
  opts: {
    questionCount?: number;
    reportScenario?: Parameters<InterviewTestApp['fakeLlm']['always']>[0];
  } = {},
): Promise<{ interviewId: string; lastResponse: request.Response }> {
  const questionCount = opts.questionCount ?? 5;
  const { interviewId, questions } = await createTestInterview(ctx, cookies, {
    questionCount,
  });

  let lastResponse!: request.Response;
  for (const question of questions) {
    // Son cevaptan hemen once rapor senaryosunu devreye al: createTestInterview
    // always() ile soru uretimi yanitini kurmustu, onu simdi degistiriyoruz.
    if (question.order === questionCount && opts.reportScenario) {
      ctx.fakeLlm.always(opts.reportScenario);
    }
    lastResponse = await request(ctx.app.getHttpServer())
      .post(`/api/interviews/${interviewId}/answers`)
      .set('Cookie', cookies)
      .send({
        questionOrder: question.order,
        content: validAnswerFor(question),
      });
  }

  return { interviewId, lastResponse };
}

// contracts/interview-flow-rules.md §4.3 sekliyle gecerli rapor yaniti.
export function fakeReport(overrides: Record<string, unknown> = {}) {
  return {
    // Issue #68 ile reportSchema'ya ZORUNLU alan olarak eklendi (.nullable()
    // degil). Bos dizi semayi gecer; icerige bakan bir test yok, gerektiginde
    // overrides ile gercekci kayit verilir.
    questionFeedback: [],
    overallImpression: 'Aday genel olarak yeterli bir performans gosterdi.',
    strengths: ['Net iletisim', 'Teknik temel'],
    improvementAreas: ['Derinlemesine ornek verme'],
    scores: { technical: 72, behavioral: 80, general: 75 },
    additionalNotes: null,
    ...overrides,
  };
}
