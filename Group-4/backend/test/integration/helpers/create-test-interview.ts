import request from 'supertest';
import type { InterviewTestApp } from './interview-app';
import { fakeQuestions } from './fake-questions';

// US2+ testleri icin: US1 akisini kullanarak N sorulu bir gorusme olusturur.
// fakeLlm.always() burada CAGRILIR — cagiran test daha sonra kendi senaryosunu
// (ornegin adaptif LLM yaniti) ustune enqueue edebilir.
export async function createTestInterview(
  ctx: InterviewTestApp,
  cookies: string[],
  opts: {
    questionCount?: number;
    mode?: 'written' | 'voice';
    adaptiveEnabled?: boolean;
  } = {},
): Promise<{
  interviewId: string;
  questions: { order: number; type: string; text: string; options: string[] }[];
}> {
  const questionCount = opts.questionCount ?? 5;
  ctx.fakeLlm.always({
    content: fakeQuestions(questionCount, { mode: opts.mode }),
  });

  const res = await request(ctx.app.getHttpServer())
    .post('/api/interviews')
    .set('Cookie', cookies)
    .send({
      jobPostingSource: 'text',
      jobPostingText: 'Gecerli bir is ilani metni.',
      questionCount,
      mode: opts.mode ?? 'written',
      level: 'junior',
      adaptiveEnabled: opts.adaptiveEnabled ?? false,
    });

  const interviewId = res.body.interview.id as string;
  const questions = await ctx.prisma.question.findMany({
    where: { interviewId },
    orderBy: { order: 'asc' },
    select: { order: true, type: true, text: true, options: true },
  });

  return { interviewId, questions };
}

// Soru tipine gore GECERLI bir cevap uretir: coktan secmelide options'tan biri
// olmak ZORUNDA (FR-008), acik uclu soruda serbest metin.
export function validAnswerFor(question: {
  type: string;
  options: string[];
}): string {
  return question.type === 'multiple_choice'
    ? question.options[0]
    : 'Serbest metin cevabi.';
}
