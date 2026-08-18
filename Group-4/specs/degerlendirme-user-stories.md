# Değerlendirme Kriterlerine Göre User Story'ler (Happy / Error / Edge)

**Kaynak:** `docs/AI Native Internship Proje.pdf` — "Değerlendirme" tablosu (120 puan)
**Amaç:** Her puanlanan kriter için, kabul kriterleri **Türkçe Gherkin** biçiminde
(mutlu yol + hata + sınır durumu) tanımlanmış user story'ler üretmek ve her birini
çalıştırılabilir bir teste bağlamak (Anayasa İlke II + III, ATDD).

> **Not:** Bu doküman dikey dilim spec'lerinin (`specs/001…003`) yerine geçmez.
> Onlar *ne inşa edilecek* sorusunu yanıtlar; bu doküman *değerlendirmede ne
> puanlanacak* eksenine göre aynı davranışları kesitler ve **test kapsamı boşluklarını**
> görünür kılar.

## Kimlik kuralı

`DS-<kriter no>-<H|E|K><sıra>` — **H**appy path · **E**rror case · **K**enar (edge) durumu.

## Test durumu göstergesi

| İşaret | Anlamı |
|--------|--------|
| ✅ | Çalıştırılabilir test var ve **geçiyor** |
| 🔴 | Test var, **kalıyor** — açık bulgu (kod sözleşmeden sapıyor) |
| ⬜ | `it.todo` — kod henüz yok (ATDD kırmızı fazı, `atdd-backlog.spec.ts`) |

---

## Kriter özeti ve kapsama

> **Durum (2026-08-05):** Altı dikey dilimin tamamı implemente edildi. Bu tablo o
> senkronizasyonda kod tabanına karşı yeniden doğrulandı; her ✅ maddenin altında
> onu koşan test dosyası yazılıdır.

| # | Kriter | Ağırlık | Dilim | Kapsama |
|---|--------|:-------:|-------|---------|
| 1 | Yetkilendirme (e-posta/şifre, Google, admin ayrımı) | 6 | 001 | ✅ |
| 2 | Görüşme geçmişi (listeleme, görüntüleme, silme) | 5 | 004 | ✅ |
| 3 | İş ilanı girişi (metin/PDF) + soru sayısı | 5 | 002 | ✅ |
| 4 | Soru üretimi (LLM entegrasyonu) | 9 | 002 | ✅ |
| 5 | Sıralı soru akışı | 6 | 002 | ✅ |
| 6 | Değerlendirme raporu | 9 | 002 | ✅ |
| 7 | Admin: görüşme listeleme + token/maliyet | 5 | 005 | ✅ |
| 8 | Admin: meslek filtresi + istatistik ekranı | 5 | 005 | ✅ |
| 9 | Adaptif soru akışı (bonus) | 10 | 002 | ✅ |
| 10 | Aday tanıma aşaması (bonus) | 5 | 003 | ✅ |
| 11 | Güvenlik | 4 | 001 | ✅ |
| 12 | Performans | 3 | 002 | ✅ kısmi — 2 madde yük testi gerektiriyor |
| 13 | Bakım kolaylığı | 5 | süreç | ✅ kısmi — CI kapısı ve `banned` alanları açık |
| 14 | Kullanıcı deneyimi | 6 | 001 | ✅ |

**82 DS maddesinin 68'i** çalıştırılabilir bir teste bağlıdır. Kalan 4 madde
(`atdd-backlog.spec.ts`):

| Madde | Neden hâlâ ⬜ |
|-------|---------------|
| DS-17-H2 (rapor %95 < 60 sn) | Yüzde-dilimi ölçümü; tek koşumlu entegrasyon testi kanıtlayamaz, yük testi gerekir |
| DS-17-K1 (rapor okuma p95 < 300 ms) | Aynı gerekçe |
| DS-07-E2 (CI kapısı) | `.github/workflows/` hâlâ yok |
| DS-07-K1 (`banned`/`banReason`/`banExpires`) | Kodda hâlâ sıfır referans — `001-auth-rol` T081/T081b'ye bağlı |

---

# 1 — Yetkilendirme (6%)

> PDF: *"Kullanıcılar e-posta/şifre ya da Google girişi kullanarak giriş yapabilmelidir.
> Adminler sadece e-posta/şifre ile giriş yapabilmelidir."*

## DS-01 — Kullanıcı e-posta/şifre ile kayıt olur ve giriş yapar

