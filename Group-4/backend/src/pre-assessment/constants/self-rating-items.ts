// DOSYA REHBERİ: Ön değerlendirmede sorulan 8 kişilik/çalışma tarzı sorusunun
// (dikkat, öğrenme hızı, iletişim vb.) sabit listesi. Meslekten bağımsız
// olacak şekilde seçilmiş; "kurallara uyarım" gibi herkesin en yüksek puanı
// vereceği maddeler bilerek dışarıda bırakılmış.
// FR-002a — meslek-bagimsiz oz-degerlendirme olcegi (1-5).
//
// Madde secimi KASITLI: her biri inşaat iscisinden yazilimciya, temizlik
// gorevlisinden saglik calisanina kadar HER meslek grubu icin anlamli olmalidir.
// "Kurallara uyarim" gibi maddeler DAHIL EDILMEDI - sosyal begenilirlik yanliligi
// nedeniyle herkes en yuksek puani verir, ayirt edicilik tasimaz (spec FR-002a).
export const SELF_RATING_ITEMS = [
  'dikkat_titizlik',
  'ogrenme_hizi',
  'iletisim',
  'fiziksel_dayaniklilik',
  'zaman_yonetimi',
  'baski_altinda',
  'sorumluluk',
  'ekip_uyumu',
] as const;

export type SelfRatingItem = (typeof SELF_RATING_ITEMS)[number];

/** Prompt'ta insana okunur baglam icin (LLM'e madde adlariyla birlikte gider). */
export const SELF_RATING_LABELS: Record<SelfRatingItem, string> = {
  dikkat_titizlik: 'Dikkat ve titizlik',
  ogrenme_hizi: 'Yeni bir seyi ogrenme hizi',
  iletisim: 'Insanlarla iletisim',
  fiziksel_dayaniklilik: 'Fiziksel dayaniklilik',
  zaman_yonetimi: 'Zamani planlama ve isi yetistirme',
  baski_altinda: 'Baski altinda sakin kalma',
  sorumluluk: 'Sorumluluk alma / inisiyatif',
  ekip_uyumu: 'Ekip icinde uyum',
};
