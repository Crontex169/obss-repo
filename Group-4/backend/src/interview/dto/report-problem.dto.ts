// DOSYA REHBERİ: "Bildir" aksiyonunun gövdesi — kullanıcının yazdığı serbest
// metin şikayet/sorun açıklaması. Bos veya asiri uzun metin reddedilir.
import { z } from 'zod';

export const reportProblemSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export type ReportProblemInput = z.infer<typeof reportProblemSchema>;
