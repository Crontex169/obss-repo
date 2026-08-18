# Tasks: Auth UI akışları (v2.pen tasarımının uygulanması)

**Kaynak tasarım**: `v2.pen` (repo dışında; implement oturumunda repoya alınacak)
**Kapsam**: Login (2 adımlı), Register (+ parola güç popup'ı), Şifre Sıfırlama (unuttum → mail → yeni şifre → başarı → login).
**Kapsam dışı**: Dashboard/Admin ekranları, mülakat akışı.

ID'ler `specs/001-auth-rol/tasks.md` (T001–T066) ile çakışmasın diye **T067**'den başlar.

> **Revizyon 2026-08-05** — Bu dosya ilk yazıldığında `006-sifre-sifirlama` dilimi henüz inmemişti; "Mevcut kod durumu" bölümü ve Faz 4'ün tamamı eskimişti. Kod denetimiyle yeniden hizalandı: biten işler `[x]`, kısmi olanların yalnızca kalan kısmı yazıldı. Denetim kanıtları aşağıdaki tabloda.

İlgili dokümanlar: `specs/001-auth-rol/spec.md`, `specs/006-sifre-sifirlama/`, `docs/DECISIONS.md`, `docs/APP_FLOW.md`.

> ⚠️ Orijinal dosya `docs/superpowers/specs/2026-07-30-login-interaction-design-design.md` ve `...-password-strength-popup-design.md` dosyalarına atıf yapıyordu. **Bu dizin repoda yok.** Popup davranışı bu dosyada tanımlanır (Faz 1), ayrı doküman aranmasın.

---

## 0. Kararlar

| # | Karar | Sonucu |
|---|---|---|
| K1 | **E-posta adımı hesap varlığını sormaz.** "Devam et" sadece istemci tarafı format doğrulaması yapar, her durumda şifre adımına geçer. Hesap yoksa şifre gönderildikten sonra genel "E-posta veya şifre hatalı" döner. | User enumeration yok; FR-003/FR-014 ile uyumlu. `check-email` endpoint'i **yazılmayacak**. |
| K2 | **"Hesabını Tamamla" (Google Name Step) ekranı iptal.** Google zaten ad-soyad döndürüyor. | `s1LMf7` ekranı tasarımdan düşürülür. Register kartındaki "Ad Soyad" alanı **kalır**. |
| K3 | **Parola politikasında backend bağlayıcı**: min 8 karakter + en az 1 harf + en az 1 rakam. Popup korunur ama bu kurallara göre güncellenir. | Popup'taki "büyük harf" / "küçük harf" satırları kaldırılır; yüzde yeniden tanımlanır (T074). Backend politikası **değişmez** — tek kaynak `backend/src/auth/hooks/password-policy.ts`. |
| K4 | **Marka rengi mavi `#00A3E0`.** Turuncu `#FF8400` marka rengi değil. | `--color-accent` `#2457e5` → `#00A3E0`. Değişiklik `frontend/src/index.css:32-34` ile sınırlı (aşağıya bak). |
| K5 | **Buton dolgusu `#00A3E0` DEĞİL, `#0077A3`.** | Ölçüm: beyaz metin `#00A3E0` üstünde **2.87:1** — WCAG AA'nın normal metin (4.5:1) ve büyük metin (3:1) eşiklerinin **ikisini de geçmiyor**. `#0077A3` üstünde **5.03:1**, geçiyor. `#00A3E0` marka/vurgu (kenarlık, ikon, grafik, focus ring) rengi olarak kalır; üstüne metin **konmaz**. |

### K4'ün gerçek kapsamı (ölçüldü)

Renk bir token: kod içinde 37 dosyada 73 kullanım var ama **hepsi `var(--color-accent)` üzerinden**. Doğrudan hex yalnızca 3 satırda:

```
frontend/src/index.css:32  --color-accent: #2457e5;
frontend/src/index.css:33  --color-accent-strong: #173fbd;
frontend/src/index.css:34  --color-accent-soft: #eaf0fe;
```

Yani diff 3 satır, görsel etki uygulamanın tamamında. Orijinal T067'nin varsaydığı "shadcn token setine geçiş" ayrı ve çok daha büyük bir iş — K4 ona bağlı değil, bağımsız yapılabilir.

---

## Tasarımdan çıkarılan gerçekler (referans)

### Login — Email Step (`kTTy3`)
`Auth Card` (`l53njv`): 400px, `$bg-base`, radius 16, stroke `#E5E7EB`, padding 32, vertical gap 20, ortalı.
Logo (`Wx1Ke`) → "E-posta" label + input `t87uf3` (fill `$bg-subtle`, radius 8, stroke `#E5E7EB`, padding 10/12, placeholder `ornek@eposta.com`, JetBrains Mono 14) → `Devam et` butonu (`o4lMn`, fill_container) → divider "veya" → Google butonu (`lt0xt`, "Google ile Devam Et") → consent metni (`P7FOYA`) → kartın **dışında** "Hesabın yok mu? **Kayıt Ol**" (`el1XK`).

### Login — Password Step (`Qo625`)
Logo → "kullanici@ornek.com" + **Değiştir** linki (`Eah1a`) → "Şifre" label + input `e6AAz` (space_between, `••••••••`, sağda lucide `eye`) → options satırı: solda "Beni hatırla" checkbox (14x14), sağda "Şifrenizi mi unuttunuz?" → submit (`fT1cS`).

### Register (`R6onVx`)
Logo → "Ad Soyad" (`uVBnj`, placeholder `Adınız Soyadınız`) → "E-posta" → "Şifre" (göz ikonu + `Password Strength Popup` instance `kP2ZR`, focus'ta açılır) → "Şifre Tekrar" (göz ikonu) → submit → divider "veya" → Google butonu → consent **checkbox'ı** (`SXIWo` + "Kullanım Şartları'nı ve Gizlilik Politikası'nı okudum, onaylıyorum.") → kart dışında "Zaten hesabın var mı? **Giriş Yap**" (`WPvLC`).

> Login'de consent düz metin, Register'da **onay kutusu**. Register'da kutu işaretlenmeden submit açılmaz.

### Şifremi Unuttum (`PBGmH`)
Logo → başlık "Şifremi Unuttum" → alt metin "Kayıtlı e-posta adresini gir, sana şifreni sıfırlaman için bir bağlantı gönderelim." → e-posta alanı → submit (`VAb9X`) → "← Girişe Dön" (`e19FK4`).

### Yeni Şifre Belirle (`i5Y9b`)
Logo → "Yeni Şifre Belirle" / "Hesabın için yeni bir şifre belirle." → "Yeni Şifre" (göz + popup instance `ejGVa`) → "Yeni Şifre Tekrar" (göz) → submit (`z8pkoH`).

### Şifren Güncellendi (`WJ6zb`)
Logo → yeşil check rozeti (`ddNse`) → "Şifren Güncellendi" / "Şifren başarıyla değiştirildi. Yeni şifrenle giriş yapabilirsin." → `Go To Login Btn` (`TFQ0E`).

### Password Strength Popup (`lLm5P`, reusable)
"Parola Güvenlik Seviyesi: %N" (her zaman siyah) → pill progress bar (dolu kısım yeşil) → "Parola Gereklilikleri:" → gereklilik satırları (sağlanınca yeşile döner). Input'a **focus** olunca açılır, blur'da kapanır, input kutusunun **üstünde** yüzer (`layoutPosition: absolute`).

---

## Mevcut kod durumu (2026-08-05 denetimi)

**Tasarım sistemi**
- `frontend/src/index.css:15-56`: token seti `--color-*` (shadcn `--primary`/`--card`/`--background` seti **yok**). Accent `#2457e5`.
- Fontlar `index.css:1` Google Fonts: Manrope + Inter + JetBrains Mono. **Geist yok.**
- `frontend/src/components/ui/`: `button`, `card`, `badge`, `select`, `table`, `chart`, `alert-dialog`. **`input`, `label`, `checkbox`, `separator` yok.**
- `frontend/src/lib/ui-styles.ts`: `INPUT_CLASS` + `BUTTON_CLASS` — focus ring var, disabled `opacity-50` (tasarım 0.4), loading spinner yok.

**Auth bileşenleri** (`frontend/src/components/auth/`)
- `auth-card.tsx` — var, `title`/`subtitle`/`footer` propları çalışıyor. Genişlik `max-w-sm` (384px), tasarım 400.
- `login-form.tsx` — **tek adımlı**. E-posta + şifre + "Beni hatırla" aynı ekranda. `step` state'i, "Değiştir", göz ikonu yok. `EMAIL_NOT_VERIFIED` özel dalı ve `ResendVerification` telafisi var.
- `register-form.tsx` — Ad + E-posta + Şifre. **Şifre tekrar, consent checkbox, göz ikonu, güç popup'ı, divider, Google butonu yok.**
- `google-button.tsx` — var, yalnızca `pages/login.tsx:36`'da kullanılıyor.
- `resend-verification.tsx` — var (009 dilimi).
- **Yok**: `password-input.tsx`, `password-strength-popup.tsx`, `lib/password-strength.ts`.

**Sayfalar** (`frontend/src/pages/`)
- `login.tsx` — `AuthCard` + divider + `GoogleButton` + `?error=google_failed` bildirimi. Başarı → `/dashboard` (admin ise `/admin/dashboard`).
- `register.tsx` — `AuthCard`, sade.
- `forgot-password.tsx` — tam: tek tip mesaj, `redirectTo`, "Girişe dön".
- `reset-password.tsx` — token okuma + geçersiz token kartı + "Yeni istek gönder" var. **`AuthCard` kullanmıyor** (inline stil), şifre tekrar ve popup yok, başarıda `window.location.href = '/login'` — "Şifren Güncellendi" ekranı yok.
- `App.tsx` — `/forgot-password` ve `/reset-password` rotaları **var**.

**Backend** — şifre sıfırlama tam çalışıyor
- `better-auth.config.ts` `sendResetPassword` dolu; Google-only hesap için ayrı bilgilendirme dalı var.
- Mailer: ayrı `reset-password-mailer.ts` **yok**; `auth/mail/verification-mailer.ts` içinde `sendPasswordResetEmail`.
- Politika: `auth/hooks/password-policy.ts` tek kaynak; `sign-up.hook.ts` + `reset-password.hook.ts` kullanıyor, `hooks.before` `/reset-password` yolunu kapsıyor.
- Testler: `us-reset-password-{happy,policy,expired-used,session-revoke}.spec.ts` + `us-reset-request-{happy,enumeration,rate-limit,google-only}.spec.ts` (8 dosya).
- **Google girişi hazır** — `socialProviders.google` yapılandırılmış, `us3-*.spec.ts` 7 test dosyası geçiyor. Orijinal T099'un "US3 backend'i henüz yapılmadı" varsayımı geçersiz.

**Frontend testleri** (`frontend/test/`)
- Var: `login-form.test.tsx`, `register-form.test.tsx`, `forgot-password-form.test.tsx`, `resend-verification.test.tsx`, `password-policy-parity.test.ts`, `e2e/auth-flows.spec.ts`.
- Yok: reset formu testi, parola güç fonksiyonu testi, iki adımlı login testi.

**Dokümantasyon**
- `docs/DECISIONS.md` ADR-0011'de bitiyor → ADR-0012/0013 yazılmamış.
- `AI-DEVLOG.md`'de 007 kaydı yok.

---

## Kabul kriterleri (Gherkin)

```gherkin
Senaryo: L1 - iki adımlı giriş
  Diyelim ki /login sayfasındayım
  O halde sadece e-posta alanını görürüm ve "Devam et" butonu pasiftir
  Geçerli bir e-posta girdiğimde buton aktifleşir
  "Devam et"e bastığımda şifre adımını görürüm ve girdiğim e-posta ekranda yazar

Senaryo: L2 - e-postayı değiştirme
  Diyelim ki şifre adımındayım
  "Değiştir"e bastığımda e-posta adımına dönerim ve yazdığım e-posta alanda durur

Senaryo: L3 - kayıtlı olmayan e-posta (K1)
  Diyelim ki hiç kayıtlı olmayan bir e-posta ile şifre adımına geçtim
  Şifre girip gönderdiğimde "E-posta veya şifre hatalı" mesajını görürüm
  Ve mesaj, e-postanın kayıtlı olup olmadığını belli etmez

Senaryo: L4 - beni hatırla        # KARŞILANIYOR (login-form.tsx rememberMe)
  Diyelim ki şifre adımındayım ve "Beni hatırla" işaretli
  Giriş yaptığımda istek rememberMe=true ile gider (US6, 30 gün)

Senaryo: R1 - parola güç popup'ı
  Diyelim ki kayıt sayfasında şifre alanına odaklandım
  O halde alanın üstünde güvenlik popup'ı açılır
  Sağlanan her gereklilik yeşile döner ve yüzde artar
  Alandan çıktığımda popup kapanır

Senaryo: R2 - kayıt doğrulamaları
  Diyelim ki kayıt formundayım
  "Şifre Tekrar" ile "Şifre" eşleşmiyorsa hata görürüm ve gönderemem
  Onay kutusunu işaretlemediysem submit butonu pasiftir
  Zayıf parola gönderirsem backend WEAK_PASSWORD hatası ekranda görünür

Senaryo: R3 - kayıt sonrası        # KARŞILANIYOR (register-form.tsx success görünümü)
  Diyelim ki geçerli bilgilerle kayıt oldum
  O halde "e-postana doğrulama bağlantısı gönderildi" bilgilendirmesini görürüm
  Ve otomatik giriş yapılmaz (requireEmailVerification)

Senaryo: P1 - şifre sıfırlama isteği        # KARŞILANIYOR (forgot-password.tsx + backend)
  Diyelim ki /forgot-password sayfasındayım
  E-posta girip gönderdiğimde, e-posta kayıtlı olsun ya da olmasın aynı mesajı görürüm
  Ve kayıtlıysa sıfırlama bağlantısı içeren bir e-posta gönderilir

Senaryo: P2 - yeni şifre belirleme        # KISMİ: akış çalışıyor, "Şifren Güncellendi" ekranı yok
  Diyelim ki e-postadaki bağlantı ile /reset-password?token=... sayfasını açtım
  Politikaya uyan ve birbiriyle eşleşen iki şifre girip gönderdiğimde
  O halde "Şifren Güncellendi" ekranını görürüm ve oradan /login'e giderim

Senaryo: P3 - geçersiz/süresi dolmuş bağlantı        # KARŞILANIYOR (reset-password.tsx)
  Diyelim ki geçersiz bir token ile /reset-password sayfasını açtım
  Gönderdiğimde "Bağlantı geçersiz veya süresi dolmuş" hatasını ve yeniden istek linkini görürüm
```

---

## Faz 0 — Renk kararı ve temel

- [ ] **T067** `docs/DECISIONS.md` → ADR-0012: **marka rengi `#00A3E0`** (K4) + **buton dolgusu `#0077A3`** (K5). Gerekçe kontrast ölçümüyle yazılır (2.87:1 vs 5.03:1). Kapsam yalnızca `index.css:32-34`; shadcn token setine geçiş bu ADR'nin konusu **değil** (bkz. T105).

- [ ] **T068** [P] `docs/DECISIONS.md` → ADR-0013: **auth akış kararları** (K1, K2, K3). Özellikle K1'in gerekçesi (user enumeration savunması) ve K3'ün sonucu (popup backend politikasına hizalanır).

- [ ] **T105** `frontend/src/index.css:32-34` renk uygulaması:
  - `--color-accent: #00A3E0` (marka/vurgu: kenarlık, ikon, focus ring, grafik)
  - `--color-accent-strong: #0077A3` (buton dolgusu ve hover — **beyaz metin buraya biner**)
  - `--color-accent-soft`: `#00A3E0`'nun açık tonu (öneri `#E0F5FC`)
  - `ui-styles.ts` `BUTTON_CLASS` dolgusu `--color-accent` → `--color-accent-strong` olarak değişir; hover bir ton daha koyu.
  - Kontrol: değişiklikten sonra buton/label çiftinde ölçülen kontrast ≥ 4.5:1. — *bağımlı: T067*

- [ ] **T106** [P] Admin/kullanıcı renk ayrımı (FR-015): admin paneli `--color-admin-accent: #0e7490`. Yeni kullanıcı rengi `#00A3E0` ile aynı aileden — iki panel görsel olarak ayırt edilebilir mi karar ver, değilse admin tonunu kaydır. — *bağımlı: T105*

- [ ] **T069** `frontend/src/index.css`: shadcn/Tailwind 4 `@theme` token setine geçiş (`--background`, `--foreground`, `--card`, `--border`, `--input`, `--primary`, `--muted-foreground`, `--destructive`) ki `bg-card`, `text-muted-foreground`, `border-input` sınıfları üretilsin. Dark tema değerleri de yazılsın (aktifleştirme sonraki dilime bırakılabilir). Mevcut `--color-*` seti bu geçişte emekliye ayrılır — 37 dosyada 73 kullanım var, tek seferde değil bileşen bileşen taşınır. — *bağımlı: T105*

- [ ] **T070** [P] Geist fontunu ekle (buton/gövde). JetBrains Mono zaten yüklü (`index.css:1`); Inter/Manrope'un yerini Geist alacaksa `--font-body`/`--font-display` eşlemesi de güncellenir.

- [ ] **T071** [P] Eksik shadcn primitive'leri: `npx shadcn@latest add input label checkbox separator` (`button`, `card` zaten var). `Button` varyantı tasarımdaki ölçüye denk gelsin (yükseklik 38, padding 10/20, radius 8, label 14px/600).

- [x] **T072** `frontend/src/components/auth/auth-card.tsx` — **YAPILDI**. `title`/`subtitle`/`footer` propları çalışıyor, logo üstte, sayfa ortalı.
  - [ ] Kalan: genişlik `max-w-sm` (384px) → 400px; kart içi dikey boşluk tasarımdaki 20px'e hizalansın.

- [ ] **T073** `frontend/src/components/auth/password-input.tsx`: göz ikonu (lucide `eye` / `eye-off`) ile `password ↔ text` toggle'ı yapan tek bileşen. 5 yerde kullanılacak (Login şifre, Register şifre + tekrar, Reset yeni şifre + tekrar). Toggle `type="button"`, `aria-label` "Şifreyi göster/gizle", `aria-pressed`. Ayrı `Input` varyantı yazma — `Input` + sağda konumlanmış buton yeterli. — *bağımlı: T071*

---

## Faz 1 — Parola güç popup'ı (paylaşılan, K3'e göre)

> Orijinal T074 `docs/superpowers/specs/...` dosyasını güncellemeyi söylüyordu; **o dizin repoda yok**. Davranış tanımı buraya taşındı.

- [ ] **T074** Popup davranış tanımı (bu dosyada kanonik):
  - Gereklilikler backend politikasıyla **birebir**: **En az 8 karakter**, **En az 1 harf**, **En az 1 rakam**. ("büyük harf"/"küçük harf" satırları yok.) Kaynak: `backend/src/auth/hooks/password-policy.ts`.
  - Yüzde: her sağlanan gereklilik **%25** (3 kural = %75); üçü de sağlandıktan **sonra** parola 12+ karakterse **%100**. Bonus, üç kural tamamlanmadan uygulanmaz.
  - Başlık her zaman siyah, progress bar pill + dolu kısmı yeşil, focus'ta açılır blur'da kapanır, input'un üstünde yüzer.

- [ ] **T075** `.pen` içinde `lLm5P` component'ini T074'e göre güncelle: `N4ntW` ("En az 1 büyük harf") ve `xkqni` ("En az 1 küçük harf") satırlarını sil, `C4bfIw` metnini "En az 8 karakter", `Dpm4k`'yi "En az 1 rakam" yap, "En az 1 harf" satırı ekle; örnek yüzdeyi %50'ye çek ve progress fill genişliğini ona göre ayarla. **Ayrıca**: `R6onVx/kP2ZR` ve `i5Y9b/ejGVa` instance'ları `fully clipped` — kart `clip` ayarı ya da popup konumu düzeltilsin. — *bağımlı: T074, .pen repoya alınması*

- [ ] **T076** `frontend/test/password-strength.test.ts` (vitest, **kırmızı**): 0/1/2/3 kural için %0/%25/%50/%75; üç kural + 12 karakter → %100; üç kural + 11 karakter → %75; yalnızca küçük harften oluşan 20 karakterlik parola → %50. Her kuralın bağımsız `true/false` döndüğü de test edilir.
  - Not: `test/password-policy-parity.test.ts` istemci/sunucu politika eşitliğini zaten koruyor; yeni fonksiyon da aynı kaynağı yansıtmalı.

- [ ] **T077** `frontend/src/lib/password-strength.ts` (saf fonksiyon: `{ percent, rules: {minLength, hasLetter, hasDigit} }`) + `frontend/src/components/auth/password-strength-popup.tsx` (focus'ta açılan, absolute konumlu popup). Kural değişirse `password-policy.ts` ile birlikte değişmesi gerektiği yorum olarak yazılır. — *bağımlı: T076*

---

## Faz 2 — Login (iki adımlı akış)

- [ ] **T078** `frontend/test/login-flow.test.tsx` (vitest, **kırmızı**): L1–L3 + göz toggle'ı + loading state'inde buton disabled/spinner + hata mesajının `role="alert"` ile duyurulması + `aria-invalid`. `authClient` mocklanır. **E-posta adımında hiçbir ağ isteği atılmadığı** ayrıca assert edilir (K1). Mevcut `test/login-form.test.tsx` tek adımlı formu test ediyor — iki adıma geçince güncellenir, silinmez (L4/rememberMe kapsamı orada).

- [ ] **T079** [P] `frontend/test/e2e/auth-flows.spec.ts`'e iki adımlı senaryoyu ekle (yeni dosya açma — mevcut auth e2e dosyası bu): `/login` → e-posta → devam → şifre → yönlenme; yanlış şifre → hata görünür, adım geri sarmaz.

- [ ] **T080** `login-form.tsx`'i yeniden yaz: `step: 'email' | 'password'`, e-posta değeri adımlar arası korunur, "Değiştir" adımı geri alır. Adım geçişi tamamen client-side (K1). Mevcut `EMAIL_NOT_VERIFIED` dalı ve `ResendVerification` telafisi **korunur**. — *bağımlı: T072, T073, T078*

- [ ] **T081** Email step görünümü: logo, e-posta alanı, `Devam et` (fill_container, geçersiz e-postada disabled), divider "veya", Google butonu, consent **metni**, kart dışında "Hesabın yok mu? Kayıt Ol". Divider + `GoogleButton` şu an `pages/login.tsx:32-36`'da — form içine, e-posta adımına taşınır. — *bağımlı: T080*

- [ ] **T082** Password step görünümü: logo, girilen e-posta + "Değiştir", `PasswordInput`, options satırı (solda "Beni hatırla" checkbox, sağda "Şifrenizi mi unuttunuz?" → `/forgot-password`), submit. "Beni hatırla" ve "Şifremi unuttum" bugün formda var, bu satıra yeniden yerleşecek. — *bağımlı: T080, T073*

- [ ] **T083** Input ve buton state'leri (tüm auth ekranları, `ui-styles.ts` üzerinden): input default `border-input`, focus `ring-2` + accent, error `border-destructive` + altında 12px mesaj (`aria-invalid` + `aria-describedby`); buton disabled `opacity-40` (bugün 0.5), loading = `loader-2 animate-spin` + `aria-busy` + disabled (bugün yalnızca metin değişiyor). — *bağımlı: T071*

- [ ] **T084** `pages/login.tsx` bağlama tamamlama: `429`/`TOO_MANY_ATTEMPTS` → "Çok fazla deneme yapıldı, biraz sonra tekrar deneyin" eşlemesi ekle (bugün yok). 401 tek tip mesaj backend'den geliyor — sabitlenecek mi karar ver. Başarı yönlendirmesi `/dashboard` (admin `/admin/dashboard`) **korunur**; tasarımdaki `/` geçersiz. — *bağımlı: T081, T082, T083*

---

## Faz 3 — Register

- [ ] **T085** `frontend/test/register-form.test.tsx`'i genişlet (**kırmızı**): popup focus'ta açılır/blur'da kapanır, gereklilik satırları ve yüzde girdiye göre güncellenir, şifre≠şifre tekrar → hata + submit engeli, consent kutusu işaretsizken submit disabled, `WEAK_PASSWORD`/`ACCOUNT_EXISTS`/`ACCOUNT_USE_GOOGLE` ekranda görünür.

- [ ] **T086** [P] `frontend/test/e2e/auth-flows.spec.ts`: kayıt → doğrulama bilgilendirme ekranı senaryosu (`// S1 / FR-002, FR-019`).

- [ ] **T087** `register-form.tsx`: Şifre alanına `PasswordInput` + `PasswordStrengthPopup`, altına "Şifre Tekrar" (`PasswordInput`, eşleşme kontrolü client-side). Ad Soyad ve başarı görünümü **korunur**. — *bağımlı: T072, T073, T077, T085*

- [ ] **T088** Register kartının alt bloğu: divider "veya", `GoogleButton` (bugün yalnızca login'de), consent **checkbox'ı** (işaretlenmeden submit disabled). "Zaten hesabın var mı? Giriş Yap" footer'ı `pages/register.tsx`'te zaten var. — *bağımlı: T087*

- [ ] **T089** Register hata eşlemesi: bugün `signUpError.message` doğrudan basılıyor. Kod bazlı eşlemeye çevir — `ACCOUNT_EXISTS` → "Kayıt tamamlanamadı" (alan sızdırmadan), `ACCOUNT_USE_GOOGLE` → "Bu e-posta Google ile kayıtlı, Google ile giriş yapın", `WEAK_PASSWORD` → backend mesajı alanın altında. — *bağımlı: T087*

- [x] **T090** `pages/register.tsx` `AuthCard` ile — **YAPILDI**. Inline stil yok.

---

## Faz 4 — Şifre sıfırlama

> **Bu faz büyük ölçüde `006-sifre-sifirlama` dilimiyle tamamlandı.** Kalan iş yalnızca UI cilası.

- [x] **T091** Backend testleri — **YAPILDI**, farklı isimle: `us-reset-password-{happy,policy,expired-used,session-revoke}.spec.ts` + `us-reset-request-{happy,enumeration,rate-limit,google-only}.spec.ts`. Enumeration, politika, süresi dolmuş token, oturum iptali kapsanıyor.

- [x] **T092** Sıfırlama maili — **YAPILDI**, farklı yerde: ayrı `reset-password-mailer.ts` yok, `auth/mail/verification-mailer.ts` içinde `sendPasswordResetEmail` (aynı Resend/console transport'u paylaşıyor — ADR-0008). `better-auth.config.ts` `sendResetPassword` bunu çağırıyor, Google-only hesap için ayrı bilgilendirme dalı var. Ayrı dosyaya bölmeye gerek yok.

- [x] **T093** `/reset-password` politika kapsaması — **YAPILDI**. `auth/hooks/reset-password.hook.ts`, `hooks.before` içinde çağrılıyor; `password-policy.ts` tek kaynak.

- [ ] **T094** `frontend/test/reset-password.test.tsx` (vitest, **kırmızı**): reset formu token'ı query'den okur, iki şifre eşleşmezse hata, popup çalışır, başarı ekranına geçer. `forgot-password-form.test.tsx` zaten var, tekrarlanmaz.

- [x] **T095** `pages/forgot-password.tsx` — **YAPILDI**. Tek tip mesaj, `redirectTo`, "Girişe dön" linki.

- [x] **T096** `pages/reset-password.tsx` — **KISMEN**. Token okuma, geçersiz token kartı, "Yeni istek gönder" linki var.
  - [ ] Kalan: `AuthCard`'a taşı (bugün inline stil, `rounded-xl bg-white p-8`), "Yeni Şifre Tekrar" alanı ekle, `PasswordInput` + popup bağla. — *bağımlı: T072, T073, T077, T094*

- [ ] **T097** Başarı ekranı (`WJ6zb`): yeşil check rozeti + "Şifren Güncellendi" + alt metin + "Giriş Yap" butonu → `/login`. Bugün `reset-password.tsx` başarıda doğrudan `window.location.href = '/login'` yapıyor; `status === 'success'` görünümüne çevrilir (ekstra rota yok). — *bağımlı: T096*

- [x] **T098** `App.tsx` rotaları — **YAPILDI**. `/forgot-password` ve `/reset-password` tanımlı.

---

## Faz 5 — Google, tasarım temizliği, kapanış

- [x] **T099** Google butonu — **KISMEN**. `google-button.tsx` var, `authClient.signIn.social` bağlı, **US3 backend'i hazır** (`socialProviders.google` + `us3-*.spec.ts` 7 dosya). `pages/login.tsx:36`'da render ediliyor, iptal/hata dönüşü `?error=google_failed` ile karşılanıyor.
  - [ ] Kalan: Register kartına da ekle (T088). K2 gereği ayrı ad-soyad adımı yok; Google `name` boş dönerse kayıt reddedilmez.

- [ ] **T100** [P] `.pen` temizliği: `s1LMf7` ("Screen - Register (Google Name Step)") ekranını K2 gereği sil ya da `[İPTAL]` işaretle; Design System'deki Input/Button state swatch'ları T083'teki son hâlle tutarlı mı kontrol et. — *bağımlı: .pen repoya alınması*

- [ ] **T101** [P] Erişilebilirlik geçişi (5 ekran): gerçek `<form>` + `<label htmlFor>` (bugün `sr-only` label'lar var, temel sağlanıyor), adım/sayfa değişiminde odak ilk alana taşınır, hatalar `role="alert"` + `aria-live="polite"` (bugün düz `<p>`), göz toggle'ı ve checkbox'lar klavyeyle erişilebilir, consent metninin AA kontrastı doğrulanır. — *bağımlı: T081–T084, T087–T090, T095–T097*

- [ ] **T102** Tüm kırmızı testleri yeşile çevir: `cd backend && npm run test:integration`, `cd frontend && npm run test && npm run test:e2e`, iki tarafta `npm run lint`. Testi gevşetmeden düzelt.

- [ ] **T103** `specs/001-auth-rol/tasks.md`'den bu dosyaya referans ver. **Not**: orijinal task "şifre sıfırlamayı 001'e yeni FR olarak ekle" diyordu — geçersiz, sıfırlama `specs/006-sifre-sifirlama/` altında ayrı dilim olarak specli.

- [ ] **T104** `AI-DEVLOG.md`: bu oturum (hangi AI aracı/model, `.pen` okuma, K1–K5 kararları, kontrast ölçümü) — anayasa gereği eşzamanlı yazılır.

---

## Bağımlılık haritası

```
Renk:     T067 ──> T105 ──> T106
Token:    T105 ──> T069 ──> [tüm ekranlar]
Temel:    T068, T070, T071 [paralel] ; T071 ──> T073, T083
Popup:    T074 ──> T075, (T076 ──> T077)

Login:    T078,T079 (kırmızı) ──> T080 ──> T081,T082 ──> T084
Register: T085,T086 (kırmızı) ──> T087 ──> T088,T089
Reset:    T094 (kırmızı) ──> T096 ──> T097          # T091,T092,T093,T095,T098 bitti
Google:   T099 kalanı ──> T088 ile birlikte
Kapanış:  T101 ──> T102 ──> T103 ──> T104
```

Paralel gruplar: **T068+T070+T071**, **T078+T079**, **T085+T086**, **T100+T101**.

**Kritik yol**: T067 → T105 → T071/T073 → T080 → T081/T082 → T084. Renk kararı uygulanmadan hiçbir ekran son hâline getirilmemeli, yoksa iki kez elden geçer.
