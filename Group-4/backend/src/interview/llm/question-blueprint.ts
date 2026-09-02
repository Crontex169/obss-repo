// DOSYA REHBERİ: Mülakattaki N sorunun "planını" LLM'e sormadan, burada
// deterministik olarak kurar — hangi soru kaçıncı konuya ait, o konunun kaçıncı
// katmanı (tarama / uygulama / sınır) ve hangi tarzda sorulacak. LLM bu planı
// DEĞİŞTİREMEZ, yalnızca doldurur.

// NEDEN PLAN KODDA, LLM'DE DEGIL:
//
// "N soru uret, konulara dagit" talimati derinligi modelin keyfine birakir.
// Pratikte model N tane BIRBIRINDEN BAGIMSIZ tarama sorusu uretir: her konuya
// bir kez dokunur, hicbirini kazimaz. Boyle bir set adayin bir konuyu GERCEKTEN
// bilip bilmedigini olcemez — yalnizca terimi tanıyıp tanımadığını olcer.
//
// Plan kodda kurulunca iki sey garanti olur:
//   1) her konu icin en az bir DERINLESTIRME sorusu vardir (katman 2+),
//   2) ayni yetkinlik farkli TARZLARDA sorulur — bir konuyu bes kez "X nedir"
//      diye sormak, bes farkli tarzda sormaktan cok daha az sinyal uretir.
//
// Katman ile ADAPTIF uyarlama (adaptive.ts) KARISTIRILMAMALIDIR: katman, gorusme
// baslamadan sabitlenen PLANLI derinliktir; adaptif uyarlama ise adayin verdigi
// cevaba gore ayni katman icinde yapilan ayardir. Ikisi birlikte calisir.

/** Soru tarzlari — ayni yetkinligi farkli acilardan olcen bicimler. */
export const QUESTION_STYLES = [
  /** Kavram/tanim bilgisi: "X nedir, ne zaman kullanilir". */
  'bilgi',
  /** Gecmis deneyim (STAR): "daha once X yaptigin bir durumu anlat". */
  'deneyim',
  /** Kurgusal durum: "su durumda ne yapardin". */
  'senaryo',
  /** Odunlesim: "A mi B mi, neden". */
  'tradeoff',
  /** Bozuk bir durum verilir, teshis istenir. */
  'hata_ayiklama',
] as const;

export type QuestionStyle = (typeof QUESTION_STYLES)[number];

export type QuestionLayer = 1 | 2 | 3;

/** Katmanlar artan sirada — prompt metni ve testler bunun uzerinden gezer. */
export const LAYER_ORDER: readonly QuestionLayer[] = [1, 2, 3];

export type QuestionType = 'multiple_choice' | 'open_ended';

/** Insan diline cevrilmis katman tanimi — prompt metnine buradan girer. */
export const LAYER_NAMES: Record<QuestionLayer, string> = {
  1: 'tarama',
  2: 'uygulama',
  3: 'sinir',
};

export const LAYER_INTENT: Record<QuestionLayer, string> = {
  1: 'Adayin bu konuya hic dokunup dokunmadigini olc. Temel, giris seviyesinde.',
  2: 'Ayni konuyu bir kat asagi kaz: bilgiyi UYGULAMAYA dokme becerisini olc.',
  3: 'Konunun sinirini yokla: istisna, odunlesim, "ne zaman YAPILMAZ" tarafi.',
};

export const STYLE_INTENT: Record<QuestionStyle, string> = {
  bilgi:
    'Bir kavrami/araci/kurali dogru taniyip tanimadigini olc. Tanim veya "hangisi dogrudur" bicimi.',
  deneyim:
    'Adayin GECMISTE fiilen yaptigi bir isi anlatmasini iste ("... yaptigin bir durumu anlat"). Kurgusal senaryo DEGIL.',
  senaryo:
    'Isyerinde karsilasabilecegi somut bir durum kur ve "ne yapardin" diye sor. Durum, ilandaki isin gercek kosullarina benzemeli.',
  tradeoff:
    'Iki mesru secenek sun ve hangisini neden sectigini sor. Tek dogru cevabi olan bir soru KURMA — gerekce olculur.',
  hata_ayiklama:
    'Bozuk/yanlis giden somut bir durum tarif et ve sebebini ya da ilk kontrol edecegi seyi sor.',
};

