// DOSYA REHBERİ: Ön değerlendirme formunun (deneyim, çalışma tercihleri, 8
// madde puanlama, opsiyonel yetenekler/açık uçlu cevaplar) doğru formatta
// gelip gelmediğini kontrol eden Zod şeması. Kullanıcının serbest yazdığı
// metinleri (yetenekler, açık cevaplar) veritabanına/LLM'e gitmeden önce
// temizler ve tekrarlanan etiketleri otomatik olarak teklaştırır.
import { z } from 'zod';
import { sanitizeFreeText } from '../../interview/llm/prompt-shared';
import {
  MAX_OPEN_ANSWER_LENGTH,
  MAX_SKILL_TAGS,
  MAX_SKILL_TAG_LENGTH,
} from '../constants/skill-limits';

// contracts/pre-assessment-api.md — POST /api/pre-assessments istek govdesi.
//
// 2026-08-04 kapsam karari: TUM zorunlu sorular MESLEK-BAGIMSIZ (FR-002).
// `interestAreas` / `experienceLevel` / `skillSelections` KALDIRILDI.
// FR-003: enum disi deger -> 400, LLM CAGRILMAZ (ZodValidationPipe controller'da
// LlmService'e ulasmadan once calisir).

// FR-002b: SERBEST metin. Oneri listesine karsi dogrulama YAPILMAZ (hicbir liste
// tum meslekleri kapsayamaz) - koruma yalnizca uzunluk/adet uzerindendir.
//
// ⚠️ SANITIZASYON SIRASI: uzunluk HAM girdi uzerinde dogrulanir (kullanicinin
// gordugu sinirla ayni), sanitizasyon SONRA uygulanir. Sanitize edilmis deger
// hem DB'ye hem prompt'a gider - ham kontrol karakteri Postgres text kolonuna
// YAZILAMAZ (null byte -> 500) ve <aday_verisi> blogunu kirabilir.
const skillsSchema = z
  .array(z.string().trim().min(1).max(MAX_SKILL_TAG_LENGTH))
  .max(MAX_SKILL_TAGS)
  .transform((tags) => [
    // Tekrarlari sessizce tekillestir: kullaniciya hata gostermek yerine
    // duzeltmek daha iyi bir davranis (girdi zaten zararsiz).
    ...new Set(tags.map(sanitizeFreeText).filter((t) => t.length > 0)),
  ]);

const openAnswerField = z
  .string()
  .trim()
  .max(MAX_OPEN_ANSWER_LENGTH)
  .transform(sanitizeFreeText)
  .optional();

// FR-002c: uc kisa acik uclu cevap, her biri opsiyonel ve uzunluk sinirli.
const openAnswersSchema = z
  .object({
    enIyiOldugum: openAnswerField,
    gelistirmekIstedigim: openAnswerField,
    ikiYillikHedef: openAnswerField,
  })
  .strict();

export const createPreAssessmentSchema = z
  .object({
    // --- Zorunlu: meslek-bagimsiz coktan secmeli (FR-002) ---
    experienceYears: z.enum([
      'none',
      'lt1',
      'y1_3',
      'y3_5',
      'y5_10',
      'y10plus',
    ]),
    workStatus: z.enum([
      'employed_full',
      'employed_part',
      'seeking',
      'student',
    ]),
    workPreference: z.enum([
      'hands_on',
      'people',
      'detail_routine',
      'problem_solving',
      'planning',
    ]),
    teamPreference: z.enum([
      'alone',
      'small_team',
      'large_team',
      'leading',
      'no_preference',
    ]),
    problemApproach: z.enum([
      'self',
      'ask_experienced',
      'report_manager',
      'research',
      'team_discussion',
    ]),

    // --- Opsiyonel ---
    skills: skillsSchema.optional(),
    openAnswers: openAnswersSchema.optional(),
  })
  // .strict() DEGIL: istemci `experienceLevel` gonderirse hata vermek yerine
  // YOK SAYILIR (FR-002d - o alan turetilir, girdi degildir). Zod'un varsayilan
  // "strip" davranisi tam olarak bunu yapar.
  .transform((dto) => ({
    ...dto,
    // Bos dizi/bos nesne gonderilmisse hic gonderilmemis gibi davran: prompt'ta
    // ilgili satirin TAMAMEN atlanmasi gerekiyor (llm-contract.md §3).
    skills: dto.skills && dto.skills.length > 0 ? dto.skills : undefined,
    openAnswers: hasAnyAnswer(dto.openAnswers) ? dto.openAnswers : undefined,
  }));

function hasAnyAnswer(
  answers: z.infer<typeof openAnswersSchema> | undefined,
): boolean {
  if (!answers) return false;
  return Object.values(answers).some(
    (v) => typeof v === 'string' && v.length > 0,
  );
}

export type CreatePreAssessmentInput = z.infer<
  typeof createPreAssessmentSchema
>;
