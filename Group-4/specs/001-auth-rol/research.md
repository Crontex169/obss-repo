# Phase 0 Araştırma: Kimlik Doğrulama & Rol (Auth)

**Dilim**: `001-auth-rol` | **Tarih**: 2026-07-29

Bu belge, Teknik Bağlam'daki bilinmeyenleri ve ADR-0003'te işaret edilen tasarım
noktalarını çözer. Her başlık **Karar / Gerekçe / Değerlendirilen Alternatifler**
biçimindedir. Teknoloji yığını ADR-0001…0003 ile kilitli olduğundan burada yeniden
tartışılmaz; yalnızca bu dilime özgü uygulama kararları netleştirilir.

---

## 1. Better Auth ↔ NestJS Köprü/Adapter Yaklaşımı

- **Karar**: Better Auth örneği bağımsız bir modülde (`better-auth.config.ts`) oluşturulur.
  NestJS'e, `/api/auth/*` yolunu yakalayan bir **catch-all controller** (`better-auth.controller.ts`)
  ile mount edilir. Controller, gelen Nest `Request`'i Web Fetch `Request`'e dönüştürüp
  `auth.handler(request)` çağırır ve dönen `Response`'u Nest `Response`'a yazar. Better Auth
  bu dilimin tüm HTTP uç noktalarını (kayıt, giriş, çıkış, OAuth callback, e-posta doğrulama)
  kendi handler'ı üzerinden sunar.
- **Gerekçe**: Better Auth framework-agnostik bir Web `Request → Response` handler'ı sağlar;
  bunu tek bir köprü ile mount etmek, her uç noktayı elle yeniden yazmaktan çok daha az kod
  ve daha az hata yüzeyi demektir. NestJS'in Guard/DI yapısı korunur; iş uç noktaları (korunan
  kaynaklar) yine normal Nest controller'ları olur ve `SessionGuard` ile Better Auth oturumunu
  doğrular. (ADR-0003 "küçük adapter/köprü" kararıyla birebir uyumlu.)
- **Değerlendirilen Alternatifler**:
  - *Her uç noktayı elle Nest route olarak yazmak*: Better Auth'un hazır özelliklerini
    (OAuth callback, doğrulama token akışı) kaybettirir; reddedildi.
  - *Ayrı bir Express alt-uygulaması olarak mount*: Nest global pipe/guard/exception filter
    entegrasyonunu zorlaştırır; catch-all controller daha temiz.
  - *`body-parser`'ı Better Auth rotaları için devre dışı bırakma*: Web Request gövdesinin
    ham okunabilmesi için Nest'te `/api/auth/*` için raw body veya bodyParser bypass gerekir —
    bu köprüde uygulanacak bilinen bir ayrıntıdır (uygulama notu, engel değil).

---

## 2. Prisma Şema Stratejisi (Better Auth tabloları + role)