// Katman -> o katmanda kullanilabilecek tarzlar. Sirali liste: konu indeksine
// gore dondurulur, boylece ardisik konular ayni tarzi tekrarlamaz.
const LAYER_STYLES: Record<QuestionLayer, readonly QuestionStyle[]> = {
  1: ['bilgi', 'deneyim'],
  2: ['senaryo', 'hata_ayiklama'],
  3: ['tradeoff'],
};

// Tarz -> soru bicimi. Bicim tarzin SONUCUDUR, ayri bir karar degil: "gecmiste
// yaptigin bir durumu anlat" coktan secmeli olamaz, "hangisi dogrudur" ise
// acik uclu sorulursa tarzin butun anlami kaybolur.
const STYLE_TYPE: Record<QuestionStyle, QuestionType> = {
  bilgi: 'multiple_choice',
  deneyim: 'open_ended',
  senaryo: 'open_ended',
  tradeoff: 'open_ended',
  hata_ayiklama: 'multiple_choice',
};

export interface QuestionSlot {
  /** Mulakattaki sira (1..N) — Question.order ile ayni. */
  order: number;
  /** Kacinci konu (0'dan baslar). Konunun ADI'ni LLM doldurur, plan yalnizca KAC konu oldugunu sabitler. */
  topicIndex: number;
  layer: QuestionLayer;
  style: QuestionStyle;
  type: QuestionType;
}

// Konu basina kac soru. 2 = genislik agirlikli (az soruda cok konuya dokun),
// 3 = derinlik agirlikli. Esik 8: bunun altinda konu basina 3 soru ayirmak
// toplam konu sayisini 2-3'e dusurur ve ilanin buyuk kismi hic olculmez.
const GROUP_SIZE_SMALL = 2;
const GROUP_SIZE_LARGE = 3;
const LARGE_SET_THRESHOLD = 8;

/**
 * N soruyu konu gruplarina boler ve her soruya katman + tarz + bicim atar.
 * Ayni konunun sorulari ARDISIKTIR ve katmani artarak gider (1, 2, 3) —
 * adayin bir konudaki tavanini gormek icin sirali derinlesme gerekir.
 *
 * Sozlu modda tum sorular acik uclu olur (FR-004); tarz ekseni degismez, yalnizca
 * bicim sabitlenir.
 */
export function buildQuestionBlueprint(
  questionCount: number,
  mode: 'written' | 'voice',
): QuestionSlot[] {
  const groupSize =
    questionCount > LARGE_SET_THRESHOLD ? GROUP_SIZE_LARGE : GROUP_SIZE_SMALL;

  return Array.from({ length: questionCount }, (_, index) => {
    const topicIndex = Math.floor(index / groupSize);
    const layer = ((index % groupSize) + 1) as QuestionLayer;
    // Ayni katmanin tarzi konudan konuya donuyor: iki farkli konunun 1. katmani
    // ust uste hep "bilgi" olursa set yine tek tarza sikisir.
    const styles = LAYER_STYLES[layer];
    const style = styles[topicIndex % styles.length];

    return {
      order: index + 1,
      topicIndex,
      layer,
      style,
      type: mode === 'voice' ? 'open_ended' : STYLE_TYPE[style],
    };
  });
}

/**
 * Plani LLM'in okuyacagi metne cevirir. Soru metinlerini ICERMEZ — plan sistem
 * talimatinin parcasidir ve yalnizca yapisal parametreler tasir (kullanici
 * verisi ASLA buraya girmez, 5).
 */
export function describeBlueprint(slots: readonly QuestionSlot[]): string {
  const topicCount = new Set(slots.map((s) => s.topicIndex)).size;

  return [
    `Toplam ${slots.length} soru, ${topicCount} ayri konu basligi altinda toplanacak.`,
    'Asagidaki plan KESINDIR: her satir icin tam olarak bir soru uret, sirayi bozma, satir ekleme/cikarma.',
    ...slots.map(
      (slot) =>
        `  ${slot.order}. soru -> konu #${slot.topicIndex + 1} | katman ${slot.layer} (${LAYER_NAMES[slot.layer]}) | tarz "${slot.style}" | bicim "${slot.type}"`,
    ),
  ].join('\n');
}