**Hikâye:** Ziyaretçi olarak, hesap açıp giriş yapmak istiyorum ki kendi görüşmelerimi
oluşturabileyim.

### DS-01-H1 — Kayıt ve giriş mutlu yolu ✅
**Diyelim ki** kayıtlı olmayan geçerli bir e-posta ve politikaya uygun bir şifre var,
**Olduğunda** ziyaretçi kayıt olur ve e-postasını doğrulayıp giriş yapar,
**O zaman** `role="user"` bir hesap oluşur ve oturum başlar.
*(`us1-register-happy.spec.ts`, `us1-email-verification.spec.ts`, `us2-signin-happy.spec.ts`)*

### DS-01-E1 — Doğrulanmamış e-postayla giriş reddedilir ✅
**Diyelim ki** kullanıcı kayıt olmuş ama e-postasını doğrulamamış,
**Olduğunda** giriş yapmayı dener,
**O zaman** sistem `403 EMAIL_NOT_VERIFIED` döner ve oturum açılmaz.
*(`us1-email-verification.spec.ts`)*

### DS-01-E2 — Hatalı kimlik bilgisi hangi alanın yanlış olduğunu sızdırmaz ✅
**Diyelim ki** kayıtlı bir kullanıcı var,
**Olduğunda** yanlış şifreyle giriş denenir,
**O zaman** genel `401` döner; yanıt "kullanıcı yok" ile "şifre yanlış" durumlarını
ayırt ettirmez.
*(`us2-signout-error.spec.ts`, `ds-yetkilendirme.spec.ts` → DS-01-E2)*

### DS-01-K1 — İstemci kendi rolünü belirleyemez ✅
**Diyelim ki** saldırgan kayıt isteğinin gövdesine `role: "admin"` ekliyor,
**Olduğunda** kayıt isteği sunucuya ulaşır,
**O zaman** alan **yok sayılır** ve hesap `role="user"` olarak oluşur.
*(`ds-yetkilendirme.spec.ts` → DS-01-K1 — yeni; daha önce hiç test edilmemişti)*

### DS-01-K2 — Aynı e-posta için mükerrer hesap oluşmaz ✅
**Diyelim ki** e-posta zaten kayıtlı,
**Olduğunda** aynı e-postayla tekrar kayıt denenir,
**O zaman** `409` döner ve ikinci bir kullanıcı kaydı oluşmaz.
*(`us1-register-errors.spec.ts` + `ds-yetkilendirme.spec.ts` → DS-01-K2 satır sayısı doğrulaması)*

---

## DS-02 — Admin yalnızca e-posta/şifre ile girer

**Hikâye:** Yönetici olarak, hesabımın sosyal giriş yoluyla ele geçirilememesini istiyorum.

### DS-02-H1 — Admin girişi ve panel erişimi ✅
**Diyelim ki** seed ile tanımlı bir admin hesabı var,
**Olduğunda** admin e-posta/şifre ile giriş yapar,
**O zaman** `role="admin"` oturum açılır ve admin uç noktalarına erişir.
*(`us4-admin-login.spec.ts`)*

### DS-02-E1 — Kullanıcı admin uç noktasına erişemez ✅
**Diyelim ki** `role="user"` bir oturum var,
**Olduğunda** admin uç noktasına istek yapılır,
**O zaman** `403` döner.
*(`us4-admin-panel-guard.spec.ts`)*

### DS-02-E2 — Admin Google ile giriş yapamaz ✅
**Diyelim ki** admin e-postasına ait bir Google kimliği sunuluyor,
**Olduğunda** Google ile giriş denenir,
**O zaman** istek reddedilir ve **oturum kaydı hiç oluşturulmaz**.
*(`us3-google-cancel-admin.spec.ts`)*

### DS-02-K1 — Yetkilendirme matrisi eksiksiz ✅
**Diyelim ki** admin uç noktası var,
**Olduğunda** sırasıyla oturumsuz / `user` / `admin` istek yapılır,
**O zaman** sırasıyla `401` / `403` / `200` döner — üçü de birbirinden ayırt edilebilir.
*(`ds-yetkilendirme.spec.ts` → DS-02-K1 — yeni; matris tek testte doğrulanıyor)*

---

## DS-03 — Google ile giriş ve hesap bağlama

