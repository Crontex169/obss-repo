import { buildCompetencyReportUserData } from '../../src/pre-assessment/llm/competency-report.prompt';
import { wrapPreAssessmentContextAsData } from '../../src/interview/llm/question-generation';

// 008 (#69) — learningStyle / selfRatings / educationLevel artik opsiyonel.
//
// KURAL (K2): alan yoksa prompt satiri HIC YAZILMAZ. Bos string, null veya
// varsayilan deger uydurulmaz - modele "bu bilgi yok" demek yerine yanlis bilgi
// vermek raporu bozar.
//
// Bu dosya IKI ayri dilimi birden kilitler: alanlar hem 003 yetkinlik raporu
// hem de 002 soru uretimi promptunu besliyor. Ilk denemede (dangling 66b8c90)
// yalnizca frontend degistigi icin bu iki nokta kacmisti.
describe('008 — opsiyonel prompt alanlari', () => {
  describe('yetkinlik raporu promptu (003)', () => {
    const base = {
      experienceYears: 'y1_3',
      workStatus: 'seeking',
      workPreference: 'hands_on',
      teamPreference: 'small_team',
      problemApproach: 'ask_experienced',
      language: 'tr' as const,
    };

    it('alanlar yoksa satirlar HIC yazilmaz (yeni kayit)', () => {
      const data = buildCompetencyReportUserData(base);

      expect(data).not.toContain('ogrenme_tarzi');
      expect(data).not.toContain('oz_degerlendirme');
      expect(data).not.toContain('egitim_durumu');
      // "null" / "undefined" sizmasi da olmamali.
      expect(data).not.toContain('null');
      expect(data).not.toContain('undefined');
    });

    it('zorunlu alanlar yine yazilir (eksik alan digerlerini dusurmez)', () => {
      const data = buildCompetencyReportUserData(base);

      expect(data).toContain('verimlilik_tarzi');
      expect(data).toContain('ekip_tercihi');
      expect(data).toContain('sorun_yaklasimi');
    });

    it('alanlar varsa eskisi gibi yazilir (sadelestirme oncesi kayit)', () => {
      const data = buildCompetencyReportUserData({
        ...base,
        learningStyle: 'shown',
        educationLevel: 'vocational',
        selfRatings: {
          dikkat_titizlik: 4,
          ogrenme_hizi: 5,
          iletisim: 3,
          fiziksel_dayaniklilik: 4,
          zaman_yonetimi: 3,
          baski_altinda: 4,
          sorumluluk: 5,
          ekip_uyumu: 4,
        },
      });

      expect(data).toContain('ogrenme_tarzi');
      expect(data).toContain('egitim_durumu');
      expect(data).toContain('oz_degerlendirme');
      expect(data).toContain('dikkat_titizlik');
    });
  });

  describe('soru uretimi baglami (002)', () => {
    const base = {
      genelOzet: 'Ozet metni.',
      gucluYonler: ['Dikkatli calisma'],
      gelisimAlanlari: ['Zaman planlama'],
      calismaTarziOzeti: 'Kucuk ekiplerde verimli.',
      guvenSeviyesi: 'orta',
      skills: [],
    };

    it('selfRatings yoksa oz_degerlendirme satiri HIC yazilmaz', () => {
      const data = wrapPreAssessmentContextAsData(base);

      expect(data).not.toContain('oz_degerlendirme');
      expect(data).not.toContain('undefined');
      // Baglam bloğunun geri kalani bozulmamali.
      expect(data).toContain('genel_ozet');
      expect(data).toContain('guven_seviyesi');
    });

    it('selfRatings varsa satir yazilir (eski kayit)', () => {
      const data = wrapPreAssessmentContextAsData({
        ...base,
        selfRatings: { dikkat_titizlik: 4, iletisim: 3 },
      });

      expect(data).toContain('oz_degerlendirme');
      expect(data).toContain('dikkat_titizlik');
    });
  });
});
