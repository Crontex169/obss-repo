import { buildQuestionBlueprint } from '../../../src/interview/llm/question-blueprint';

// US1 testleri icin gecerli soru-uretimi yaniti uretici (contracts §4.1 sekliyle).
//
// Sorular artik KATMANLI bir plana uymak zorunda (question-blueprint.ts): tip,
// katman, tarz ve konu gruplari sema tarafindan denetlenir. Bu yuzden fake
// yanit da plani ELDE KURMAZ, uretim kodundaki AYNI fonksiyondan okur — aksi
// halde plan kurallari degistiginde onlarca test fixture'i sessizce gecersizlesir
// ve hepsi tek tek elle guncellenmek zorunda kalir.
export function fakeQuestions(
  n: number,
  opts: { mode?: 'written' | 'voice'; position?: string | null } = {},
) {
  const mode = opts.mode ?? 'written';
  const blueprint = buildQuestionBlueprint(n, mode);

  return {
    rejection: null as string | null,
    // ?? kullanilmaz: explicit null ("cikarilamadi") ile "belirtilmedi" (varsayilan
    // uygulansin) ayni sey degildir; ?? ikisini de ayirt edemez.
    position: 'position' in opts ? opts.position! : 'Backend Gelistirici',
    questions: blueprint.map((slot) => ({
      // Ayni gruptaki tum sorular AYNI konu metnini tasir; farkli gruplar farkli
      // konu alir — sema tam olarak bunu dogrular.
      topic: `Konu ${slot.topicIndex + 1}`,
      layer: slot.layer,
      style: slot.style,
      type: slot.type,
      text:
        slot.type === 'multiple_choice'
          ? `Soru ${slot.order}: hangisi dogrudur?`
          : `Soru ${slot.order}: deneyiminizi anlatin.`,
      options:
        slot.type === 'multiple_choice' ? ['Secenek A', 'Secenek B'] : [],
      // FR-031 (Ipucu & Rehberlik paneli): sema alanlari zorunlu, deger null
      // olabilir — bu fake varsayilan olarak uretmiyor (mevcut testler bunu
      // varsaymiyor); dolduran deger gereken testler kendi payload'unu kurar.
      tip: null as string | null,
      rationale: null as string | null,
    })),
  };
}

// FR-028 ret senaryosu: rejection dolu, questions bos, position null.
export function fakeRejection() {
  return {
    rejection: 'not_a_job_posting' as const,
    questions: [] as unknown[],
    position: null as string | null,
  };
}
