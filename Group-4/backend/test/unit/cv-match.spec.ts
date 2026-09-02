import {
  CV_MATCH_TEMPERATURE,
  buildCvMatchSystemPrompt,
  cvMatchSchema,
} from '../../src/interview/llm/cv-match';
import { SCORE_BANDS } from '../../src/interview/llm/report';
import { cvMatchRequestSchema } from '../../src/interview/dto/cv-match.dto';

describe('Ilan x CV uyum analizi — sema ve prompt', () => {
  const valid = {
    matchedSkills: [{ skill: 'Kubernetes', evidence: '3 yil K8s operasyonu' }],
    missingSkills: [
      { skill: 'Terraform', required: true, suggestion: 'Temel modul yaz.' },
    ],
    band: 'yeterli' as const,
    matchScore: 60,
    focusAreas: ['Terraform'],
    summary: 'Zorunlu maddelerin cogunu karsiliyorsun.',
  };

  it('gecerli cikti kabul edilir', () => {
    expect(cvMatchSchema.parse(valid).matchScore).toBe(60);
  });

  it('0-100 disindaki skor reddedilir', () => {
    expect(cvMatchSchema.safeParse({ ...valid, matchScore: 140 }).success).toBe(
      false,
    );
  });

  it('tanimsiz bant reddedilir', () => {
    expect(cvMatchSchema.safeParse({ ...valid, band: 'harika' }).success).toBe(
      false,
    );
  });

  it('eslesme kaydi kanitsiz olamaz (evidence bos gecilemez)', () => {
    expect(
      cvMatchSchema.safeParse({
        ...valid,
        matchedSkills: [{ skill: 'Go', evidence: '' }],
      }).success,
    ).toBe(false);
  });

  // Bant araliklari TEK kaynaktan (SCORE_BANDS) gelmeli: prompt metni ile
  // dogrulama ayrisirsa model bandin disinda sayi verir ve kimse fark etmez.
  it('prompt metnindeki bant araliklari SCORE_BANDS ile ayni', () => {
    const prompt = buildCvMatchSystemPrompt('tr');
    for (const [band, range] of Object.entries(SCORE_BANDS)) {
      expect(prompt).toContain(`"${band}" (${range.min}-${range.max})`);
    }
  });

  it('dil talimati gorusme diline gore degisir', () => {
    expect(buildCvMatchSystemPrompt('tr')).toContain('Turkce');
    expect(buildCvMatchSystemPrompt('en')).toContain('Ingilizce');
  });

  // Olcum cagrisi: ayni ilan + ayni CV ayni sonucu vermeli (report.ts ile ayni gerekce).
  it('sicaklik 0 (tekrarlanabilir olcum)', () => {
    expect(CV_MATCH_TEMPERATURE).toBe(0);
  });
});

describe('cvMatchRequestSchema', () => {
  it('metin kaynaginda bos ilan reddedilir', () => {
    expect(
      cvMatchRequestSchema.safeParse({
        jobPostingSource: 'text',
        jobPostingText: '   ',
      }).success,
    ).toBe(false);
  });

  it('LinkedIn olmayan URL reddedilir (SSRF ilk halka)', () => {
    expect(
      cvMatchRequestSchema.safeParse({
        jobPostingSource: 'url',
        jobPostingUrl: 'https://ornek.com/ilan/1',
      }).success,
    ).toBe(false);
  });

  it('useStoredCv varsayilani true, "false" string\'i false olur', () => {
    const base = {
      jobPostingSource: 'text' as const,
      jobPostingText: 'Platform muhendisi araniyor.',
    };
    expect(cvMatchRequestSchema.parse(base).useStoredCv).toBe(true);
    expect(
      cvMatchRequestSchema.parse({ ...base, useStoredCv: 'false' }).useStoredCv,
    ).toBe(false);
  });
});
