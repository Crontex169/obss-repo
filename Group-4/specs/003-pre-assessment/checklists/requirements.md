# Spesifikasyon Kalite Kontrol Listesi: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Amaç**: Planlama aşamasına geçmeden önce spesifikasyonun eksiksizliğini ve kalitesini doğrulamak
**Oluşturulma**: 2026-07-30
**Özellik**: [spec.md](../spec.md)

## İçerik Kalitesi

- [x] Uygulama detayı içermiyor (dil, framework, API)
- [x] Kullanıcı değerine ve iş ihtiyacına odaklı
- [x] Teknik olmayan paydaşlar için yazılmış
- [x] Tüm zorunlu bölümler tamamlanmış

## Gereksinim Eksiksizliği

- [x] Hiç `[NEEDS CLARIFICATION]` işareti kalmamış — 2 işaret specify oturumunda çözüldü (bkz. Netleştirmeler / Oturum 2026-07-30)
- [x] Gereksinimler test edilebilir ve tek anlamlı
- [x] Başarı kriterleri ölçülebilir
- [x] Başarı kriterleri teknoloji-bağımsız
- [x] Tüm kabul senaryoları tanımlanmış
- [x] Sınır durumları belirlenmiş
- [x] Kapsam net biçimde sınırlandırılmış (Kapsam Notu bölümü)
- [x] Bağımlılıklar ve varsayımlar belirlenmiş

## Özellik Hazırlığı

- [x] Tüm fonksiyonel gereksinimlerin net kabul kriterleri var
- [x] Kullanıcı senaryoları birincil akışları kapsıyor
- [x] Özellik, Başarı Kriterleri'ndeki ölçülebilir sonuçları karşılıyor
- [x] Spesifikasyona uygulama detayı sızmamış

## Anayasa Uyumu (proje-özel)

- [x] İlke II — Gherkin kabul kriterleri mutlu yol / sınır / hata durumlarını kapsıyor
- [x] İlke V — sunucu tarafı yetki kontrolü ve prompt injection izolasyonu gereksinim olarak yazılmış (FR-003, FR-011, FR-012)
- [x] İlke VI — LLM girdi/çıktı sözleşmesi, şema doğrulaması, zarif hata davranışı ve token/maliyet kaydı gereksinim olarak yazılmış (FR-007, FR-008, FR-010)
- [x] İlke VII — AI şeffaflığı ve kullanıcı kontrolü gereksinim olarak yazılmış (FR-008, FR-014, FR-015)

## Notlar

- Tüm maddeler geçti; clarify oturumu (2026-07-30, 5 soru) tamamlandı. Spec `/speckit-plan` için hazır.
- **`/speckit-plan` öncesi açık bağımlılık — KAPANDI:** LLM sağlayıcı kararı **ADR-0007** (Groq birincil + DeepSeek yedek) ile alındı ve `docs/TECH_STACK.md` güncellendi. Spec teknoloji-bağımsız olduğu için bu spec'i zaten bloke etmiyordu.
- **Diğer dosyalara taşan güncellemeler — KAPANDI (2026-08-05):**
  1. ~~`docs/APP_FLOW.md` — "tek seferlik" ifadesi "tek aktif rapor + arşivlenen geçmiş" olmalı.~~ → yapıldı (`002` T113)
  2. ~~`docs/APP_FLOW.md` bölüm 3.1 — "yetkinlik skorları" ifadesinden skor çıkmalı.~~ → yapıldı; §3.1 artık skorsuz raporu ve güven seviyesini anlatıyor
  3. ~~`docs/PLAN.md` Fonksiyon Backlog — "yeniden değerlendirme + arşiv" satırı.~~ → FR-004/FR-009a spec'te tanımlı, backlog satırı gerekmedi
- **Diğer dilimlerle kesişen kararlar:** (1) `TokenUsage` cross-cutting'dir, Interview ve Admin dilimleri aynı varlığı kullanır — veri modeli buna göre tasarlandı; (2) LLM sözleşmesindeki `language` parametresi deseni bu dilimde kuruldu, Interview dilimi aynı deseni kullanır — **not:** dilin iş ilanı metninden otomatik algılanması **Bonus** kapsamındadır, uygulanan kural `Accept-Language` çözümlemesidir (`docs/API_CONVENTIONS.md` §4.2); (3) admin salt okunur erişimi `001-auth-rol` FR-010 ile tutarlıdır, `contracts/authz-rules.md`'ye istisna eklenmesi gerekmedi.
