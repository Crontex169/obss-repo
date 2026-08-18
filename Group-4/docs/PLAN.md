# Mock Interview Uygulaması — Çalışma Planı

> Bu doküman, uygulamanın geliştirme sürecini fazlara bölen çalışma planıdır.
>
> **Durum (2026-08-05):** Faz 0 ve Faz 1 tamamlandı; altı dikey dilimin
> (`001`…`006`) tamamı implemente edildi. Aşağıdaki fazlar artık **yapılmış işin
> kaydıdır**, yapılacak iş listesi değil. Güncel ilerleme için
> `docs/PROJECT_MAP.md` §6 ve ilgili dilimin `tasks.md` dosyası esastır.

## Süreç Boyunca (Cross-cutting)

Bu maddeler tek bir faza ait değildir; süreç boyunca sürekli işlenir.

| # | İş | Kim | Çıktı |
|---|----|-----|-------|
| C.1 | **AI_DEVLOG.md sürekli güncellenir** — hangi AI aracı/model, kaç iterasyon, nasıl çalıştırıldı, zorlanılan noktalar ve çözümleri, kullanılan mcp/skill'ler. Sona bırakılmaz; her anlamlı adımda işlenir. | Herkes | Güncel AI_DEVLOG.md |

## Faz 0 — Karar (Birlikte, kısa)

