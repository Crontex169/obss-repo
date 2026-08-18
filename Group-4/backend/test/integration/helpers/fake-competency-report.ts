// pa-* testleri icin gecerli yetkinlik raporu yaniti uretici
// (contracts/llm-contract.md §4 sekliyle — skor, yolHaritasi ve meslege gore
// bolumleme YOK; 2026-08-04 meslek-bagimsizlik karari).
export function fakeCompetencyReport() {
  return {
    genelOzet:
      'Bu ozet en az elli karakter uzunlugunda olacak sekilde yazilmistir, testin gecmesi icin yeterli uzunluktadir.',
    gucluYonler: ['Dikkatli calisma', 'Ekip icinde uyum'],
    gelisimAlanlari: ['Zaman planlama', 'Baski altinda sakin kalma'],
    calismaTarziOzeti:
      'Gostererek ogrenmeyi tercih eden, kucuk ekiplerde verimli calisan bir aday.',
    guvenSeviyesi: 'orta' as const,
  };
}

/**
 * Gecerli, minimum zorunlu alanlardan olusan istek govdesi (FR-002).
 *
 * 008: learningStyle / selfRatings / educationLevel formdan kaldirildi, artik
 * istekte YOK. Sema .strict() olmadigi icin gonderilse de yok sayilir - bunu
 * pa-us1-trim.spec.ts dogruluyor.
 */
export function validCreateBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    experienceYears: 'y1_3',
    workStatus: 'seeking',
    workPreference: 'hands_on',
    teamPreference: 'small_team',
    problemApproach: 'ask_experienced',
    ...overrides,
  };
}
