import { toProviderSchema } from '../../src/llm/schema-to-provider';
import { competencyReportSchema } from '../../src/pre-assessment/llm/competency-report.schema';

// T016 + T085 + T091 — katman-2 dogrulama + katman-1 sema regresyon testi.
// contracts/llm-contract.md §4: `alanlar` KALDIRILDI (2026-08-04 meslek-bagimsizlik);
// skor/yolHaritasi hicbir katmanda YOK.
const validReport = {
  genelOzet: 'x'.repeat(60),
  gucluYonler: ['a', 'b'],
  gelisimAlanlari: ['c', 'd'],
  calismaTarziOzeti: 'y'.repeat(40),
  guvenSeviyesi: 'orta' as const,
};

describe('competencyReportSchema (US1)', () => {
  it('gecerli yanit kabul edilir', () => {
    expect(competencyReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('gucluYonler 2 maddeden az ise reddedilir', () => {
    const r = competencyReportSchema.safeParse({
      ...validReport,
      gucluYonler: ['tek'],
    });
    expect(r.success).toBe(false);
  });

  it('gelisimAlanlari 6 maddeden fazla ise reddedilir', () => {
    const r = competencyReportSchema.safeParse({
      ...validReport,
      gelisimAlanlari: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    });
    expect(r.success).toBe(false);
  });

  it('genelOzet 50 karakterden kisa ise reddedilir', () => {
    const r = competencyReportSchema.safeParse({
      ...validReport,
      genelOzet: 'kisa',
    });
    expect(r.success).toBe(false);
  });

  it('calismaTarziOzeti 30 karakterden kisa ise reddedilir', () => {
    const r = competencyReportSchema.safeParse({
      ...validReport,
      calismaTarziOzeti: 'kisa',
    });
    expect(r.success).toBe(false);
  });

  it('gecersiz guvenSeviyesi reddedilir', () => {
    const r = competencyReportSchema.safeParse({
      ...validReport,
      guvenSeviyesi: 'cok_yuksek',
    });
    expect(r.success).toBe(false);
  });

  describe('katman 1 — saglayici semasi (schema-to-provider uzerinden)', () => {
    const schema = toProviderSchema(competencyReportSchema);
    const asText = JSON.stringify(schema);

    it('kaldirilan alanlari ICERMEZ: alanlar / yolHaritasi (FR-002, FR-006)', () => {
      expect(asText).not.toContain('alanlar');
      expect(asText).not.toContain('yolHaritasi');
    });

    it('skor alanini ICERMEZ (FR-006b, SC-010)', () => {
      expect(asText.toLowerCase()).not.toContain('"skor"');
      expect(asText.toLowerCase()).not.toContain('score');
    });

    it('mesleklere/sektorlere ozgu enum ICERMEZ (SC-001a)', () => {
      for (const term of ['frontend', 'backend', 'ml']) {
        expect(asText).not.toContain(`"${term}"`);
      }
    });

    it('desteklenmeyen nicelik anahtar sozcuklerini icermez (minLength/minItems/maxItems)', () => {
      for (const keyword of [
        'minLength',
        'maxLength',
        'minItems',
        'maxItems',
      ]) {
        expect(asText).not.toContain(keyword);
      }
    });

    it('her nesnede additionalProperties: false vardir', () => {
      expect(asText).toContain('"additionalProperties":false');
    });

    it('tum zorunlu alanlar required listesinde', () => {
      expect(schema.required).toEqual(
        expect.arrayContaining([
          'genelOzet',
          'gucluYonler',
          'gelisimAlanlari',
          'calismaTarziOzeti',
          'guvenSeviyesi',
        ]),
      );
    });
  });
});
