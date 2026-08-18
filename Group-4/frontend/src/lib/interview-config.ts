// FR-027: sure bilgilendiricidir, sunucuda ZORLANMAZ — tek kaynak burasi.
export const QUESTION_TIME_LIMIT_SECONDS = 90;

// FR-039: sozlu modda "konusmayi bitirdi" karari. Dusuk deger cumle arasi
// dusunme molasini cevabin sonu sanip kaydi erken keser; yuksek deger akisi
// bekletir. Dogal duraklamalarin ustunde, sabirsizlandirmayacak kadar kisa.
//
// DIKKAT: bu sayac ancak GERCEK KONUSMA duyulduktan sonra kurulur. Dinleme
// baslar baslamaz kurulursa, aday soruyu duyup dusunurken dolar ve kayit daha
// ilk kelime soylenmeden kapanir. Aday hic konusmazsa kaydi soru suresi
// (QUESTION_TIME_LIMIT_SECONDS) zaten sonlandirir.
export const VOICE_SILENCE_TIMEOUT_MS = 3500;

// Asistanin sesi bitince mikrofonu ACMADAN once beklenen sure. Chrome'da
// sentez bittiginde ses cihazi bir an daha mesgul olabiliyor; ayni tick'te
// baslatilan tanima ilk kelimeleri kaciriyor.
export const VOICE_MIC_WARMUP_MS = 350;