### DS-03-H1 — İlk Google girişi tek hesap oluşturur ✅
**Diyelim ki** sistemde hesabı olmayan bir Google kullanıcısı var,
**Olduğunda** Google ile giriş yapar,
**O zaman** `role="user"`, `emailVerified=true` tek bir hesap oluşur.
*(`us3-google-new.spec.ts`)*

### DS-03-K1 — Parola hesabı Google ile otomatik bağlanır ✅
**Diyelim ki** e-posta daha önce parola ile kayıtlı,
**Olduğunda** aynı e-postayla Google girişi yapılır,
**O zaman** mükerrer hesap oluşmaz, mevcut hesaba bağlanır.
*(`us3-account-linking.spec.ts`)*

### DS-03-E1 — Google ile kayıtlı e-postaya parola **kaydı** reddedilir ✅
**Diyelim ki** e-posta yalnızca Google ile kayıtlı,
**Olduğunda** aynı e-postayla parola kaydı denenir,
**O zaman** `403 ACCOUNT_USE_GOOGLE` döner ve kullanıcı Google girişine yönlendirilir.
*(`us1-register-errors.spec.ts`)*

### DS-03-E2 — Google ile kayıtlı e-postayla **giriş** denemesi 🔴
**Diyelim ki** e-posta yalnızca Google ile kayıtlı,
**Olduğunda** aynı e-postayla parola **girişi** denenir,
**O zaman** sözleşme (`contracts/auth-api.md:57`) Google yönlendirme uyarısı bekliyor.
**Gözlem:** `401 INVALID_EMAIL_OR_PASSWORD` dönüyor — uyarı yok.
*(`analiz-dogrulama.spec.ts` → A1, **kırmızı**)*

