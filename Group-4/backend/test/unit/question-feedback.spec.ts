import { buildTranscript, reportSchema } from '../../src/interview/llm/report';
import { toProviderSchema } from '../../src/llm/schema-to-provider';

// Issue #68 — soru bazli geri bildirim. Iki sey burada kirilirsa ozellik
// sessizce bos doner: (1) secenekler kayda girmezse model dogru secenegin TAM
// METNINI veremez, (2) sema saglayiciya cevrilirken bozulursa cagri 400 alir.
describe('#68 soru bazli geri bildirim', () => {
  describe('buildTranscript', () => {
    it('coktan secmeli sorunun secenekleri kayda yazilir', () => {
      const data = buildTranscript({
        position: null,
        pairs: [
          {
            order: 1,
            questionText: 'Iskele kurulumunda ilk kontrol nedir?',
            options: ['Baglanti elemanlari', 'Malzeme sayimi'],
            answerContent: 'Malzeme sayimi',
          },
        ],
      });

      expect(data).toContain('Secenekler 1:');
      expect(data).toContain('- Baglanti elemanlari');
      expect(data).toContain('- Malzeme sayimi');
    });

    it('acik uclu soruda secenek blogu HIC eklenmez', () => {
      const data = buildTranscript({
        position: null,
        pairs: [
          {
            order: 1,
            questionText: 'Ekip ici catismayi nasil yonetirsin?',
            options: [],
            answerContent: 'Once dinlerim.',
          },
        ],
      });

      expect(data).not.toContain('Secenekler');
      expect(data).toContain('Cevap 1: Once dinlerim.');
    });

    it('bos cevap "cevap verilmedi" olarak gider (verdict=yetersiz kurali buna dayanir)', () => {
      const data = buildTranscript({
        position: null,
        pairs: [
          { order: 3, questionText: 'S', options: [], answerContent: '   ' },
        ],
      });

      expect(data).toContain('Cevap 3: cevap verilmedi');
    });
  });

  describe('reportSchema', () => {
    const valid = {
      questionFeedback: [
        {
          order: 1,
          verdict: 'yetersiz',
          correctAnswer: 'Baglanti elemanlari',
          explanation: 'Kurulum oncesi guvenlik kontrolu once yapilir.',
        },
      ],
      overallImpression: 'Genel izlenim.',
      strengths: ['Net iletisim'],
      improvementAreas: ['Detay'],
      scores: { technical: 60, behavioral: 70, general: 65 },
      additionalNotes: null,
    };

    it('gecerli geri bildirim kabul edilir', () => {
      expect(reportSchema.safeParse(valid).success).toBe(true);
    });

    it('tanimsiz verdict degeri reddedilir', () => {
      const result = reportSchema.safeParse({
        ...valid,
        questionFeedback: [{ ...valid.questionFeedback[0], verdict: 'iyi' }],
      });
      expect(result.success).toBe(false);
    });

    it('bos correctAnswer reddedilir — bos kutu gostermektense rapor yeniden denenir', () => {
      const result = reportSchema.safeParse({
        ...valid,
        questionFeedback: [{ ...valid.questionFeedback[0], correctAnswer: '' }],
      });
      expect(result.success).toBe(false);
    });

    it('saglayici semasina cevrilebilir: verdict enum ve tum alanlar required', () => {
      const json = toProviderSchema(reportSchema);
      const feedback = (
        json.properties!.questionFeedback as {
          items: {
            required: string[];
            additionalProperties: boolean;
            properties: { verdict: { enum: string[] } };
          };
        }
      ).items;

      expect(feedback.required).toEqual([
        'order',
        'verdict',
        'correctAnswer',
        'explanation',
      ]);
      expect(feedback.additionalProperties).toBe(false);
      expect(feedback.properties.verdict.enum).toEqual([
        'dogru',
        'kismen',
        'yetersiz',
      ]);
    });
  });
});
