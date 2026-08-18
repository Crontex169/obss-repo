// ATDD BACKLOG — henuz calistirilabilir testi OLMAYAN degerlendirme kriterleri
// -------------------------------------------------------------------------
// Kaynak: specs/degerlendirme-user-stories.md (PDF "Degerlendirme" tablosu)
// Anayasa Ilke III: kabul kriterleri kodDAN ONCE testlere donusur. Kod olmadigi
// icin bunlar `it.todo` — suite'i kirmizi yapmazlar ama her kosumda ekrana
// dusarlar, yani unutulmalari zorlasir.
//
// 2026-08-05 SENKRONIZASYONU: kriter 2,3,4,5,6,7,8,9,10 dilimleri implemente
// edildi ve her DS maddesinin gercek bir testi olustu. O it.todo'lar buradan
// KALDIRILDI — eslemeleri specs/degerlendirme-user-stories.md icindeki
// "Test durumu" isaretlerinde ve asagidaki tabloda tutuluyor.
//
//   kriter 2  (gorusme gecmisi)   -> history-delete, us3-soft-delete-visibility,
//                                    us3-resume, frontend/test/interview-list
//   kriter 3  (is ilani girisi)   -> us1-create-happy, us1-create-pdf,
//                                    us1-create-validation, us3-multiple-active
//   kriter 4  (soru uretimi/LLM)  -> us1-position, us1-language, us1-rate-limit,
//                                    us1-create-llm-failure, us1-question-count-mismatch,
//                                    us1-voice-open-ended, unit/prompt-isolation
//   kriter 5  (sirali akis)       -> us2-sequential-flow, us2-order-lock,
//                                    us2-answer-immutable, us2-mc-validation,
//                                    us2-completion, us3-resume(-unauthorized)
//   kriter 6  (rapor)             -> us5-report-happy/-cached/-failure/-retry/
//                                    -timeout/-unauthorized/-overall-score
//   kriter 7  (admin listeleme)   -> us-admin1-list-*, us-admin2-detail(-readonly)
//   kriter 8  (filtre+istatistik) -> us-admin1-list-filter, us-admin3-*
//   kriter 9  (adaptif akis)      -> us4-adaptive-*, us4-answered-question-frozen
//   kriter 10 (aday tanima)       -> pa-us1-*, pa-us2-*, pa-us3-*, pa-us4-*, pa-us5-*
//
// Geriye yalnizca gercekten olculmemis/uygulanmamis maddeler kaldi.

describe('ATDD backlog — kriter 12: Performans (%3)', () => {
  // DS-17-H1 (soru uretimi < 30 sn) ve DS-17-E1 (timeout kesme) kapsandi:
  // us1-create-happy ve us5-report-timeout / pa-us3-timeout.
  // Kalanlar istatistiksel dagilim olcumu gerektiriyor — tek kosumluk bir
  // entegrasyon testi yuzde-dilimi (p95) kanitlayamaz.
  it.todo(
    'DS-17-H2: rapor uretimi vakalarin >=%95 inde 60 sn altinda (SC-005) — yuk testi gerektirir, tek kosumla olculemez',
  );
  it.todo(
    'DS-17-K1: rapor tekrar goruntuleme (LLM siz yol) p95 < 300 ms — yuk testi gerektirir',
  );
});

describe('ATDD backlog — kriter 13: Bakim kolayligi (%5) [acik bulgular]', () => {
  // DS-07-E1 KAPANDI (2026-08-05): frontend/package.json artik `zod` u dogrudan
  // bagimlilik olarak listeliyor (^4.4.3).
  it.todo(
    'DS-07-E2: CI kapisi — lint + build + test yesil olmadan merge edilememeli (.github/workflows hala YOK)',
  );
  it.todo(
    'DS-07-K1: User semasindaki banned/banReason/banExpires ya kullanilmali ya kaldirilmali (kodda hala sifir referans — 001-auth-rol T081/T081b)',
  );
});
