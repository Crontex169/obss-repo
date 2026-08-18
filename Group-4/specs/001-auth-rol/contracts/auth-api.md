# Sözleşme: Auth HTTP API

**Dilim**: `001-auth-rol` | **Taban yol**: `/api/auth/*` (Better Auth handler, köprü controller)

Bu belge, Better Auth handler'ının bu dilimde sunduğu HTTP uç noktalarını ve bu dilime
özgü davranış kurallarını tanımlar. Uç noktalar Better Auth tarafından üretilir; buradaki
tablo **sözleşme (girdi/çıktı + davranış)** olarak bağlayıcıdır ve entegrasyon testlerine
eşlenir (ATDD, İlke III). Tüm yanıtlar `application/json`; hata mesajları **genel**dir
(FR-014, SC-007 — hangi alanın hatalı olduğunu / hesabın var olup olmadığını sızdırmaz).

---

## 1. Kayıt (E-posta/Şifre)

`POST /api/auth/sign-up/email`

**İstek gövdesi**:
```json
{ "email": "string", "password": "string", "name": "string?" }
```

**Kurallar**:
- `password`: min 8 karakter, ≥1 harf + ≥1 rakam (FR-002).
- `email` benzersiz olmalı (FR-003).
- Başarıda: `User(role="user", emailVerified=false)` oluşturulur; doğrulama e-postası gönderilir.
  Kullanıcı **doğrulamadan giriş yapamaz** (FR-019).
- E-posta yalnızca Google ile kayıtlıysa → **reddet**, kod `ACCOUNT_USE_GOOGLE`, mesaj:
  "Bu e-posta Google ile kayıtlıdır, lütfen Google ile giriş yapın" (Hikâye 3, kriter 3).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200/201` | Hesap oluşturuldu, doğrulama bekleniyor |
| `400` | Geçersiz e-posta veya şifre politikası (hangi alan → genel doğrulama hatası) |
| `409` | E-posta zaten kullanımda (genel mesaj, ayrıntı sızdırmaz) |
| `403` | E-posta Google ile kayıtlı → Google'a yönlendir, kod `ACCOUNT_USE_GOOGLE` |

**Gherkin eşlemesi**: Hikâye 1 kriter 1,2,3; Hikâye 3 kriter 3.

---

## 2. Giriş (E-posta/Şifre)

`POST /api/auth/sign-in/email`

**İstek gövdesi**:
```json
{ "email": "string", "password": "string", "rememberMe": true }
```

**Kurallar**:
- Başarıda: Session oluşturulur; `rememberMe=true` → 30 gün çerez, `false` → session-scoped
  çerez (FR-013).
- `emailVerified=false` ise → **reddet** (FR-019), kod `EMAIL_NOT_VERIFIED`.
- Hatalı kimlik bilgisi → **genel** hata (FR-014); hangi alanın hatalı olduğu açıklanmaz.
- Aynı e-posta için 10 başarısız denemeden sonra → CAPTCHA/throttling (FR-017); tam kilit yok.
- E-posta yalnızca Google ile kayıtlıysa: parola ile giriş **hâlâ genel `401` döner** —
  FR-014/SC-007 gereği hesabın var olduğu/Google'lı olduğu sızdırılmaz (bulgu A1 çözümü).
  Bu e-postayla Google-özel yönlendirme uyarısı yalnızca **KAYIT** denemesinde gösterilir
  (bkz. §1, Hikâye 3 kriter 3).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `200` | Giriş başarılı, oturum çerezi set edildi |
| `401` | Kimlik bilgileri hatalı (genel) |
| `403` | E-posta doğrulanmamış (`EMAIL_NOT_VERIFIED`) |
| `429` | Deneme eşiği aşıldı → throttling/CAPTCHA |

**Gherkin eşlemesi**: Hikâye 2 kriter 1,3,4.

---

## 3. Çıkış (Logout)

`POST /api/auth/sign-out`

- Aktif oturumu sonlandırır (Session silinir), çerez temizlenir.
- Yanıt: `200`. Sonrasında korunan uç noktalar `401` döner (FR-012).

**Gherkin eşlemesi**: Hikâye 2 kriter 2.

---

## 4. Google OAuth

`GET /api/auth/sign-in/social?provider=google` → Google'a yönlendirir.
`GET /api/auth/callback/google` → OAuth dönüş; oturum açar.

**Kurallar**:
- İlk kez → `User(role="user", emailVerified=true)` + `Account(providerId="google")` (kriter 1).
- E-posta zaten (credential ile) kayıtlıysa → **otomatik aynı hesaba bağla** (trusted provider),
  mükerrer hesap oluşturma (kriter 2, 4).
- Kullanıcı iptal / sağlayıcı hatası → oturum açmadan giriş ekranına **bilgi mesajıyla** dön (kriter 5).
- Hedef kullanıcı `role="admin"` ise → Google ile oturumu **reddet** (FR-006, kriter 6).

**Yanıtlar**:
| Durum | Anlam |
|-------|-------|
| `302` | Google'a / geri yönlendirme |
| `200` | Oturum açıldı (bağlandı veya yeni hesap) |
| `4xx` | İptal/hata → giriş ekranına dönüş mesajı |
| `403` | Admin için Google reddedildi |

**Gherkin eşlemesi**: Hikâye 3 kriter 1,2,4,5,6.

---

## 5. E-posta Doğrulama

`POST /api/auth/send-verification-email` — doğrulama bağlantısı gönderir (gönderim yolu
Resend transport'u ile yapılır, bkz. ADR-0008).
`GET /api/auth/verify-email?token=...` — token'ı doğrular, `User.emailVerified=true`.

**Yanıtlar**: `200` doğrulandı / `400` geçersiz-süresi dolmuş token.

**Gherkin eşlemesi**: FR-019, Edge Cases (e-posta doğrulama).

---

## 6. Oturum Bilgisi

`GET /api/auth/get-session` — geçerli oturum + `user` (rol dâhil) döner veya `null`.

- Korunan iş uç noktaları bu oturumu `SessionGuard` ile doğrular. Süresi dolmuş/yok →
  `401` ve yeniden giriş (FR-013, SC-006).

**Gherkin eşlemesi**: Hikâye 6 kriter 1,2,3.

---

## Admin Girişi (Yalnızca E-posta/Şifre)

- Admin, `POST /api/auth/sign-in/email` ile giriş yapar; admin arayüzünde Google butonu
  **sunulmaz** ve sunucu admin için Google'ı reddeder (FR-006).
- Başarıda `role="admin"` oturum → admin paneli uç noktaları erişilebilir (bkz. authz-rules.md).

**Gherkin eşlemesi**: Hikâye 4 kriter 1,3.

---

## Genel Hata Sözleşmesi

- Tüm kimlik hataları **genel** mesaj kullanır; alan/hesap varlığı sızdırılmaz (FR-014, SC-007).
- Sunucu tarafı doğrulama zorunlu; istemci doğrulaması yalnızca UX içindir (FR-011, İlke V).
