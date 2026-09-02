// DOSYA REHBERİ: Yeni bir görüşme başlatırken gönderilen verinin (iş ilanı
// metni/PDF, soru sayısı, mod) doğru formatta olup olmadığını kontrol eden
// Zod şeması — hatalıysa istek daha servise ulaşmadan reddedilir.
import { z } from 'zod';
import { JOB_ID } from '../linkedin-job';

// contracts/interview-api.md §1. multipart/form-data (PDF) VE application/json
// (metin) ikisini de destekler; multipart alanlari hep string gelir, bu yuzden
// questionCount/adaptiveEnabled coerce edilir.
export const createInterviewSchema = z
  .object({
    jobPostingSource: z.enum(['text', 'pdf', 'url']),
    jobPostingText: z.string().optional(),
    jobPostingUrl: z.string().optional(),
    questionCount: z.coerce.number().int().min(5).max(20),
    mode: z.enum(['written', 'voice']),
    level: z.enum(['intern', 'junior', 'mid', 'senior']),
    // z.coerce.boolean() KULLANILMAZ: Boolean("false") === true'dur. Istemci
    // multipart gonderdiginde (frontend'in TEK yolu) alan "false" STRING'i
    // olarak gelir ve coerce onu true'ya cevirirdi — yani adaptif akis
    // kapatilamaz, her cevapta ek LLM cagrisi yapilirdi. Testler bunu
    // gormuyordu: JSON govdeyle gercek boolean gonderiyorlar.
    adaptiveEnabled: z
      .preprocess(
        (v) => (v === 'true' ? true : v === 'false' ? false : v),
        z.boolean(),
      )
      .default(false),
    // Ayarlar'da kayitli CV bu gorusmede baglam olarak kullanilsin mi?
    // Varsayilan true: kullanici CV'sini kaydettiyse amaci zaten kullanilmasi.
    // Alan bu istekte CV dosyasi da yuklendiyse ETKISIZDIR — yuklenen dosya
    // her zaman kayitli CV'yi ezer (bkz. interview.service.ts create()).
    // adaptiveEnabled ile ayni preprocess: multipart'ta "false" STRING gelir.
    useStoredCv: z
      .preprocess(
        (v) => (v === 'true' ? true : v === 'false' ? false : v),
        z.boolean(),
      )
      .default(true),
  })
  .superRefine((data, ctx) => {
    if (data.jobPostingSource === 'text') {
      if (!data.jobPostingText || data.jobPostingText.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['jobPostingText'],
          message: 'Is ilani metni bos olamaz.',
        });
      }
    }

    // 009-linkedin-ilan-cekme: bicim kontrolu BURADA yapilir — uymayan bir
    // baglanti ag istegine hic donusmez (SSRF savunmasinin ilk halkasi,
    // specs/009 §1). Regex tek yerde tanimlidir (linkedin-job.ts).
    if (data.jobPostingSource === 'url') {
      if (!data.jobPostingUrl || !JOB_ID.test(data.jobPostingUrl)) {
        ctx.addIssue({
          code: 'custom',
          path: ['jobPostingUrl'],
          message: "Gecerli bir LinkedIn is ilani URL'si degil.",
        });
      }
    }
  });

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