- **Karar**: Better Auth CLI (`@better-auth/cli generate`) ile gerekli tablolar
  (`user`, `session`, `account`, `verification`) `schema.prisma`'ya üretilir. `user` modeline
  `role String @default("user")` alanı **admin plugin ÜZERİNDEN DEĞİL**, doğrudan
  `additionalFields` (`better-auth.config.ts`) ile eklenir — admin plugin bu dilimde
  kullanılmaz (kod ile hizalama, bkz. bulgu A8/C1', T081/T093). Migration'lar
  `prisma migrate` ile yönetilir. Prisma Client, Better Auth'un `prismaAdapter`'ına verilir.
- **Gerekçe**: Better Auth'un resmi Prisma adaptörü mevcuttur (ADR-0003). Şemanın CLI ile
  üretilmesi, sürüm uyumunu ve gerekli sütunları garanti eder. `role` alanı, admin plugin'in
  getirdiği `banned`/`banReason`/`banExpires` gibi ek karmaşıklığa ihtiyaç duymadığı için
  hafif bir `additionalFields` girişi olarak tanımlanır; rol claim'i yine oturum/kullanıcı
  nesnesine standart biçimde taşınır.
- **Değerlendirilen Alternatifler**:
  - *Elle şema yazımı*: Better Auth sürümleri sütun bekler; elle yazım kırılgan, CLI tercih edildi.
  - *Ayrı `roles` tablosu (çoktan-çoğa)*: Bu dilimde yalnızca iki rol var (kullanıcı/admin) ve
    kullanıcı-başına-tek-rol yeterli (FR-007); `user.role` enum-benzeri string daha basit.
    Gelecekte gerekirse ayrı tabloya genişletilebilir.
  - *Admin plugin*: `banned`/`banReason`/`banExpires` gibi bu dilimde kullanılmayan alanlar
    getirir; sadece `role` gerektiğinden `additionalFields` yeterli ve daha basit bulundu.

---

## 3. Google OAuth Akışı ve Hesap Bağlama Mantığı

- **Karar**: Google, Better Auth `socialProviders.google` ile yapılandırılır
  (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect URI). Hesap bağlama davranışı:
  - **Önce parola, sonra Google (aynı e-posta)** → Better Auth `account.accountLinking.enabled=true`
    ve `trustedProviders: ["google"]` ile **otomatik aynı hesaba bağlanır** (Google e-postası
    doğrulanmış sayıldığından güvenli). (Hikâye 3, kriter 4 / FR-005.)
  - **Önce Google, sonra parola ile kayıt/giriş (aynı e-posta)** → parola hesabı **oluşturulmaz**;
    sunucu, "Bu e-posta Google ile kayıtlıdır, lütfen Google ile giriş yapın" hatası döndürür ve
    frontend kullanıcıyı Google girişine yönlendirir. Bu, kayıt/giriş servisinde e-postanın
    yalnızca `google` sağlayıcılı bir `account` kaydına sahip olup olmadığı kontrol edilerek
    (parola `account` kaydı yokken) uygulanır. (Hikâye 3, kriter 3.)
  - **Admin + Google** → admin girişi yalnızca e-posta/şifre; admin arayüzünde Google butonu
    sunulmaz ve sunucu, `role='admin'` bir kullanıcıya ait e-posta için Google ile oturum açmayı
    reddeder. (Hikâye 3, kriter 6 / FR-006.)
- **Gerekçe**: Better Auth'un hesap bağlama eklentisi bu iki yönlü kuralı destekler; "trusted
  provider" mekanizması Google'ın doğrulanmış e-postasına güvenerek otomatik bağlamayı güvenli
  kılar. Ters yön (Google→parola engelleme) spec'in açık kararıdır ve servis katmanında
  ek bir kontrolle uygulanır.
- **Değerlendirilen Alternatifler**:
  - *Her iki yönde de otomatik bağlama*: Spec bunu reddediyor (Google ile kayıtlıya parola
    hesabı açılmaz); uygulanmadı.
  - *Hiç otomatik bağlama yok, her zaman hata*: Kullanıcı sürtünmesini artırır; spec önce-parola
    durumunda otomatik bağlamayı istiyor.

---

## 4. E-posta Doğrulama Akışı

- **Karar**: E-posta/şifre kaydında Better Auth `emailAndPassword.requireEmailVerification=true`
  ayarlanır. Kayıt sonrası doğrulama bağlantısı gönderilir; kullanıcı doğrulamadan giriş yapamaz
  (FR-019). Google ile gelen e-posta `emailVerified=true` kabul edilir (ek doğrulama yok).
  Doğrulama token'ı `verification` tablosunda tutulur.
- **Gerekçe**: Better Auth doğrulama token üretimi/kontrolünü hazır sağlar; yalnızca gönderim
  fonksiyonu (`sendVerificationEmail`) sağlanmalıdır.
- **[NETLEŞTİRİLECEK] — Mail gönderim yolu**: Doğrulama e-postasının nasıl gönderileceği
  (SMTP mi, yönetilen mail servisi mi — ör. Resend/SendGrid/Postmark/Nodemailer+SMTP) **bu planda
  kararlaştırılmaz**; ayrı bir **ADR-0008 (Mail gönderim yolu)** ile kararlaştırılacaktır
  (ADR-0003 "Sonuçlar/Etkiler" ile tutarlı). Geliştirme sırasında geçici olarak konsola log /
  MailHog gibi bir local yakalayıcı kullanılabilir; bu geçici çözüm production kararını bağlamaz.

---

## 5. Rol Tabanlı Yetkilendirme (NestJS Guard + role claim)

- **Karar**: İki katman:
  1. `SessionGuard` — her korunan istekte Better Auth oturumunu (`auth.api.getSession`) doğrular,
     `request.user` ve `request.session`'ı doldurur. Oturum yoksa `401`.
  2. `RolesGuard` + `@Roles('admin')` decorator — `request.user.role` claim'ini kontrol eder;
     eşleşmezse `403`. Admin paneli uç noktaları `@Roles('admin')` ile korunur (FR-008/FR-010).
  3. `OwnershipGuard` — kaynak sahibi `userId` ile `request.user.id` karşılaştırması; admin ise
     okuma için baypas edilir (FR-009/FR-010). Bu dilimde korunan gerçek kaynak (görüşme/rapor)
     henüz yok; guard sözleşmesi kurulur ve sonraki dilimlerde kaynaklara uygulanır.
- **Gerekçe**: NestJS Guard + decorator, anayasanın "sunucu tarafı yetki" ilkesini (İlke V,
  FR-011) temiz ve merkezi biçimde uygular (ADR-0002 gerekçesiyle uyumlu). Rol, oturum
  nesnesinden okunduğu için istemciye güvenilmez.
- **Değerlendirilen Alternatifler**:
  - *JWT içine gömülü rol claim (stateless)*: Better Auth veritabanı-destekli oturum kullanır;
    rolü DB'den okumak, oturum açıkken rol değişince (edge case) tutarlılığı kolaylaştırır.
  - *Route-başına elle kontrol*: Tekrarlı ve hataya açık; Guard merkezîleştirir.

---

## 6. Oturum Stratejisi ("Beni hatırla" / session-scoped)

- **Karar**: Better Auth `session.expiresIn` 30 gün (2592000 sn) olarak ayarlanır. Oturum
  çerezi varsayılan olarak 30 günlük `Max-Age` ile yazılır. "Beni hatırla" **işaretlenmezse**
  istemci `rememberMe: false` ile giriş yapar; Better Auth bu durumda çerezi **session-scoped**
  (Max-Age'siz, tarayıcı kapanınca silinen) yazar. Ayrı idle timeout **uygulanmaz** (FR-013).
- **Gerekçe**: Better Auth `rememberMe` parametresini yerel olarak destekler ve çerez ömrünü
  buna göre ayarlar; spec'in iki modlu gereksinimini (30 gün / session-scoped) doğrudan karşılar.
- **Değerlendirilen Alternatifler**:
  - *Her durumda kalıcı çerez + sunucu tarafı kısa TTL*: Spec session-scoped davranış istiyor;
    tarayıcı-kapanınca-sonlanma ancak session çerezi ile sağlanır.

---

## 7. Başarısız Giriş Koruması (Throttling / CAPTCHA)

- **Karar**: Aynı e-posta/hesap için **10 başarısız denemeden sonra** koruma devreye girer
  (FR-017). Uygulama: Better Auth'un yerleşik `rateLimit`'i **IP+path bazlıdır**, e-posta
  bazlı anahtarlama desteklemez; bu yüzden `hooks.before`/`hooks.after` genişleme noktaları
  üzerinden **özel bir e-posta bazlı sayaç** yazılmıştır (`rate-limit.config.ts`, kullanıcı
  kararı 2026-07-30) — eşik aşılınca artan gecikme (throttling) uygulanır. Gerçek CAPTCHA
  entegre edilmemiştir (kapsam dışı); yalnızca sayaç + artan gecikme. **Sabit süreli tam
  hesap kilidi UYGULANMAZ.**
- **Gerekçe**: Spec tam kilit yerine throttling istiyor (FR-017); Better Auth'un hazır
  `rateLimit`'i e-posta anahtarlamayı desteklemediğinden özel sayaç gerekli oldu.
- **[NETLEŞTİRİLECEK] (küçük)**: CAPTCHA sağlayıcısı (Turnstile vs reCAPTCHA) — güvenlik
  açısından throttling tek başına eşiği karşıladığından bloklayıcı değildir; ürün tercihine
  göre uygulama fazında seçilir.
- **Değerlendirilen Alternatifler**:
  - *Sabit süreli hesap kilidi*: Spec açıkça reddediyor (DoS/kullanıcı mağduriyeti riski).

---

## 8. Admin Hesabı Seed/Migration

- **Karar**: Admin hesabı `prisma/seed.ts` ile oluşturulur. E-posta ve şifre **ortam
  değişkenlerinden** (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) okunur; koda gömülmez (FR-018, İlke V).
  Seed, Better Auth'un kayıt/hash API'sini kullanarak kullanıcıyı `role='admin'` ve
  `emailVerified=true` ile yaratır; hesap zaten varsa idempotent davranır (tekrar oluşturmaz).
  Uygulama içinden admin kaydı veya kullanıcı→admin yükseltmesi **yoktur**.
- **Gerekçe**: Seed yaklaşımı, kimlik bilgilerini dışarıda tutar ve tek admin kaynağını
  garanti eder; spec kararıyla birebir.
- **Değerlendirilen Alternatifler**:
  - *İlk kayıt olanı admin yapma*: Öngörülemez ve güvensiz; reddedildi.
  - *Admin kimlik bilgisini migration SQL'ine gömme*: Sır gömme yasağını ihlal eder; reddedildi.

---

## 9. Ortam Değişkenleri (.env.example)

- **Karar**: Aşağıdaki değişkenler `.env.example` ile paylaşılır (gerçek değerler `.env`'de,
  git'e girmez — FR-015):

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | PostgreSQL bağlantısı (local Docker / bulut — yalnızca bu değişir) |
| `BETTER_AUTH_SECRET` | Better Auth imzalama/şifreleme sırrı |
| `BETTER_AUTH_URL` | Backend temel URL (OAuth callback için) |
| `GOOGLE_CLIENT_ID` | Google OAuth istemci kimliği |
| `GOOGLE_CLIENT_SECRET` | Google OAuth istemci sırrı |
| `ADMIN_EMAIL` | Seed admin e-postası |
| `ADMIN_PASSWORD` | Seed admin şifresi |
| `FRONTEND_URL` | CORS/redirect için frontend origin |
| `MAIL_*` | E-posta gönderim yapılandırması — **[NETLEŞTİRİLECEK]** (ADR-0008) |
| `CAPTCHA_*` | CAPTCHA sağlayıcı anahtarları — opsiyonel, throttling yeterli |

- **Gerekçe**: Anayasa V ve FR-015/018 gereği tüm sırlar dışarıdan sağlanır; `.env.example`
  ekip kurulumu için şablon sunar.

---

## Kalan Belirsizlikler Özeti

| Konu | Durum | Çözüm yolu |
|------|-------|-----------|
| Mail gönderim yolu (SMTP/servis) | **[NETLEŞTİRİLECEK]** | Ayrı **ADR-0008**; geliştirmede geçici local yakalayıcı |
| CAPTCHA sağlayıcısı | [NETLEŞTİRİLECEK] (bloklayıcı değil) | Throttling temel; CAPTCHA uygulama fazında |
| Better Auth `/api/auth/*` raw-body bypass | Bilinen uygulama detayı | Köprü controller'da çözülür |

Tüm bloklayıcı NEEDS CLARIFICATION çözülmüştür; kalan iki madde ayrı ADR'ye/uygulama fazına
güvenle ertelenebilir ve bu dilimin tasarımını bloke etmez.
