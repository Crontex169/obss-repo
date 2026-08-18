// DOSYA REHBERİ: Adayın bir soruya verdiği cevabın gövdesini doğrulayan küçük
// Zod şeması — hangi sorunun cevaplandığını ve cevap metnini kontrol eder.
import { z } from 'zod';
// verildiyse (sourceMode) gorusmenin kendi modundan (Interview.mode) turer;
// bir gorusme icinde yazili/sozlu karisik olamaz.
export const submitAnswerSchema = z.object({
  questionOrder: z.coerce.number().int().positive(),
  // FR-027: süre dolumunda boş string geçerli olabilir.
  content: z.string(),
});

export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
