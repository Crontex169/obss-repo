// DOSYA REHBERİ: Admin görüşme listesi ekranının filtre/sayfalama
// parametrelerini (?position=backend&page=2&pageSize=20) Zod ile doğrular.
// blankToUndefined küçük yardımcısı önemli bir detay: URL'den gelen her şey
// string'dir; boş string gelirse z.coerce.number() onu 0 yapardı, bu da
// yanlışlıkla "sayfa 0" gibi geçersiz bir isteği geçerli sanırdı. Bu yüzden
// önce boş string undefined'a çevrilir, sonra varsayılan devreye girer.
import { z } from 'zod';

/**
 *  Liste ekranının filtre/sayfalama kontrolü

Admin görüşme listesini açarken URL'e şöyle parametreler eklenebiliyor:  ?position=backend&page=2&pageSize=20 . Bu dosya bunları Zod ile doğruluyor:

 */

// contracts/admin-api.md §1 query parametreleri.
// pageSize varsayilani 20 (Clarifications Q4), ust siniri 100 (sozlesme) —
// research.md §5'teki "ust sinir 20" ifadesiyle celiskiliydi, sozlesme esas
// alindi (analiz bulgusu C1, 2026-08-04).
export const UNSPECIFIED_POSITION = 'unspecified';

// Query string degerleri daima string gelir. Bos string "verilmemis" sayilir;
// aksi halde z.coerce.number('') === 0 olur ve gecerli bir istek 400 alirdi.
const blankToUndefined = (v: unknown) =>
  v === '' || v === null ? undefined : v;

export const listInterviewsQuerySchema = z.object({
  position: z.preprocess(blankToUndefined, z.string().optional()),
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1, 'page en az 1 olmalidir.').default(1),
  ),
  pageSize: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1, 'pageSize 1 ile 100 arasinda olmalidir.')
      .max(100, 'pageSize 1 ile 100 arasinda olmalidir.')
      .default(20),
  ),
});

export type ListInterviewsQuery = z.infer<typeof listInterviewsQuerySchema>;
