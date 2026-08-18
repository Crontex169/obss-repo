import { HttpStatus } from '@nestjs/common';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { PreAssessmentService } from '../../src/pre-assessment/pre-assessment.service';
import { makeLlmService } from './helpers/make-llm-service';

// H3-3, FR-008a: 30 sn asilirsa LlmTimeoutError -> 504, kullanici SURESIZ
// beklemez. jest sahte zamanlayicilariyla test edilir (llm-timeout.spec.ts'teki
// desenle ayni — gercek 30 sn beklemek yerine); bu dilim varsayilan timeout'u
// OVERRIDE ETMEZ (interview raporunun aksine, §3.2).
describe('PreAssessmentService.create — timeout (US3)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('30 sn asilirsa 504 firlatir, kayit failed/timeout olarak isaretlenir', async () => {
    const { service: llm, fake } = makeLlmService();
    fake.always({ delayMs: 31_000, content: {} });

    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      preAssessment: {
        create: jest.fn().mockResolvedValue({ id: 'pa-timeout-1' }),
        update,
      },
    } as unknown as PrismaService;

    const service = new PreAssessmentService(prisma, llm);

    const call = service
      .create({
        dto: {
          experienceYears: 'y1_3',
          workStatus: 'seeking',
          workPreference: 'hands_on',
          teamPreference: 'small_team',
          problemApproach: 'ask_experienced',
          skills: undefined,
          openAnswers: undefined,
        },
        acceptLanguage: 'tr',
        userId: 'u1',
      })
      .catch((e: unknown) => e) as Promise<{ getStatus(): number }>;
    const advance = jest.advanceTimersByTimeAsync(30_000);

    const [error] = await Promise.all([call, advance]);
    expect(error.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'pa-timeout-1' },
      data: { status: 'failed', failureReason: 'timeout' },
    });
  });
});
