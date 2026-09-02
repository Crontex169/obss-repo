import {
  SCORE_BANDS,
  SCORE_BAND_NAMES,
  buildReportSystemPrompt,
  reportSchema,
  scoreMatchesBand,
  type ScoreBand,
} from '../../src/interview/llm/report';

// Puan rubrigi. Onceki tek yonerge "0-100 arasi tam sayi" idi: capasiz olcekte
// model neredeyse her adayi 70-85 araligina yigiyor, zayif ile guclu aday ayni
// yere dusuyordu. Artik once BANT secilir, sayi o bandin araliginda verilir.

const validReport = {
  questionFeedback: [
    {
      order: 1,
      verdict: 'kismen' as const,
      correctAnswer: 'Once guvenlik kontrolu',
      explanation: 'Kurulum oncesi kontrol sirasi onemlidir.',
    },
  ],
  overallImpression: 'Genel izlenim.',
  strengths: ['Net iletisim'],
  improvementAreas: ['Somut ornek'],
  calibration: {
    technical: { band: 'yeterli', evidenceOrders: [1] },
    behavioral: { band: 'guclu', evidenceOrders: [1] },
    general: { band: 'yeterli', evidenceOrders: [] },
  },
  scores: { technical: 60, behavioral: 70, general: 65 },
  additionalNotes: null,
};

describe('rapor puan rubrigi', () => {
  describe('bant araliklari', () => {
    it('bantlar bosluksuz ve ustusuz 0-100 tamamini kaplar', () => {
      const ranges = SCORE_BAND_NAMES.map((b) => SCORE_BANDS[b]);
      expect(ranges[0].min).toBe(0);
      expect(ranges[ranges.length - 1].max).toBe(100);
      for (let i = 1; i < ranges.length; i++) {
        // Bosluk olursa model o araliktaki bir sayiyi hicbir bantla
        // eslestiremez; ustusme olursa iki bant ayni sayiyi mesrulastirir.
        expect(ranges[i].min).toBe(ranges[i - 1].max + 1);
      }
    });

    it('scoreMatchesBand bant sinirlarini kapsayici degerlendirir', () => {
      for (const band of SCORE_BAND_NAMES) {
        const { min, max } = SCORE_BANDS[band];
        expect(scoreMatchesBand(band, min)).toBe(true);
        expect(scoreMatchesBand(band, max)).toBe(true);
      }
    });

    it('bant disi skor yakalanir — capalarin tek isi bu', () => {
      expect(scoreMatchesBand('zayif', 78)).toBe(false);
      expect(scoreMatchesBand('ustun', 40)).toBe(false);
    });
  });

  describe('sema', () => {
    it('gecerli rapor kabul edilir (dayanaksiz eksen bos dizi birakabilir)', () => {
      expect(reportSchema.safeParse(validReport).success).toBe(true);
    });

    it('calibration eksikse rapor REDDEDILIR — bant zorunlu ara adim', () => {
      const { calibration: _drop, ...withoutCalibration } = validReport;
      expect(reportSchema.safeParse(withoutCalibration).success).toBe(false);
    });

    it('tanimsiz bant adi reddedilir', () => {
      const result = reportSchema.safeParse({
        ...validReport,
        calibration: {
          ...validReport.calibration,
          technical: { band: 'harika', evidenceOrders: [1] },
        },
      });
      expect(result.success).toBe(false);
    });

    it('calibration, scores alanindan ONCE gelir (model soldan saga uretir)', () => {
      const keys = Object.keys(reportSchema.shape);
      expect(keys.indexOf('calibration')).toBeLessThan(keys.indexOf('scores'));
    });
  });

  describe('sistem talimati', () => {
    const prompt = buildReportSystemPrompt({
      level: 'junior',
      language: 'tr',
      hasPosition: true,
    });

    it('her bandin adi ve sayisal araligi talimatta gecer', () => {
      for (const band of SCORE_BAND_NAMES) {
        const { min, max } = SCORE_BANDS[band];
        expect(prompt).toContain(`"${band}" (${min}-${max})`);
      }
    });

    it('capalar SEVIYE-GORELI okunur — mutlak olcege kaymayi engelleyen cumle', () => {
      expect(prompt).toContain('junior');
      expect(prompt).toContain('BU SEVIYENIN');
    });

    it('degisken satirlar SONDA — sabit onek saglayici cache icine girer', () => {
      const other = buildReportSystemPrompt({
        level: 'senior',
        language: 'en',
        hasPosition: false,
      });

      // Iki farkli cagrinin ORTAK oneki, promptun buyuk kismi olmali.
      let shared = 0;
      while (
        shared < prompt.length &&
        shared < other.length &&
        prompt[shared] === other[shared]
      ) {
        shared++;
      }
      expect(shared / prompt.length).toBeGreaterThan(0.8);
    });
  });
});
