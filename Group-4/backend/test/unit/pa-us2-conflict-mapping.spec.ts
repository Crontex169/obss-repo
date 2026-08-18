import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { PreAssessmentService } from '../../src/pre-assessment/pre-assessment.service';
import { makeLlmService } from './helpers/make-llm-service';

// T048 — Prisma P2002 (partial unique index ihlali) -> 409 Conflict eslemesi.
//
// Bu esleme onceden yalnizca eszamanlilik entegrasyon testiyle (T043) dolayli
// olarak kapsaniyordu; ancak orada 409 dali ZAMANLAMAYA bagli oldugu icin test
// flaky'di ve dogru invariant "iki aktif kayit olusmaz" olarak duzeltildi
// (bkz. pa-us2-view-reassess-archive.spec.ts yorumu). 409 eslemesinin kendisi
// burada DETERMINISTIK olarak dogrulanir.
describe('PreAssessmentService.create — P2002 -> 409 (FR-004)', () => {
  const validDto = {
    experienceYears: 'y1_3' as const,
    workStatus: 'seeking' as const,
    workPreference: 'hands_on' as const,
    teamPreference: 'small_team' as const,
    learningStyle: 'shown' as const,
    problemApproach: 'ask_experienced' as const,
    selfRatings: {
      dikkat_titizlik: 4,
      ogrenme_hizi: 4,
      iletisim: 4,
      fiziksel_dayaniklilik: 4,
      zaman_yonetimi: 4,
      baski_altinda: 4,
      sorumluluk: 4,
      ekip_uyumu: 4,
    },
    skills: undefined,
    openAnswers: undefined,
  };

  const validReport = {
    genelOzet: 'x'.repeat(60),
    gucluYonler: ['a', 'b'],
    gelisimAlanlari: ['c', 'd'],
    calismaTarziOzeti: 'y'.repeat(40),
    guvenSeviyesi: 'orta',
  };

  it('partial unique index ihlali -> 409 ve kayit failed olarak isaretlenir', async () => {
    const { service: llm, fake } = makeLlmService();
    fake.always({ content: validReport });

    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      preAssessment: {
        create: jest.fn().mockResolvedValue({ id: 'pa-conflict-1' }),
        update,
      },
      $transaction: jest.fn().mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique violation', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      ),
    } as unknown as PrismaService;

    const service = new PreAssessmentService(prisma, llm);

    const error = (await service
      .create({ dto: validDto, acceptLanguage: 'tr', userId: 'u1' })
      .catch((e: unknown) => e)) as { getStatus(): number };

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    // Kaybeden istek "generating" durumunda asili KALMAZ.
    expect(update).toHaveBeenCalledWith({
      where: { id: 'pa-conflict-1' },
      data: { status: 'failed' },
    });
  });
});