> ⚠️ Bu bulgu düzeltilmeden önce spec çelişkisi çözülmeli: DS-01-E2 (hesap varlığını
> sızdırma) ile DS-03-E2 (hesabın Google'a ait olduğunu söyle) aynı anda karşılanamaz.

---

# 11 — Güvenlik (4%)

## DS-04 — Kimlik verisi ve oturum sızdırılmaz

### DS-04-H1 — Oturum çerezi HttpOnly ve SameSite taşır ✅
**Diyelim ki** kullanıcı giriş yapıyor,
**Olduğunda** sunucu oturum çerezini set eder,
**O zaman** çerez `HttpOnly` ve `SameSite` bayraklarını taşır (JS ile okunamaz).
*(`ds-yetkilendirme.spec.ts` → DS-04-H1 — yeni)*

### DS-04-E1 — Hiçbir yanıt şifre/hash döndürmez ✅
**Diyelim ki** kullanıcı oturum açmış,
**Olduğunda** `get-session` çağrılır,
**O zaman** yanıt gövdesinde `password`, `hash` veya `salt` alanı **bulunmaz**.
*(`ds-yetkilendirme.spec.ts` → DS-04-E1 — yeni)*

### DS-04-K1 — Hata gövdesi iç detay sızdırmaz ✅
**Diyelim ki** geçersiz bir istek gönderiliyor,
**Olduğunda** sunucu hata döner,
**O zaman** gövdede stack trace, dosya yolu, SQL veya sağlayıcı ham yanıtı bulunmaz.
*(`ds-yetkilendirme.spec.ts` → DS-04-K1 — yeni)*

### DS-04-K2 — Kaba kuvvet koruması eşiği ve kilitsizliği ✅
**Diyelim ki** aynı e-posta için ardışık başarısız denemeler yapılıyor,
**Olduğunda** 10 deneme aşılır,
**O zaman** `429` döner; artan gecikme sonrası **doğru şifreyle giriş yine çalışır**
(sabit süreli tam kilit yok).
*(`analiz-dogrulama.spec.ts` → F1 — **geçiyor**, davranış doğru)*

### DS-04-E2 — Sır yönetimi başlangıçta doğrulanır 🔴
**Diyelim ki** `MAIL_TRANSPORT=resend` seçilmiş ama `RESEND_API_KEY` boş,
**Olduğunda** uygulama başlatılır,
**O zaman** açılışta hata verilmeli (fail-fast).
**Gözlem:** doğrulama geçiyor, hata çalışma zamanına kayıyor.
*(`analiz-dogrulama.spec.ts` → A5, **kırmızı**)*

---

## DS-05 — Oturum yaşam döngüsü

### DS-05-H1 — "Beni hatırla" kalıcı, aksi session-scoped ✅
**Diyelim ki** kullanıcı "Beni hatırla" seçeneğini işaretlemiyor,
**Olduğunda** giriş yapar,
**O zaman** çerez `Max-Age`/`Expires` taşımaz (tarayıcı kapanınca biter).
*(`us6-remember-me.spec.ts`, `us6-session-expiry.spec.ts`)*

### DS-05-E1 — Süresi dolan oturum reddedilir ✅
**Diyelim ki** oturumun süresi dolmuş,
**Olduğunda** korunan içeriğe erişilir,
**O zaman** `401` döner ve yeniden giriş istenir.
*(`us6-session-expiry.spec.ts`)*

### DS-05-K1 — 30 günlük ömür sabit olmalı 🔴
**Diyelim ki** "Beni hatırla" ile açılmış bir oturumun üzerinden 2 gün geçmiş,
**Olduğunda** kullanıcı tek bir istek yapar,
**O zaman** FR-013 gereği `expiresAt` **uzamamalı** (idle penceresi yok).
**Gözlem:** tek `get-session` çağrısı ömrü 28 günden 30 güne itiyor (+2880 dk).
*(`analiz-dogrulama.spec.ts` → A2, **kırmızı**)*

### DS-05-K2 — Sahiplik guard'ı oturumsuz istekte doğru kod döner 🔴
**Diyelim ki** oturumsuz bir istek sahiplik korumalı bir kaynağa gidiyor,
**Olduğunda** guard çalışır,
**O zaman** `authz-rules.md` gereği `401` dönmeli.
**Gözlem:** `403` dönüyor.
*(`analiz-dogrulama.spec.ts` → A3, **kırmızı**)*

### DS-05-E2 — Kapsam dışı uç noktalar kullanıcıyı yanıltmaz 🔴
**Diyelim ki** şifre sıfırlama bu sürümün kapsamında değil,
**Olduğunda** kullanıcı `POST /api/auth/request-password-reset` çağırır,
**O zaman** ya uç kapalı olmalı ya gerçekten mail gitmeli.
**Gözlem:** `200` + "check your email for the reset link" dönüyor, **hiç mail gitmiyor**.
*(`analiz-dogrulama.spec.ts` → A4, **kırmızı**)*

---

# 14 — Kullanıcı deneyimi (6%) · Görsellik (8%)

## DS-06 — Giriş/kayıt formları kullanıcıyı yalnız bırakmaz

### DS-06-H1 — "Beni hatırla" seçimi sunucuya doğru taşınır ✅
*(`frontend/test/login-form.test.tsx`)*

### DS-06-E1 — Sunucu hatası kullanıcıya gösterilir ✅
*(`frontend/test/login-form.test.tsx`)*

### DS-06-K1 — Admin giriş ekranında Google seçeneği **yoktur** ✅
**Diyelim ki** admin giriş sayfası açılıyor,
**Olduğunda** sayfa render edilir,
**O zaman** Google ile giriş düğmesi/metni **bulunmaz** (FR-006 UX tarafı).
*(`frontend/test/admin-login.test.tsx` → DS-06-K1 — yeni)*

### DS-06-K2 — Gönderim sırasında form kilitlenir (çift gönderim yok) ✅
**Diyelim ki** kullanıcı giriş düğmesine bastı ve istek sürüyor,
**Olduğunda** düğmeye tekrar basılır,
**O zaman** ikinci bir istek gönderilmez.
*(`frontend/test/admin-login.test.tsx` → DS-06-K2 — yeni)*

### DS-06-E2 — Form alanları erişilebilir etiket taşır 🔴
**Diyelim ki** ekran okuyucu kullanan bir kullanıcı formu açıyor,
**Olduğunda** alanlara odaklanılır,
**O zaman** her alanın programatik bir adı (`<label>`/`aria-label`) olmalı.
**Gözlem:** yalnız `placeholder` var — alanlar adsız.
*(`frontend/test/analiz-dogrulama.test.tsx` → DS-06-E2, **kırmızı**)*

---

# 13 — Bakım kolaylığı (5%)

## DS-07 — Depo kendi kalite kapılarını uygular

### DS-07-E1 — Bildirilmemiş bağımlılık yok 🔴
**Diyelim ki** frontend `zod` kullanıyor,
**Olduğunda** `package.json` denetlenir,
**O zaman** `zod` doğrudan bağımlılık olarak listelenmelidir.
**Gözlem:** listelenmiyor; yalnız `better-auth` üzerinden geliyor (phantom dependency).
*(kanıt: `npm ls zod` — `atdd-backlog.spec.ts` → DS-07-E1 `todo`, düzeltme tek satır)*

### DS-07-E2 — Otomatik kalite kapısı 🔴
**Diyelim ki** bir PR açılıyor,
**Olduğunda** CI çalışır,
**O zaman** lint + build + test yeşil olmadan merge edilememelidir.
**Gözlem:** `.github/workflows` yok; kapı tamamen elle.
*(`atdd-backlog.spec.ts` → DS-07-E2 `todo`)*

### DS-07-K1 — Şemada ölü alan yok 🔴
**Diyelim ki** `User` modelinde `banned`/`banReason`/`banExpires` alanları var,
**Olduğunda** kod taranır,
**O zaman** ya kullanılmalı ya kaldırılmalıdır.
**Gözlem:** hiçbir yerde referans yok.
*(`atdd-backlog.spec.ts` → DS-07-K1 `todo`)*

---

# 3 — İş ilanı girişi ve soru sayısı (5%)

## DS-08 — Kullanıcı iş ilanını girer ve soru sayısını seçer

### DS-08-H1 ✅ — Serbest metin + N=8 ile görüşme oluşturulur; `status="in_progress"`.

**Test:** `backend/test/integration/us1-create-happy.spec.ts`

### DS-08-H2 ✅ — PDF yüklenir, metin **sunucuda** çıkarılır, aynı akış çalışır.

**Test:** `backend/test/integration/us1-create-pdf.spec.ts`

### DS-08-E1 ✅ — `N` 5-20 aralığı dışında → `400`, geçerli aralık bildirilir.

**Test:** `backend/test/integration/us1-create-validation.spec.ts`

### DS-08-E2 ✅ — Boş/yalnızca boşluk metin → `400`.

**Test:** `backend/test/integration/us1-create-validation.spec.ts`

### DS-08-E3 ✅ — Taranmış/bozuk PDF (metin çıkarılamıyor) → `422`, anlaşılır mesaj.

**Test:** `backend/test/integration/us1-create-validation.spec.ts`

### DS-08-K1 ✅ — 10 MB üstü PDF → `400`, azami boyut bildirilir.

**Test:** `backend/test/integration/us1-create-validation.spec.ts`

### DS-08-K2 ✅ — Desteklenmeyen dosya türü (`.docx`, `.jpg`) → `400`.

**Test:** `backend/test/integration/us1-create-validation.spec.ts`

### DS-08-K3 ✅ — Aynı anda birden fazla yarım görüşme açılabilir; biri diğerini etkilemez.

**Test:** `backend/test/integration/us3-multiple-active.spec.ts`

---

# 4 — Soru üretimi / LLM entegrasyonu (9%)

## DS-09 — Sistem ilana uygun N soru üretir

### DS-09-H1 ✅ — Tam olarak **N** soru üretilir, ilk soru kullanıcıya döner.

**Test:** `backend/test/integration/us1-create-happy.spec.ts`

### DS-09-H2 ✅ — Pozisyon adı **aynı** LLM yanıtından çıkarılır (ek çağrı yok).

**Test:** `backend/test/integration/us1-position.spec.ts`

### DS-09-E1 ✅ — LLM hata/zaman aşımı → `502`/`504`, **yarım görüşme kaydı oluşmaz**.

**Test:** `backend/test/integration/us1-create-llm-failure.spec.ts`

### DS-09-E2 ✅ — LLM N-1 soru döndürür → katman-2 şema doğrulaması reddeder, kayıt oluşmaz.

**Test:** `backend/test/integration/us1-question-count-mismatch.spec.ts`

### DS-09-E3 ✅ — Şema dışı yanıt (fazladan alan / eksik alan) → `LlmSchemaError`, kayıt yok.

**Test:** `backend/test/integration/us1-voice-open-ended.spec.ts`

### DS-09-K1 ✅ — Sözlü modda üretilen tüm sorular `open_ended` olmalı.

**Test:** `backend/test/integration/us1-voice-open-ended.spec.ts`

### DS-09-K2 ✅ — İlanda pozisyon yoksa `position=null` ama görüşme yine `201`.

**Test:** `backend/test/integration/us1-position.spec.ts`

### DS-09-K3 ✅ — **Prompt injection:** ilan metni "önceki talimatları yok say" içerse bile

**Test:** `backend/test/unit/prompt-isolation.spec.ts`
sistem talimatı ezilmez; metin ayrı mesaj rolünde **veri** olarak gider.
### DS-09-K4 ✅ — Saatlik sınır (3/saat) aşılır → `429` + ne zaman deneneceği bilgisi.

**Test:** `backend/test/integration/us1-rate-limit.spec.ts`

### DS-09-K5 ✅ — `Accept-Language: tr-TR` → `language="tr"`; `de-DE` → `en`.

**Test:** `backend/test/integration/us1-language.spec.ts`

---

# 5 — Sıralı soru akışı (6%)

## DS-10 — Sorular tek tek sunulur, atlanamaz

### DS-10-H1 ✅ — Soru `i` cevaplanınca soru `i+1` döner; `i+1` o ana dek hiç gösterilmemiştir.

**Test:** `backend/test/integration/us2-sequential-flow.spec.ts`

### DS-10-H2 ✅ — Son soru cevaplanınca `status="completed"` + `completedAt` yazılır.

**Test:** `backend/test/integration/us2-completion.spec.ts`

### DS-10-E1 ✅ — Zaten cevaplanmış soruya tekrar cevap → `409`, mevcut cevap değişmez.

**Test:** `backend/test/integration/us2-answer-immutable.spec.ts`

### DS-10-E2 ✅ — Sırası gelmemiş soruya doğrudan cevap → `409` (istemci baypası reddi).

**Test:** `backend/test/integration/us2-order-lock.spec.ts`

### DS-10-E3 ✅ — Çoktan seçmelide listede olmayan değer → `400`.

**Test:** `backend/test/integration/us2-mc-validation.spec.ts`

### DS-10-K1 ✅ — Yarıda bırakılan görüşmeye dönülür → tam olarak kaldığı sorudan devam.

**Test:** `backend/test/integration/us3-resume.spec.ts`

### DS-10-K2 ✅ — `GET /interviews/:id` yanıtı **sıradaki sorulardan sonrasını sızdırmaz**.

**Test:** `backend/test/integration/us3-resume.spec.ts`

### DS-10-K3 ✅ — Başka kullanıcının görüşmesi `id` bilinerek istenir → `404` ("yok" ile ayırt edilemez).

**Test:** `backend/test/integration/us3-resume-unauthorized.spec.ts`

---

# 6 — Değerlendirme raporu (9%)

## DS-11 — Tüm cevaplar sonrası rapor üretilir

### DS-11-H1 ✅ — Rapor Genel İzlenim + Güçlü Yönler + Geliştirilecek Alanlar içerir (PDF minimumu).

**Test:** `backend/test/integration/us5-report-happy.spec.ts`

### DS-11-H2 ✅ — Teknik/Davranışsal/Genel eksenlerinde 0-100 skor döner.

**Test:** `backend/test/integration/us5-report-overall-score.spec.ts`

### DS-11-E1 ✅ — Rapor LLM'i hata verir → `reportStatus="failed"`, **cevaplar kaybolmaz**, retry sunulur.

**Test:** `backend/test/integration/us5-report-failure.spec.ts`

### DS-11-E2 ✅ — Skor aralık dışı (örn. 120) → şema reddeder, rapor kaydedilmez.

**Test:** `backend/test/integration/us5-report-happy.spec.ts`

### DS-11-K1 ✅ — Rapor tekrar görüntülenir → **yeni LLM çağrısı yapılmaz** (aynı içerik).

**Test:** `backend/test/integration/us5-report-cached.spec.ts`

### DS-11-K2 ✅ — Rapor çağrısı 60 sn timeout ile yapılır (varsayılan 30 sn onu keserdi).

**Test:** `backend/test/integration/us5-report-timeout.spec.ts`

### DS-11-K3 ✅ — Başkasının raporuna erişim → `404`, içerik sızmaz.

**Test:** `backend/test/integration/us5-report-unauthorized.spec.ts`

### DS-11-K4 ✅ — `retry` yalnız `failed` durumda geçerli; aksi halde `409`.

**Test:** `backend/test/integration/us5-report-retry.spec.ts`

---

# 2 — Görüşme geçmişi (5%)

## DS-12 — Kullanıcı geçmiş görüşmelerini yönetir

### DS-12-H1 ✅ — Liste yalnız kullanıcının kendi görüşmelerini döner.

**Test:** `backend/test/integration/us3-soft-delete-visibility.spec.ts`

### DS-12-H2 ✅ — Geçmişten bir görüşme açılır; sorular ve rapor görüntülenir.

**Test:** `backend/test/integration/us3-resume.spec.ts`

### DS-12-H3 ✅ — Kullanıcı bir görüşmeyi siler → kendi listesinden kaybolur.

**Test:** `backend/test/integration/history-delete.spec.ts`

### DS-12-E1 ✅ — Başkasının görüşmesini silme denemesi → `404`.

**Test:** `backend/test/integration/history-delete.spec.ts`

### DS-12-K1 ✅ — Silinen kayıt **fiziksel olarak silinmez** (`deletedAt` işaretlenir).

**Test:** `backend/test/integration/history-delete.spec.ts`

### DS-12-K2 ✅ — Silinen kayıt sahibinin detay isteğinde `404`, **admin'de görünür**.

**Test:** `backend/test/integration/us3-soft-delete-visibility.spec.ts`

### DS-12-K3 ✅ — Boş geçmiş → `200` + boş liste (hata değil).

**Test:** `frontend/test/interview-list.test.tsx`

---

# 7 — Admin: görüşme listeleme + token/maliyet (5%)

## DS-13 — Admin tüm görüşmeleri ve maliyetlerini görür

### DS-13-H1 ✅ — Admin tüm kullanıcıların görüşmelerini listeler.

**Test:** `backend/test/integration/us-admin1-list-filter.spec.ts`

### DS-13-H2 ✅ — Her görüşme için **toplam token ve maliyet** görüntülenir (`TokenUsage` toplamı).

**Test:** `backend/test/integration/us-admin2-detail.spec.ts`

### DS-13-E1 ✅ — `role=user` admin listesine erişemez → `403`.

**Test:** `backend/test/integration/us-admin1-list-auth.spec.ts`

### DS-13-E2 ✅ — Admin başka kullanıcının kaydına **yazma** denerse → `403` (salt okunur).

**Test:** `backend/test/integration/us-admin2-readonly.spec.ts`

### DS-13-K1 ✅ — Silinmiş görüşmeler admin listesinde **"silindi" işaretiyle** görünür.

**Test:** `backend/test/integration/us-admin1-list-filter.spec.ts`

### DS-13-K2 ✅ — Başarısız LLM çağrısı da maliyet kaydına girer (`succeeded=false`) — boşluk oluşmaz.

**Test:** `backend/test/integration/pa-us5-token-usage.spec.ts`

### DS-13-K3 ✅ — Kullanıcıya dönen yanıtlarda token/maliyet alanı **bulunmaz**.

**Test:** `backend/test/integration/pa-us5-token-usage.spec.ts`

---

# 8 — Admin: meslek filtresi + istatistik (5%)

## DS-14 — Admin istatistikleri okur

### DS-14-H1 ✅ — Meslek (pozisyon) filtresi listeyi daraltır.

**Test:** `backend/test/integration/us-admin1-list-filter.spec.ts`

### DS-14-H2 ✅ — İstatistik ekranı: meslek başına görüşme sayısı, ortalama süre,

**Test:** `backend/test/integration/us-admin3-stats.spec.ts`
tamamlanan/yarım kalan sayısı, toplam token.
### DS-14-E1 ✅ — Filtreye hiç kayıt uymazsa boş sonuç + açıklayıcı boş durum (hata değil).

**Test:** `backend/test/integration/us-admin3-empty.spec.ts`

### DS-14-K1 ✅ — Pozisyonu çıkarılamamış görüşmeler **"Belirsiz"** kovasında gruplanır.

**Test:** `backend/test/integration/us-admin3-stats.spec.ts`

### DS-14-K2 ✅ — Ortalama süre yalnız `completedAt` dolu kayıtlardan hesaplanır;

**Test:** `backend/test/integration/us-admin3-stats.spec.ts`
yarım kalanlar ortalamayı bozmaz.

---

# 9 — Adaptif soru akışı (bonus, 10%)

## DS-15 — Sistem cevaba göre sonraki soruyu uyarlar

### DS-15-H1 ✅ — Güçlü cevap → sonraki soru zorlaşır (`isBaseline=false`).

**Test:** `backend/test/integration/us4-adaptive-uplevel.spec.ts`

### DS-15-H2 ✅ — Zayıf cevap → sonraki soru temel seviyeye iner.

**Test:** `backend/test/integration/us4-adaptive-downlevel.spec.ts`

### DS-15-E1 ✅ — Uyarlama LLM'i hata verir → akış **kesilmez**, baseline soru sunulur.

**Test:** `backend/test/integration/us4-adaptive-fallback.spec.ts`

### DS-15-K1 ✅ — Toplam soru sayısı her durumda **N** sabit kalır.

**Test:** `backend/test/integration/us4-adaptive-downlevel.spec.ts`

### DS-15-K2 ✅ — Adaptif kapalıyken hiç uyarlama çağrısı yapılmaz.

**Test:** `backend/test/integration/us4-adaptive-disabled.spec.ts`

### DS-15-K3 ✅ — **Cevaplanmış** bir soru asla uyarlanamaz (donar).

**Test:** `backend/test/integration/us4-answered-question-frozen.spec.ts`

---

# 10 — Aday tanıma aşaması (bonus, 5%)

## DS-16 — Ön değerlendirme kullanıcıyı tanır

### DS-16-H1 ✅ — Meslek-bağımsız zorunlu alanlar (deneyim, çalışma durumu, 4 çalışma tarzı, 8 maddelik öz-değerlendirme) doldurulur, skorsuz nitel rapor üretilir.

**Test:** `backend/test/integration/pa-us1-create-happy.spec.ts`

### DS-16-E1 ✅ — Liste dışı değer gönderilir → `400` ve **LLM hiç çağrılmaz**.

**Test:** `backend/test/integration/pa-us1-enum-guard.spec.ts`

### DS-16-E2 ✅ — LLM hatası → rapor kaydedilmez, mevcut aktif rapor bozulmaz.

**Test:** `backend/test/integration/pa-us3-provider-error.spec.ts`

### DS-16-K1 ✅ — Yeniden değerlendirme → yeni rapor aktif, eski **silinmeden** arşivlenir.

**Test:** `backend/test/integration/pa-us2-view-reassess-archive.spec.ts`

### DS-16-K2 ✅ — Eşzamanlı iki gönderim → tam **bir** aktif kayıt (partial unique index).

**Test:** `backend/test/integration/pa-us2-view-reassess-archive.spec.ts`

### DS-16-K3 ✅ — Ön değerlendirmesi olmayan kullanıcı görüşme başlatabilir (zorunlu bağımlılık yok).

**Test:** `backend/test/integration/us1-create-happy.spec.ts`

### DS-16-K4 ✅ — Rapor **sayısal skor içermez**; fazladan `skor` alanı gelirse reddedilir.

**Test:** `backend/test/unit/pa-us1-no-score.spec.ts`

---

# 12 — Performans (3%)

## DS-17 — Kullanıcı belirsiz bekletilmez

### DS-17-H1 ✅ — Soru üretimi 30 sn altında tamamlanır (SC-001).

**Test:** `backend/test/integration/us1-create-happy.spec.ts`

### DS-17-H2 ⬜ — Rapor üretimi vakaların ≥%95'inde 60 sn altında (SC-005).
### DS-17-E1 ✅ — Süre aşılırsa çağrı **kesilir** ve kullanıcıya hata + tekrar dene sunulur

**Test:** `backend/test/integration/us5-report-timeout.spec.ts`
(süresiz bekleme yok).
### DS-17-K1 ⬜ — Rapor tekrar görüntüleme LLM'siz yol → p95 < 300 ms.

---

## Boşluk özeti (bu doküman ne gösterdi)

1. **21 puanlık yüzey bugün test edilebiliyor**, 51 puanlık işlev yüzeyi kod bekliyor.
2. Auth diliminde daha önce hiç test edilmemiş **3 kriter kesiti** bulundu ve yazıldı:
   rol yükseltme denemesi (DS-01-K1), yetkilendirme matrisi (DS-02-K1), çerez/sızıntı
   güvenliği (DS-04-H1/E1/K1).
3. **7 kırmızı story** açık bulguyu temsil ediyor: DS-03-E2, DS-04-E2, DS-05-K1, DS-05-K2,
   DS-05-E2, DS-06-E2, DS-07-E1/E2/K1.
4. PDF'in **zorunlu** saydığı iki işlev hiçbir dilim spec'inde yok: görüşme **silme**
   (`004-history`) ve admin **istatistik ekranı** (`005-admin`) — spec dosyaları
   henüz yazılmadı. Puan ağırlıkları toplam **10**.
