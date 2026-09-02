// DOSYA REHBERİ: "İlan × CV uyumu" isteğinin girdi şeması. Görüşme
// oluşturmayla AYNI iş ilanı kaynak kurallarını (metin/PDF/LinkedIn URL)
// paylaşır; soru sayısı/mod/seviye gibi mülakata özgü alanları YOKTUR —
// bu uç görüşme başlatmaz.
import { z } from 'zod';
import { JOB_ID } from '../linkedin-job';

export const cvMatchRequestSchema = z
  .object({
    jobPostingSource: z.enum(['text', 'pdf', 'url']),
    jobPostingText: z.string().optional(),
    jobPostingUrl: z.string().optional(),
    // Ayarlar'daki kayitli CV kullanilsin mi. Istekte cvFile de varsa
    // yuklenen dosya kazanir (create ile ayni oncelik kurali).
    useStoredCv: z
      .preprocess(
        (v) => (v === 'true' ? true : v === 'false' ? false : v),
        z.boolean(),
      )
      .default(true),
  })
  .superRefine((data, ctx) => {
    if (
      data.jobPostingSource === 'text' &&
      (!data.jobPostingText || data.jobPostingText.trim().length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['jobPostingText'],
        message: 'Is ilani metni bos olamaz.',
      });
    }
    // SSRF savunmasinin ilk halkasi create ile AYNI regex (linkedin-job.ts).
    if (
      data.jobPostingSource === 'url' &&
      (!data.jobPostingUrl || !JOB_ID.test(data.jobPostingUrl))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['jobPostingUrl'],
        message: "Gecerli bir LinkedIn is ilani URL'si degil.",
      });
    }
  });

export type CvMatchRequestInput = z.infer<typeof cvMatchRequestSchema>;