| # | İş | Kim | Çıktı |
|---|----|-----|-------|
| 0.1 | Tech stack kararı (TECH_STACK.md'yi kilitle) | Hep birlikte | Karar |
| 0.2 | Repo yapısı: dikey dilim + klasör düzeni. **Zorunlu:** repo kökünde `SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md` dosyaları (eksik/yanlış konumda ise proje değerlendirmeye alınmaz). | Hep birlikte | Karar + iskelet |
| 0.3 | Rol dağılımı (kim hangi dilim) | Hep birlikte | Karar |
| 0.4 | Custom agent rolleri kurulacak mı (Analyst/Architect/Dev/Reviewer) | Hep birlikte | Karar |

## Faz 1 — Ortak Temel / Spec (Birlikte)

| # | İş | Kim | Çıktı |
|---|----|-----|-------|
| 1.1 | Veri modeli: User, Interview, Question, Answer, Report, TokenUsage — alanlar + ilişkiler. **Admin gereksinimleri için şart olan alanlar dahil edilmeli:** `meslek/pozisyon` (filtre + istatistik), `süre` (ortalama görüşme süresi), `status` (tamamlandı/yarım), **soft-delete** (kullanıcıda silinse de admin'de "silindi" olarak kalır), `token/maliyet`. | Birlikte | Şema taslağı |
| 1.2 | API contract: endpoint listesi, request/response şekilleri, hata formatı | Birlikte | Contract dokümanı |
| 1.3 | LLM sözleşmesi: soru üretimi promptu (girdi/çıktı JSON şeması), rapor promptu, hata/boş yanıt davranışı | Birlikte | Prompt sözleşmesi |
| 1.4 | AI davranış sözleşmesi (UX): şeffaflık, belirsizlik gösterimi, kullanıcı kontrolü, hata toparlanma | Birlikte | UX kuralları |
| 1.5 | Güvenlik kuralları: auth akışı, admin ayrımı, prompt injection önlemi (iş ilanını "data" olarak izole etme) | Birlikte | Güvenlik notu |
| 1.6 | Her dilim için mini-spec + Gherkin AC'leri (ATDD) | Her kişi kendi diliminin, birlikte gözden geçir | Spec + AC dosyaları |


## Fonksiyon Backlog (Kapsam Kararı)

> Dikey dilimlere göre fonksiyon envanteri. **MVP** = ilk sürümde zorunlu; **Bonus** = zaman kalırsa.
> Her fonksiyon ilgili dilimin `spec.md`'sinde gereksinim + Gherkin AC olarak detaylandırılır.
> Cross-cutting olanlar veri modelini etkilediği için spec yazımından önce netleştirildi.

| Fonksiyon | Dilim | Kapsam | Veri modeli etkisi | Not |
|-----------|-------|--------|--------------------|-----|
| Devam ettirme (resume) — yarım görüşmeye kaldığı yerden devam | Interview | **MVP** | `status=in_progress` + son soru indeksi | status zaten modelde |
| Başlamadan özet onay ekranı (meslek, N, tahmini süre) | Interview | Bonus | Yok (UI) | Hiçbir spec'te FR'si yok (bulgu C1); temel akışı bloklamaz, MVP'den çıkarıldı |
| Zorluk/seviye seçimi (intern/junior/senior — `ExperienceLevel` enum'u pre-assessment ile ortak) | Interview | **MVP** | Interview.`level` | **KARARLAŞTI:** kaynak = **kullanıcı seçimi**. Aktif pre-assessment kaydı varsa form o değerle **ön-doldurulur** (opsiyonel zenginleştirme, zorunlu bağımlılık değil) |
| Pre-assessment raporunu görüşme prompt'una ek bağlam olarak geçirme | Pre-assessment → Interview | **MVP** | Yok (mevcut kayıttan okur) | **KARARLAŞTI (2026-08-04):** Bonus'tan MVP'ye yükseltildi (`003-pre-assessment` FR-016 — aktif kayıt varsa CompetencyReport + öz-değerlendirme + yetenek etiketleri context olarak VERİLMELİ). **İnşa edildi** (`002-interview` FR-030 / Faz 15, T139-T140; `interview.service.ts`). Rapor yoksa akış bozulmaz — zorunlu bağımlılık değil |
| Dil seçimi (TR/EN) | Cross-cutting (LLM + UI) | **MVP** | Interview.`language` | **KARARLAŞTI:** `Accept-Language` → `tr`\|`en`, `common/language.ts` iki dikeyde ortak. İlan dilinden auto-detect ve UI'dan manuel seçim = **Bonus** |
| Rubrik/model tutarlılığı — sabit değerlendirme rubriği, karşılaştırılabilir rapor | Cross-cutting (LLM sözleşmesi) | **MVP** | Sabit rapor şeması (Teknik/Davranışsal/Genel skorları) | Skor trendinin ön koşulu |
| Rapor PDF / dışa aktarım | Interview / History | **MVP** | Yok (mevcut rapordan üretir) | **KARARLAŞTI (2026-07-31):** Bonus'tan MVP'ye yükseltildi — düşük efor, kullanıcı için yüksek değer (`004-history` FR-016) |
| Zaman içinde ilerleme — aynı meslek için skor trendi grafiği | History / Dashboard | **MVP** | Karşılaştırılabilir skor + meslek alanı | **KARARLAŞTI (2026-07-31):** Bonus'tan MVP'ye yükseltildi (`004-history` FR-017); Rubrik tutarlılığına bağlı, grafik kütüphanesi zaten kilitli (ADR-0011 Recharts) |
| Adaptif soru akışı (cevaba göre sonraki soruyu uyarlama) | Interview | Bonus | Question güncelleme | APP_FLOW'da mevcut bonus |

> Ek fonksiyonlar ortaya çıktıkça bu tabloya eklenecek ve MVP/Bonus olarak işaretlenecektir.

### ~~Açık Karar~~ → KAPANDI: Sözlü Mod Altyapısı

**ADR-0007** (LLM sağlayıcı: Groq + DeepSeek) ücretsizlik kısıtı nedeniyle alındı ve sözlü
modu çözmedi (iki sağlayıcının hiçbiri çift yönlü realtime konuşma oturumu sunmuyor).
Bu boşluk **ADR-0010 ile kapatıldı: tarayıcı Web Speech API** (istemci tarafı STT + TTS).

| Yol | Maliyet | Sonuç |
|-----|---------|-------|
| **Tarayıcı Web Speech API** (istemci tarafı STT + TTS) | **Ücretsiz** | ✅ **SEÇİLDİ** — sunucu sözleşmesi değişmiyor, yeni bağımlılık yok. Bedeli: tarayıcı bağımlılığı (Chrome/Edge) |
| Ayrı STT/TTS servisi | Ücretsiz katman aranmalı | ⛔ İkinci entegrasyon + ikinci token/maliyet kaynağı (İlke VI'yı zorlar), ücretsizlik garanti değil |
| Sözlü modu kapsam dışına almak | — | ⛔ Anayasa "Teknoloji ve Kısıtlar" sözlü modu ürün kapsamına almış — kaldırmak anayasa değişikliği gerektirir |
| Ücretli sağlayıcıya dönmek | Sıfır değil | ⛔ Ücretsizlik kısıtı. ADR-0006 yeniden geçerli olursa (bütçe/sponsorluk) en iyi seçenek |

Sözlü mod **MVP kapsamındadır**. Desteklemeyen tarayıcıda yetenek tespiti ile UI'da devre
dışı gösterilir ve kullanıcı yazılı moda yönlendirilir (İlke VII — zarif toparlanma).

### Açık Kararlar (kalan)

Teknoloji kararlarının tamamı kapandı — ADR-0001…0012 hepsi ✅ Kabul
(`docs/DECISIONS.md` ADR Kayıt Defteri). Kapanış özeti:

- ~~E-posta gönderim yolu~~ → **ADR-0008: Resend** (kabul, 2026-07-31)
- ~~Grafik kütüphanesi~~ → **ADR-0011: Recharts** (kabul, 2026-07-31; interview Faz 5 blokajı kalktı)
- ~~Sözlü mod altyapısı~~ → **ADR-0010: Web Speech API** (yukarıdaki bölüm)
- ~~PDF metin çıkarma kütüphanesi~~ → **ADR-0009: unpdf** (kabul, 2026-07-31)
- ~~İstemci tarafı PDF üretimi~~ → **jsPDF**, ayrı ADR açılmadı (kilitli yığını etkilemeyen, tek dilime özgü seçim — `specs/004-history/research-pdf-karar.md`)
- ~~Groq Türkçe üretim kalitesi spike'ı (ADR-0007 / R4)~~ → **koşuldu, kapandı (2026-08-04)**: `openai/gpt-oss-120b` seçildi, `docs/TECH_STACK.md` "Seçilen model" satırı dolduruldu, ölçüm `specs/002-interview/spike-model-secimi.md`'de
- ~~Oturum çerezi duruşu / CSRF savunması~~ → **ADR-0012** (Better Auth çerezi + `OriginGuard`, `backend/src/common/guards/origin.guard.ts`)

> `_TBD_` kalan tek başlıklar teknoloji seçimi değil, **altyapı**: Storage,
> DevOps/Deployment, Development Tools, Git Workflow (`docs/TECH_STACK.md`).
