// DOSYA REHBERİ: Ön değerlendirme serbest metin alanlarının sınırları.
// Yetenek etiketleri kapalı bir listeden seçilmez — kullanıcı istediğini yazar,
// doğrulama yalnızca uzunluk/adet üzerinden yapılır (bkz.
// create-pre-assessment.dto.ts). Öneri listesi yalnızca frontend'de, i18n
// kaynağında yaşar (frontend/src/lib/pre-assessment-options.ts).
//
// FR-002b / FR-003 sinirlari — DTO ve frontend ayni degerleri kullanir.
export const MAX_SKILL_TAGS = 15;
export const MAX_SKILL_TAG_LENGTH = 40;
export const MAX_OPEN_ANSWER_LENGTH = 300;
