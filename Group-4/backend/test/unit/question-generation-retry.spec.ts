import { InterviewService } from '../../src/interview/interview.service';
import { LlmProviderError, LlmSchemaError } from '../../src/llm/llm.errors';
import { buildQuestionBlueprint } from '../../src/interview/llm/question-blueprint';
import type { LlmService } from '../../src/llm/llm.service';
import type { PdfExtractionService } from '../../src/pdf/pdf-extraction.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { CreateInterviewInput } from '../../src/interview/dto/create-interview.dto';

// Soru uretimi projedeki EN KISITLI LLM ciktisi: N sorunun her biri katmanli
// plana uymak zorunda ve bu kisitlar saglayicinin constrained decoding'i
// tarafindan ZORLANMIYOR — yalnizca Zod yakaliyor. Tek sapma tum mulakati
// 502'ye dusuruyordu ve kullanici hicbir sey almadan saatlik kotasindan (3)
// bir hak kaybediyordu.
//
// Sicaklik 0.8 oldugu icin AYNI girdiyle ikinci deneme farkli bir cikti uretir.
// Bu dosya o tek tekrarin sozlesmesini sabitler: sema hatasinda BIR kez, baska
// hicbir hata turunde HIC.

const QUESTION_COUNT = 6;

function generatedFor(count: number) {
  return {
    rejection: null,
    position: 'Vardiya Sorumlusu',
    questions: buildQuestionBlueprint(count, 'written').map((slot) => ({
      topic: `Konu ${slot.topicIndex + 1}`,
      layer: slot.layer,
      style: slot.style,
      type: slot.type,
      text: `Soru ${slot.order}`,
      options:
        slot.type === 'multiple_choice' ? ['Secenek A', 'Secenek B'] : [],
      tip: null,
      rationale: null,
    })),
  };
}

// create() yalnizca su uc noktada DB'ye dokunur: aktif on degerlendirme
// aramasi, Interview yazimi, Question yazimi. Hepsi burada sahte.
function fakePrisma() {
  const tx = {
    interview: { create: jest.fn().mockResolvedValue({ id: 'interview-1' }) },
    question: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    preAssessment: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    __tx: tx,
  };
}

function makeService(generateStructured: jest.Mock) {
  const prisma = fakePrisma();
  const service = new InterviewService(
    prisma as unknown as PrismaService,
    { generateStructured } as unknown as LlmService,
    {} as PdfExtractionService,
  );
  return { service, prisma };
}

const dto = {
  jobPostingSource: 'text',
  jobPostingText: 'Gecerli bir is ilani metni.',
  questionCount: QUESTION_COUNT,
  mode: 'written',
  level: 'junior',
  adaptiveEnabled: false,
} as CreateInterviewInput;

const args = {
  dto,
  file: undefined,
  cvFile: undefined,
  acceptLanguage: 'tr',
  userId: 'user-1',
};

describe('soru uretimi — sema hatasinda tek tekrar', () => {
  it('ilk cagri semayi gecemezse ikinci kez denenir ve mulakat olusur', async () => {
    const generateStructured = jest
      .fn()
      .mockRejectedValueOnce(new LlmSchemaError())
      .mockResolvedValueOnce(generatedFor(QUESTION_COUNT));

    const { service, prisma } = makeService(generateStructured);
    const interview = await service.create(args);

    expect(generateStructured).toHaveBeenCalledTimes(2);
    expect(interview).toEqual({ id: 'interview-1' });
    expect(prisma.__tx.question.createMany).toHaveBeenCalledTimes(1);
  });

  it('ikinci deneme de semayi gecemezse hata cagirana gider (sonsuz dongu YOK)', async () => {
    const generateStructured = jest
      .fn()
      .mockRejectedValue(new LlmSchemaError());

    const { service } = makeService(generateStructured);

    await expect(service.create(args)).rejects.toBeInstanceOf(LlmSchemaError);
    expect(generateStructured).toHaveBeenCalledTimes(2);
  });

  it('saglayici hatasi TEKRARLANMAZ — telafisi yedek saglayici + kota iadesi', async () => {
    const generateStructured = jest
      .fn()
      .mockRejectedValue(new LlmProviderError());

    const { service } = makeService(generateStructured);

    await expect(service.create(args)).rejects.toBeInstanceOf(LlmProviderError);
    expect(generateStructured).toHaveBeenCalledTimes(1);
  });

  it('ilk cagri basariliysa ikinci cagri yapilmaz', async () => {
    const generateStructured = jest
      .fn()
      .mockResolvedValue(generatedFor(QUESTION_COUNT));

    const { service } = makeService(generateStructured);
    await service.create(args);

    expect(generateStructured).toHaveBeenCalledTimes(1);
  });
});
