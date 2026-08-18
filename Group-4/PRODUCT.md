# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Adaylar (iş arayanlar) sahte mülakat pratiği yapan birincil kullanıcı: bir iş ilanı
yapıştırıp LLM'in ürettiği sorulara tek tek cevap verir, sonunda değerlendirme raporu
alır. İkincil kullanıcı: admin — token/maliyet takibi, kullanıcı/görüşme istatistikleri
ve meslek dağılımını izler; kendi girişi yalnızca e-posta/şifre.

## Product Purpose

Adayın gerçek bir mülakata girmeden önce, hedeflediği iş ilanına özgü sorularla pratik
yapmasını ve LLM'den yapılandırılmış, üç eksenli (Teknik/Davranışsal/Genel) bir geri
bildirim almasını sağlamak. Ayrıca meslek-bağımsız bir "ön değerlendirme" ile adayın
genel yetkinlik profilini (skorsuz, yol haritalı) çıkarmak.

## Positioning

İş ilanına özgü, LLM üretimi sorularla kişiselleştirilmiş mülakat pratiği + sözlü
(tarayıcı Web Speech API) veya yazılı mod seçimi + adaptif soru akışı (bonus) —
jenerik "banka soru" tekrar pratiği yapan araçlardan farkı budur.

## Operating Context

- Kullanıcı: giriş/kayıt (e-posta+şifre veya Google) → Dashboard'da 3 sekme
  (Interview History / Pre-assessment / Interview).
- Interview: iş ilanı (serbest metin veya PDF) + soru sayısı N + mod seçimi → soru
  `i` tamamlanmadan `i+1` gösterilmez, geri dönüp cevap değiştirilemez → rapor.
- Pre-assessment: bağımsız, meslek-bağımsız ön sorular → skorsuz yetkinlik raporu;
  interview'a beslenmez (mevcut kararla opsiyonel context olarak kullanılabilir,
  bkz. APP_FLOW.md güncellemesi).
- Kullanıcı bir görüşmeyi silebilir (soft delete) — admin tarafında "silindi"
  etiketiyle görünmeye devam eder.
- Admin: ayrı login, kullanıcı/görüşme listeleri, token/maliyet ve meslek dağılımı
  istatistikleri.

## Capabilities and Constraints

- LLM sağlayıcı: Groq (birincil, ücretsiz), DeepSeek (yedek) — maliyet sıfır olmalı
  kısıtı kilitli (bkz. TECH_STACK.md, DECISIONS.md).
- Sözlü mod: yalnızca tarayıcı Web Speech API (Chrome/Edge); desteklenmeyen
  tarayıcıda UI'da devre dışı gösterilir. Sunucu tarafında ses işleme yok.
- Her LLM çağrısının token/maliyeti kaydedilir ve admin panelinde gösterilir.
  LLM çağrıları testlerde mock'lanır (deterministik).
- İş ilanı/serbest metin/PDF içeriği LLM'e her zaman veri olarak geçirilir, asla
  talimat olarak değil (prompt-injection izolasyonu, anayasa ilke V).
- Auth: Better Auth (self-hosted), rol tabanlı guard zinciri (Session → Roles →
  Ownership); admin girişi yalnızca e-posta/şifre.
- Undecided: Storage, DevOps/Deployment, Development Tools, Git Workflow
  (TECH_STACK.md'de `_TBD_`).

## Brand Commitments

Ürün adı "Mock Interview". Sabit ekran adları: Interview History / Pre-assessment /
Interview (dashboard sekmeleri). Admin UI: kullanıcı ile aynı layout, beyaz arka
plan + açık mavi vurgu rengi. Üst navbar (sidebar yok), kart görünümlü listelemeler.
Rapor: sabit 3 eksen (Teknik/Davranışsal/Genel) + radar/bar grafik.

## Evidence on Hand

Gerçek iş ilanı örneği, örnek rapor çıktısı veya kullanıcı testimonial'ı yok —
bunlar üretilmemeli (fabrikasyon yasak). Referans: `docs/APP_FLOW.md`,
`docs/PLAN.md`, `docs/DECISIONS.md`, `specs/001-auth-rol/` (uygulanmış dilim).

## Product Principles

1. Spec-first + test-first (ATDD): kod yazılmadan önce spec + Gherkin kabul
   kriterleri, testler kırmızıdan yeşile.
2. Dikey dilimler halinde teslim (auth → interview → pre-assessment → admin),
   her dilim uçtan uca çalışır durumda.
3. LLM çıktısı her zaman doğrulanır (Zod) ve maliyeti gözlemlenir — asla kör
   güvenilmez.
4. Kullanıcı verisi (iş ilanı, cevaplar) asla LLM'e talimat olarak sızmaz.
5. Karar → ADR: her teknoloji/ürün kararı gerekçeli olarak DECISIONS.md'ye
   düşer, TECH_STACK.md ile çelişmez.

## Accessibility & Inclusion

Proje-özel bir standart hedeflenmiyor (WCAG belirli bir seviyeye kilitlenmedi);
genel iyi pratik (semantic HTML, klavye erişimi, kontrast) yeterli kabul edildi.
Grafiklerde (Recharts) `accessibilityLayer` açık ve her grafiğin yanında metinsel
değer sağlanıyor (ADR-0011).
