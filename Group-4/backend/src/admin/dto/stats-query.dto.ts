// DOSYA REHBERİ: İstatistik ekranının tek parametresini (tokenWindowDays —
// istatistiklerin kaç günlük pencerede hesaplanacağı, 1-90 gün, varsayılan 30)
// Zod ile doğrulayan şema.
import { z } from 'zod';

// contracts/admin-api.md §3 — tokenWindowDays 1-90, varsayilan 30
// (Clarifications Q3: gunluk granularite, son 30 gunluk pencere).
const RANGE_MESSAGE = 'tokenWindowDays 1 ile 90 arasinda olmalidir.';

export const statsQuerySchema = z.object({
  tokenWindowDays: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce
      .number()
      .int()
      .min(1, RANGE_MESSAGE)
      .max(90, RANGE_MESSAGE)
      .default(30),
  ),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;
