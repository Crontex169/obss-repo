import { competencyReportSchema } from '../../src/pre-assessment/llm/competency-report.schema';

// T017 — fazladan alan reddi (FR-006b, SC-010, FR-006).
// .strict() KASITLI (bkz. competency-report.schema.ts yorumu): DeepSeek yolunda
// saglayici garantisi olmadigi icin bu TEK gercek koruma katmanidir.
describe('competencyReportSchema — fazladan alan reddi', () => {
  const validPayload = {
    genelOzet: 'x'.repeat(60),
    gucluYonler: ['a', 'b'],
    gelisimAlanlari: ['c', 'd'],
    calismaTarziOzeti: 'y'.repeat(40),
    guvenSeviyesi: 'orta' as const,
  };

  it.each(['skor', 'puan', 'score', 'yolHaritasi', 'alanlar'])(
    'fazladan "%s" alani icerirse dogrulama BASARISIZ olur',
    (field) => {
      const result = competencyReportSchema.safeParse({
        ...validPayload,
        [field]: field === 'skor' || field === 'puan' ? 87 : ['x'],
      });
      expect(result.success).toBe(false);
    },
  );

  it('fazladan alan OLMADAN gecerli yanit kabul edilir (kontrol grubu)', () => {
    expect(competencyReportSchema.safeParse(validPayload).success).toBe(true);
  });
});
