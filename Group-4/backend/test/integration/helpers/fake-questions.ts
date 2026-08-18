// US1 testleri icin gecerli soru-uretimi yaniti uretici (contracts §4.1 sekliyle).
export function fakeQuestions(
  n: number,
  opts: { mode?: 'written' | 'voice'; position?: string | null } = {},
) {
  const mode = opts.mode ?? 'written';
  return {
    rejection: null as string | null,
    // ?? kullanilmaz: explicit null ("cikarilamadi") ile "belirtilmedi" (varsayilan
    // uygulansin) ayni sey degildir; ?? ikisini de ayirt edemez.
    position: 'position' in opts ? opts.position! : 'Backend Gelistirici',
    questions: Array.from({ length: n }, (_, i) => {
      const useChoice = mode === 'written' && i % 2 === 1;
      // FR-031 (Ipucu & Rehberlik paneli): sema alanlari zorunlu, deger null
      // olabilir — bu fake varsayilan olarak uretmiyor (mevcut testler bunu
      // varsaymiyor); dolduran deger gereken testler kendi payload'unu kurar.
      return useChoice
        ? {
            type: 'multiple_choice' as const,
            text: `Soru ${i + 1}: hangisi dogrudur?`,
            options: ['Secenek A', 'Secenek B'],
            tip: null as string | null,
            rationale: null as string | null,
          }
        : {
            type: 'open_ended' as const,
            text: `Soru ${i + 1}: deneyiminizi anlatin.`,
            options: [],
            tip: null as string | null,
            rationale: null as string | null,
          };
    }),
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
