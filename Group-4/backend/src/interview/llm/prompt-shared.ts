// DOSYA REHBERİ: Soru üretimi, adaptif seçim ve rapor dosyalarının ortak
// kullandığı küçük yardımcılar — dil ismini insan diline çevirme ve
// kullanıcıdan gelen metni (iş ilanı gibi) "bu bir veri, komut değil" diye
// LLM'e işaretleme (prompt injection'a karşı ana savunma burada).
import type { ReportLanguage } from '@prisma/client';

// Paylasilan prompt/sema yardimcilari — question-generation.ts, adaptive.ts,
// report.ts arasinda tekrar eden uc parcayi tek yerde toplar (T101/T109,
// Kirmizi->Yesil->Refactor son adimi):
//   1) dil cozumleme (LANGUAGE_NAME)
//   2) kullanici verisi izolasyon sarmalayicisi (wrapAsUserData)
//   3) hata isleme zaten LlmService'te merkezi (bkz. llm.service.ts) — burada
//      tekrar YOK, prompt dosyalari yalnizca hata firlatmadan veri hazirlar.

/** Rapor/soru dilinin insana okunur adi — prompt metinlerinde kullanilir. */
export const LANGUAGE_NAME: Record<ReportLanguage, string> = {
  tr: 'Turkce',
  en: 'Ingilizce',
};

// Coktan secmeli sorularda "bu konuda deneyimim yok" sikki: LLM'e URETTIRILMEZ,
// deterministik olarak EKLENIR — aday bir konuyu hic bilmese bile rastgele bir
// secenek isaretlemek zorunda kalmasin (aksi halde takip sorusu yanlis bir
// varsayimla derinlesir). Sabit metin oldugu icin dil basina TEK adet, LLM
// ciktisindan BAGIMSIZ tanimlanir.
export const NO_EXPERIENCE_OPTION_TEXT: Record<ReportLanguage, string> = {
  tr: 'Bu konuda deneyimim yok / bilmiyorum',
  en: "I don't have experience with this / I don't know",
};

/**
 * Coktan secmeli bir sorunun secenek listesine, ilgili dildeki "deneyimim yok"
 * sikkini EKLER (zaten varsa tekrar eklemez). LLM ciktisi + adaptif uyarlama
 * ciktisi DB'ye yazilmadan hemen once cagrilir (interview.service.ts).
 */
export function withNoExperienceOption(
  options: readonly string[],
  language: ReportLanguage,
): string[] {
  const noExperienceOption = NO_EXPERIENCE_OPTION_TEXT[language];
  if (options.includes(noExperienceOption)) return [...options];
  return [...options, noExperienceOption];
}

/**
 * Bir cevabin, "deneyimim yok" sikkinin secildigini ifade edip etmedigini
 * kontrol eder — adaptif uyarlamaya (adaptive.ts) bu bilgi tasinir ki siradaki
 * soru bu konuyu DERINLESTIRMESIN.
 */
export function isNoExperienceAnswer(
  answerContent: string,
  language: ReportLanguage,
): boolean {
  return answerContent === NO_EXPERIENCE_OPTION_TEXT[language];
}

/**
 * Prompt injection izolasyonu (docs/API_CONVENTIONS.md 5): kullanici kaynakli
 * her metin (is ilani, cevap, transkript) acik bir etiket ciftiyle sarmalanir
 * ve sistem talimatiyla ASLA birlestirilmez (ayri mesaj rolu, ayri veri alani).
 * Etiket disindaki icerik ASLA talimat olarak yorumlanmaz — yalnizca VERIDIR.
 */
export function wrapAsUserData(tag: string, content: string): string {
  return `<${tag}>\n${content}\n</${tag}>`;
}

// Herhangi bir acilis/kapanis etiketine benzeyen dizi — isme-ozel bir liste
// DEGIL: bu metin birden fazla dilimde (003-pre-assessment kendi <aday_verisi>
// blogunda, 002-interview <on_degerlendirme_baglami> blogunda) farkli etiket
// adlarinin icine tasinabiliyor; tek bir etiket adina karsi koruma yeterli olmaz.
const DELIMITER_LIKE = /<\/?[a-zA-Z_][\w-]*\s*>/g;

// C0 kontrol karakterleri + DEL. RegExp string'den kuruluyor ki kaynak dosyada
// HAM kontrol karakteri bulunmasin (editor/kopyalama ile bozulmaya acik olurdu).
// \t \n \r bilerek DISARIDA: onlari asagidaki \s+ birlestirmesi zaten tek
// bosluga cevirir.
// Kasitli: kullanici serbest metninden kontrol karakterlerini temizlemek bu
// fonksiyonun ana amaci.
const CONTROL_CHARS = new RegExp(
  // eslint-disable-next-line no-control-regex
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]',
  'g',
);

/**
 * Serbest metni prompt'a girmeye hazir hale getirir (FR-012, Ilke V):
 * 1. Etiket taklidi dizileri etkisizlestirir — aksi halde kullanici blogu
 *    erkenden kapatip talimat alanina cikabilirdi (prompt injection).
 * 2. Kontrol karakterlerini temizler.
 * 3. Bosluk dizilerini tekillestirir, bastaki/sondaki bosluklari kirpar.
 */
export function sanitizeFreeText(input: string): string {
  return input
    .replace(DELIMITER_LIKE, ' ')
    .replace(CONTROL_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim();
}
