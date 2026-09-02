import {
  LAYER_ORDER,
  QUESTION_STYLES,
  buildQuestionBlueprint,
  describeBlueprint,
} from '../../src/interview/llm/question-blueprint';
import { buildQuestionGenerationSchema } from '../../src/interview/llm/question-generation';

// Katmanli soru plani. Onceki talimat "N soru uret, konulara dagit" idi ve
// derinligi tamamen modele birakiyordu: pratikte N tane bagimsiz TARAMA sorusu
// geliyordu, hicbir konu kazinmiyordu. Plan artik kodda kurulur ve sema onu
// dayatir.

const COUNTS = [1, 3, 5, 6, 8, 10, 20];

describe('soru plani (blueprint)', () => {
  describe('yapi', () => {
    it.each(COUNTS)('N=%i icin tam N slot, sira 1..N', (n) => {
      const slots = buildQuestionBlueprint(n, 'written');
      expect(slots).toHaveLength(n);
      expect(slots.map((s) => s.order)).toEqual(
        Array.from({ length: n }, (_, i) => i + 1),
      );
    });

    it.each(COUNTS)(
      'N=%i: ayni konunun sorulari ARDISIK ve katmani artan',
      (n) => {
        const slots = buildQuestionBlueprint(n, 'written');
        const seenTopics = new Set<number>();

        let previous = slots[0];
        seenTopics.add(previous.topicIndex);
        expect(previous.layer).toBe(1);

        for (const slot of slots.slice(1)) {
          if (slot.topicIndex === previous.topicIndex) {
            // Ayni konu devam ediyor: katman TAM BIR artmali. Atlama olursa
            // "uygulama" katmani hic sorulmadan "sinir" katmanina gecilir.
            expect(slot.layer).toBe(previous.layer + 1);
          } else {
            // Yeni konu: her zaman taramadan baslar ve DAHA ONCE kullanilmamis
            // olmali — konuya geri donulurse katmanli derinlesme kirilir.
            expect(slot.layer).toBe(1);
            expect(seenTopics.has(slot.topicIndex)).toBe(false);
            seenTopics.add(slot.topicIndex);
          }
          previous = slot;
        }
      },
    );

    it.each(COUNTS)('N=%i: katman 3ten derine inilmez', (n) => {
      const slots = buildQuestionBlueprint(n, 'written');
      for (const slot of slots) {
        expect(LAYER_ORDER).toContain(slot.layer);
      }
    });

    it('kucuk sette derinlik yerine GENISLIK secilir', () => {
      // N=6, konu basina 2 soru -> 3 konu. Konu basina 3 soru secilseydi
      // yalnizca 2 konu olur ve ilanin buyuk kismi hic olculmezdi.
      const topics = new Set(
        buildQuestionBlueprint(6, 'written').map((s) => s.topicIndex),
      );
      expect(topics.size).toBe(3);
    });

    it('buyuk sette derinlik acilir — 3. katman ancak burada cikar', () => {
      const layers = buildQuestionBlueprint(10, 'written').map((s) => s.layer);
      expect(layers).toContain(3);
      expect(
        buildQuestionBlueprint(6, 'written').map((s) => s.layer),
      ).not.toContain(3);
    });
  });

  describe('tarz ve bicim', () => {
    it('ardisik konularin ayni katmani ayni tarza sikismaz', () => {
      const slots = buildQuestionBlueprint(6, 'written');
      const layer1Styles = slots
        .filter((s) => s.layer === 1)
        .map((s) => s.style);
      expect(new Set(layer1Styles).size).toBeGreaterThan(1);
    });

    it('sozlu modda TUM sorular acik uclu (FR-004)', () => {
      const slots = buildQuestionBlueprint(10, 'voice');
      expect(slots.every((s) => s.type === 'open_ended')).toBe(true);
      // Tarz ekseni sozlu modda da calisir — yalnizca bicim sabitlenir.
      expect(new Set(slots.map((s) => s.style)).size).toBeGreaterThan(1);
    });

    it('yazili modda iki bicim de kullanilir', () => {
      const types = new Set(
        buildQuestionBlueprint(6, 'written').map((s) => s.type),
      );
      expect(types).toEqual(new Set(['multiple_choice', 'open_ended']));
    });

    it('tum tarzlar tanimli kumeden', () => {
      for (const slot of buildQuestionBlueprint(20, 'written')) {
        expect(QUESTION_STYLES).toContain(slot.style);
      }
    });
  });

  describe('plan metni', () => {
    it('her soru icin bir satir ve konu sayisi yazar', () => {
      const text = describeBlueprint(buildQuestionBlueprint(6, 'written'));
      expect(text).toContain('Toplam 6 soru, 3 ayri konu');
      for (let order = 1; order <= 6; order++) {
        expect(text).toContain(`${order}. soru ->`);
      }
    });
  });

  // Plan yalnizca prompt'ta tavsiye edilmez, semada DAYATILIR: model tum
  // alanlari gecerli doldurup yine de plani yok sayabilir.
  describe('sema plana uyumu denetler', () => {
    const conforming = (n: number, mode: 'written' | 'voice' = 'written') => ({
      rejection: null,
      position: 'Vardiya Sorumlusu',
      questions: buildQuestionBlueprint(n, mode).map((slot) => ({
        topic: `Konu ${slot.topicIndex + 1}`,
        layer: slot.layer,
        style: slot.style,
        type: slot.type,
        text: `Soru ${slot.order}`,
        options:
          slot.type === 'multiple_choice' ? ['Secenek A', 'Secenek B'] : [],
        tip: null,
        rationale: null,
      })),
    });

    it('plana uyan yanit kabul edilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      expect(schema.safeParse(conforming(6)).success).toBe(true);
    });

    it('katman degistirilirse reddedilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      // 2. soru planda katman 2; model onu tarama katmanina cekiyor.
      payload.questions[1].layer = 1;
      expect(schema.safeParse(payload).success).toBe(false);
    });

    it('tarz degistirilirse reddedilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      payload.questions[1].style = 'bilgi';
      expect(schema.safeParse(payload).success).toBe(false);
    });

    it('bir grubun icinde konu degisirse reddedilir — 2. katman baska konuya oturamaz', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      payload.questions[1].topic = 'Bambaska bir konu';
      expect(schema.safeParse(payload).success).toBe(false);
    });

    // 2026-08-28: gruplar arasi konu tekrari ARTIK REDDEDILMEZ.
    // Eskiden sema hatasiydi ve soru uretiminin en sik kirilma noktasiydi:
    // model "iletisim" ile "ekip ici iletisim"i iki ayri grup sanabiliyor,
    // TUM mulakat 502'ye dusuyor ve kullanici hicbir sey almadan saatlik
    // kotasindan bir hak kaybediyordu. Tekrar eden konu seti mulakati
    // GECERSIZ KILMAZ, yalnizca kapsamini daraltir — bu yuzden kural prompt'ta
    // kaldi ve ihlali InterviewService.create() uyari olarak logluyor.
    it('ayni konu iki gruba yayilirsa KABUL edilir (kapsam dar ama gecerli)', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      // 2. grubun her iki sorusu da 1. grubun konusunu tekrar ediyor.
      payload.questions[2].topic = 'Konu 1';
      payload.questions[3].topic = 'Konu 1';
      expect(schema.safeParse(payload).success).toBe(true);
    });

    // Gevsetme SADECE gruplar arasini kapsar: grup ICI butunluk hala zorunlu.
    // Ikisi karisirsa katmanli derinlesme sessizce kaybolur.
    it('gruplar arasi tekrar serbestlesse de grup ici konu degisimi hala reddedilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      payload.questions[2].topic = 'Konu 1'; // gruplar arasi tekrar: serbest
      payload.questions[3].topic = 'Konu 3'; // ama ayni grup icinde degisti
      expect(schema.safeParse(payload).success).toBe(false);
    });

    it('konu adinda buyuk/kucuk harf ve bosluk farki AYNI konu sayilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      const payload = conforming(6);
      payload.questions[1].topic = '  KONU 1  ';
      expect(schema.safeParse(payload).success).toBe(true);
    });

    it('ret durumunda plan denetimi calismaz (questions bos)', () => {
      const schema = buildQuestionGenerationSchema(6, 'written');
      expect(
        schema.safeParse({
          rejection: 'not_a_job_posting',
          questions: [],
          position: null,
        }).success,
      ).toBe(true);
    });

    it('sozlu modda plana uyan yanit kabul edilir', () => {
      const schema = buildQuestionGenerationSchema(6, 'voice');
      expect(schema.safeParse(conforming(6, 'voice')).success).toBe(true);
    });
  });
});
