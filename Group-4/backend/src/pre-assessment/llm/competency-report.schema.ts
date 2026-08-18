// DOSYA REHBERİ: LLM'in ürettiği yetkinlik raporunun (genel özet, güçlü
// yönler, gelişim alanları vb.) uyması gereken katı Zod şeması. LLM
// fazladan/beklenmeyen bir alan üretirse bu şema onu reddeder, sessizce
// yutmaz.
import { z } from 'zod';
//
// 2026-08-04 kapsam karari: `alanlar` (ilgi alani basina degerlendirme) alani
// KALDIRILDI. Girdi meslek-bagimsiz hale geldigi icin raporu meslege/sektore gore
// bolumlemek anlamini yitirdi (FR-002, FR-006). Sema artik CAGRI BAZINDA
// degismedigi icin bir fabrika fonksiyonuna da gerek yok - sabit export yeterli
// (eski surumde `interestAreas` kumesini superRefine ile dogrulamak gerekiyordu).
//
// .strict() KASITLI: saglayici fazladan bir "skor"/"puan"/"alanlar" alani
// uretirse (DeepSeek yolunda saglayici garantisi yok) katman 2 bunu REDDEDER
// (FR-006b, SC-010) — z.object()'in varsayilan "strip" davranisi sessizce
// gormezden gelirdi.
export const competencyReportSchema = z
  .object({
    genelOzet: z
      .string()
      .min(50)
      .describe('Raporun genel ozeti. En az birkac cumle.'),
    gucluYonler: z
      .array(z.string().min(1))
      .min(2)
      .max(6)
      .describe(
        'Adayin one cikan yonleri, 2-6 kisa madde. Meslege ozgu terim kullanma.',
      ),
    gelisimAlanlari: z
      .array(z.string().min(1))
      .min(2)
      .max(6)
      .describe('Adayin gelistirebilecegi yonler, 2-6 kisa madde.'),
    calismaTarziOzeti: z
      .string()
      .min(30)
      .describe(
        'Adayin nasil bir ortamda verimli oldugu, nasil ogrendigi ve sorunlara nasil yaklastigi.',
      ),
    guvenSeviyesi: z.enum(['dusuk', 'orta', 'yuksek']),
  })
  .strict();

export type CompetencyReportResult = z.infer<typeof competencyReportSchema>;
