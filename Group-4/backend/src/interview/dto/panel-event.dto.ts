// DOSYA REHBERİ: Adayın "ipucu" veya "gerekçe" sekmesini açtığını kaydeden
// istek gövdesinin şeması — sadece istatistik/telemetri amaçlı, LLM çağırmaz.
import { z } from 'zod';
// (FR-034, issue #48). Salt telemetri: LLM cagrisi yapmaz, DB'ye yazmaz —
// sadece yapilandirilmis log satiri.
export const panelEventSchema = z.object({
  questionOrder: z.coerce.number().int().positive(),
  tab: z.enum(['hint', 'rationale']),
});

export type PanelEventInput = z.infer<typeof panelEventSchema>;
