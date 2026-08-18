# Özellik Spesifikasyonu: Kimlik Doğrulama & Rol (Auth)

**Özellik Dalı (Branch)**: `001-auth-rol`

**Oluşturulma**: 2026-07-29

**Durum**: Taslak

**Girdi**: Kullanıcı açıklaması: "AI destekli Mock Interview uygulamasının ilk dikey dilimi — Kimlik Doğrulama & Rol (Auth): e-posta/şifre ile kayıt ve giriş, Google ile giriş (kullanıcı), yalnızca e-posta/şifre ile admin girişi, kullanıcı/admin rol ayrımı, oturum yönetimi ve yetkilendirme."

---

## Kapsam Notu

Bu spec **yalnızca** Kimlik Doğrulama & Rol dikey dilimini kapsar. Aşağıdakiler **KAPSAM DIŞIDIR** ve ayrı dilimlerde ele alınacaktır:

- Görüşme (mülakat) akışı ve cevaplama
- LLM ile soru üretimi
- Değerlendirme raporu (Teknik / Davranışsal / Genel)
- Admin istatistikleri ve token/maliyet takibi

Bununla birlikte, bu dilimde tanımlanan **kullanıcı (user)** varlığının `id`, `email` ve `role` alanları, sonraki tüm dilimlerin (görüşme sahipliği, admin görünürlüğü, yetkilendirme) veri temelini oluşturur ve bu dilimde kurulması zorunludur.

---

## Kullanıcı Senaryoları & Test *(zorunlu)*

> Not: Kabul kriterleri Türkçe Gherkin biçiminde yazılmıştır — **Diyelim ki** (ön koşul), **Olduğunda** (eylem), **O zaman** (beklenen sonuç). Her hikâye mutlu yol (happy path), sınır durumu (edge) ve hata durumu (error) senaryolarını kapsar.

### Kullanıcı Hikâyesi 1 - E-posta ve Şifre ile Kayıt (Öncelik: P1)

Yeni bir ziyaretçi, e-posta adresi ve şifre belirleyerek bir kullanıcı hesabı oluşturur ve sisteme "kullanıcı" rolüyle dahil olur.

**Neden bu öncelik**: Hesap oluşturma olmadan hiçbir kişiselleştirilmiş özellik (görüşme, rapor, sahiplik) kullanılamaz. Tüm ürünün giriş kapısıdır ve tek başına gösterilebilir değer üretir.

**Bağımsız Test**: Geçerli bir e-posta ve şifre ile kayıt tamamlanıp yeni hesabın oluşturulduğu ve otomatik olarak "kullanıcı" rolü atandığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** kayıtlı olmayan geçerli bir e-posta ve politikaya uygun bir şifre var, **Olduğunda** ziyaretçi kayıt işlemini tamamlar, **O zaman** yeni bir kullanıcı hesabı "kullanıcı" rolüyle oluşturulur ve kullanıcı oturum açmış duruma gelir.
2. **Diyelim ki** girilen e-posta adresi zaten kayıtlı, **Olduğunda** ziyaretçi bu e-posta ile kayıt olmayı dener, **O zaman** sistem kaydı reddeder ve e-postanın zaten kullanımda olduğunu bildiren anlaşılır bir hata mesajı gösterir (mevcut bir hesabın var olup olmadığını gereğinden fazla açığa çıkaracak ayrıntı sızdırmadan). *(edge/error)*
3. **Diyelim ki** girilen e-posta biçimsel olarak geçersiz veya şifre politikayı karşılamıyor, **Olduğunda** ziyaretçi kaydı gönderir, **O zaman** sistem kaydı reddeder ve hangi alanın neden geçersiz olduğunu belirten bir doğrulama hatası gösterir. *(error)*

---

### Kullanıcı Hikâyesi 2 - E-posta ve Şifre ile Giriş / Çıkış (Öncelik: P1)

Kayıtlı bir kullanıcı, e-posta ve şifresiyle oturum açar, sistemi kullanır ve dilediğinde oturumu kapatır.

**Neden bu öncelik**: Kayıt kadar temeldir; kullanıcının hesabına tekrar erişebilmesi ve güvenli çıkış yapabilmesi çekirdek işlevdir.

**Bağımsız Test**: Kayıtlı bir hesapla doğru kimlik bilgileri girilerek oturum açıldığı, ardından çıkış yapıldığında korunan içeriğe erişimin sonlandığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** kayıtlı bir kullanıcı ve doğru kimlik bilgileri var, **Olduğunda** kullanıcı giriş yapar, **O zaman** oturum başlatılır ve kullanıcı kendi içeriğine erişebilir hale gelir.
2. **Diyelim ki** kullanıcı oturum açmış durumda, **Olduğunda** kullanıcı çıkış yapar, **O zaman** oturum sonlandırılır ve korunan sayfalara erişim için yeniden giriş gerekir.
3. **Diyelim ki** kimlik bilgileri hatalı (yanlış şifre veya kayıtlı olmayan e-posta), **Olduğunda** kullanıcı giriş yapmayı dener, **O zaman** sistem girişi reddeder ve hangi alanın hatalı olduğunu açığa çıkarmayan genel bir hata mesajı gösterir. *(error)*
4. **Diyelim ki** aynı hesap/e-posta için ard arda 10 başarısız giriş denemesi yapılıyor, **Olduğunda** deneme eşiği (10) aşılır, **O zaman** sistem sonraki denemeler için CAPTCHA veya artan gecikme (throttling) uygular; sabit süreli tam hesap kilidi UYGULANMAZ. *(edge)*

---

### Kullanıcı Hikâyesi 3 - Google ile Giriş (Öncelik: P2)

Bir kullanıcı, Google hesabını kullanarak (harici kimlik sağlayıcı üzerinden) kayıt olur veya giriş yapar; şifre belirlemesi gerekmez.

**Neden bu öncelik**: Girişi hızlandırır ve sürtünmeyi azaltır, ancak e-posta/şifre akışı olmadan da ürün çalışabildiği için P1 değildir.

**Bağımsız Test**: Google ile ilk kez giriş yapıldığında "kullanıcı" rolüyle bir hesap oluşturulduğu, sonraki girişlerde aynı hesaba bağlanıldığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** ziyaretçi daha önce sistemde hesabı olmayan bir Google hesabına sahip, **Olduğunda** Google ile giriş akışını başarıyla tamamlar, **O zaman** "kullanıcı" rolüyle yeni bir hesap oluşturulur ve kullanıcı oturum açmış duruma gelir.
2. **Diyelim ki** ziyaretçinin Google e-postasıyla eşleşen bir hesabı zaten var, **Olduğunda** Google ile giriş yapar, **O zaman** sistem yeni bir mükerrer hesap oluşturmadan mevcut kullanıcı hesabına bağlar ve oturum açar. *(edge)*
3. **Diyelim ki** bir e-posta adresi daha önce Google ile kayıt olmuş, **Olduğunda** aynı e-posta ile e-posta/şifre **KAYDI** denenir, **O zaman** sistem yeni bir parola hesabı OLUŞTURMAZ; "Bu e-posta Google ile kayıtlıdır, lütfen Google ile giriş yapın" uyarısını gösterir ve kullanıcıyı Google girişine yönlendirir. *(edge/error)* — **Not (FR-014/SC-007 ile sınır):** bu özel uyarı yalnızca KAYIT (sign-up) denemesinde gösterilir; aynı e-postayla e-posta/şifre **GİRİŞİ** (sign-in) denenirse, hesabın var olduğunu/Google'lı olduğunu sızdırmamak için sistem her zaman FR-014/SC-007'deki genel `401` hatasını döner — hesap numaralandırma güvenliği, kayıt-özel bilgilendirmeden önceliklidir.
4. **Diyelim ki** bir e-posta adresi daha önce e-posta/şifre ile kayıt olmuş, **Olduğunda** aynı e-posta ile Google girişi yapılır, **O zaman** sistem otomatik olarak aynı mevcut hesaba bağlanır (mükerrer hesap oluşturmaz). *(edge)*
5. **Diyelim ki** Google giriş akışı kullanıcı tarafından iptal edildi veya sağlayıcıdan hata döndü, **Olduğunda** akış tamamlanamaz, **O zaman** sistem oturum açmadan giriş ekranına anlaşılır bir bilgi mesajıyla geri döner. *(error)*
6. **Diyelim ki** bir admin hesabı mevcut, **Olduğunda** admin Google ile giriş yapmayı dener, **O zaman** sistem admin için Google girişini kabul etmez (admin girişi yalnızca e-posta/şifre iledir). *(edge)*

---

### Kullanıcı Hikâyesi 4 - Admin Girişi (Yalnızca E-posta/Şifre) (Öncelik: P1)

Bir yönetici, yalnızca e-posta ve şifre kullanarak (Google ile giriş olmadan) sisteme "admin" rolüyle giriş yapar ve admin paneline erişir.

**Neden bu öncelik**: Rol ayrımının ve yetkili erişimin doğrulanabilmesi için admin girişi çekirdek gerekliliktir; sonraki admin dilimlerinin kapısıdır.

**Bağımsız Test**: Admin kimlik bilgileriyle giriş yapıldığında "admin" rolüyle oturum açıldığı ve admin paneline erişim kazanıldığı; Google girişinin admin için sunulmadığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** geçerli bir admin hesabı ve doğru kimlik bilgileri var, **Olduğunda** admin e-posta/şifre ile giriş yapar, **O zaman** "admin" rolüyle oturum başlatılır ve admin paneline erişim sağlanır.
2. **Diyelim ki** bir kullanıcı (admin olmayan) oturum açmış, **Olduğunda** admin paneline erişmeye çalışır, **O zaman** sistem erişimi reddeder ve yetkisiz erişim yanıtı döndürür. *(error)* 
3. **Diyelim ki** admin kimlik bilgileri hatalı, **Olduğunda** admin giriş yapmayı dener, **O zaman** sistem girişi reddeder ve genel bir hata mesajı gösterir. *(error)*

---

### Kullanıcı Hikâyesi 5 - Sahiplik ve Rol Tabanlı Yetkilendirme (Öncelik: P1)

Her kullanıcı yalnızca kendi verisine (görüşme/rapor gibi kendisine ait kayıtlara) erişebilir; admin tüm kullanıcıların verisini (okuma amaçlı) görebilir. Yetki kontrolleri sunucu tarafında yapılır.

**Neden bu öncelik**: Gizlilik ve güvenlik açısından kritiktir; anayasanın güvenlik ilkesi gereği sunucu tarafı yetkilendirme zorunludur.

**Bağımsız Test**: Bir kullanıcının başka bir kullanıcının kaydına erişmeye çalıştığında reddedildiği, adminin ise tüm kayıtları okuyabildiği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** iki farklı kullanıcı (A ve B) ve A'ya ait bir kayıt var, **Olduğunda** kullanıcı B, A'nın kaydına erişmeye çalışır, **O zaman** sistem sunucu tarafında erişimi reddeder ve kaydın içeriğini sızdırmaz. *(error)*
2. **Diyelim ki** bir kullanıcı ve kendisine ait bir kayıt var, **Olduğunda** kullanıcı kendi kaydına erişir, **O zaman** sistem erişime izin verir.
3. **Diyelim ki** bir admin ve farklı kullanıcılara ait kayıtlar var, **Olduğunda** admin bu kayıtları görüntüler, **O zaman** sistem tüm kayıtlara okuma erişimi verir.
4. **Diyelim ki** yalnızca istemci tarafı kontrolleri atlatılarak (örneğin doğrudan bir kaynağa istek yapılarak) yetkisiz erişim deneniyor, **Olduğunda** istek sunucuya ulaşır, **O zaman** sunucu tarafı yetki kontrolü isteği reddeder. *(edge/error)*

---

### Kullanıcı Hikâyesi 6 - Oturum Yönetimi ve Sonlanması (Öncelik: P2)

Kullanıcının oturumu, "Beni hatırla" seçildiğinde 30 gün geçerli olur; seçilmediğinde tarayıcı oturumu kapanınca sona erer. Sonlanan oturumla korunan içeriğe erişilemez.

**Neden bu öncelik**: Güvenli oturum yönetimi önemlidir ancak temel giriş/çıkış çalıştıktan sonra ele alınabilir.

**Bağımsız Test**: Oturum süresi dolduğunda korunan bir sayfaya erişimin reddedildiği ve yeniden giriş istendiği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** kullanıcı girişte "Beni hatırla" seçeneğini işaretlemiş, **Olduğunda** kullanıcı 30 gün içinde sisteme döner, **O zaman** oturum hâlâ geçerlidir ve yeniden giriş istenmez.
2. **Diyelim ki** kullanıcı girişte "Beni hatırla" seçeneğini işaretlememiş (session-scoped oturum), **Olduğunda** kullanıcı tarayıcı oturumunu kapatır, **O zaman** oturum sona erer ve korunan içeriğe erişim için yeniden giriş gerekir. *(edge)*
3. **Diyelim ki** "Beni hatırla" ile açılan oturumun 30 günlük yaşam süresi dolmuş, **Olduğunda** kullanıcı korunan bir içeriğe erişmeye çalışır, **O zaman** oturum sonlanmış sayılır ve sistem yeniden giriş ister. *(edge)*

---

### Kullanıcı Hikâyesi 7 - KVKK Aydınlatma ve Açık Onay (Öncelik: P2)

> **Geriye dönük eklendi (2026-08-05).** Bu akış 2026-08-04/05'te implemente edildi ancak
> o sırada spec'e işlenmemişti (Anayasa İlke II sapması). Doküman senkronizasyonunda
> mevcut davranış spec'e alındı; ilgili görevler Faz 12'de kayıtlıdır.

Oturum açan kullanıcı, kişisel verilerinin nasıl işlendiğini anlatan KVKK aydınlatma
metnini görür ve açık onay verir. Onay bir kez alınır ve kalıcı olarak saklanır.

**Neden bu öncelik**: Yasal gereklilik ve kullanıcı şeffaflığı (Anayasa İlke VII); ancak
kimlik doğrulama akışının kendisini bloklamaz, giriş sonrasında devreye girer.

**Bağımsız Test**: Onayı olmayan bir kullanıcı giriş yaptığında popup görünür; onay
verdikten sonra çıkıp tekrar girdiğinde görünmez.

**Kabul Senaryoları**:

1. **Diyelim ki** daha önce KVKK onayı vermemiş bir kullanıcı var, **Olduğunda** kullanıcı giriş yapar, **O zaman** aydınlatma metnini tam olarak içeren onay popup'ı gösterilir. *(happy)*
2. **Diyelim ki** popup açık, **Olduğunda** kullanıcı onay kutusunu işaretlemeden onaylamaya çalışır, **O zaman** onay gönderilmez — kutu varsayılan olarak işaretsizdir ve açık eylem zorunludur. *(error)*
3. **Diyelim ki** kullanıcı onayı verdi, **Olduğunda** çıkış yapıp tekrar giriş yapar, **O zaman** popup **gösterilmez**; onay kaydı kalıcıdır. *(happy)*
4. **Diyelim ki** oturumu olmayan bir istemci onay yazma isteği gönderiyor, **Olduğunda** istek sunucuya ulaşır, **O zaman** `401` döner ve hiçbir kayıt değişmez. *(edge — Anayasa İlke V)*

---

### Sınır Durumları (Edge Cases)

- Aynı e-posta hem e-posta/şifre hem Google ile ilişkilendirilmek istendiğinde ne olur? (Google ile kayıtlı e-postaya parola hesabı oluşturulmaz, kullanıcı Google girişine yönlendirilir; parola ile kayıtlı e-posta Google ile gelince otomatik aynı hesaba bağlanır — bkz. Hikâye 3, kriter 3–4)
- Admin, kullanıcı arayüzündeki Google girişini kullanmaya çalışırsa ne olur? (reddedilir — Hikâye 3, kriter 6)
- Çok sayıda başarısız giriş denemesinde sistem nasıl davranır? (10 denemeden sonra CAPTCHA/artan gecikme — bkz. Hikâye 2, kriter 4)
- Oturumu açık bir kullanıcı çıkış yapmadan uzun süre pasif kalırsa ne olur? ("Beni hatırla" ile 30 gün geçerli; değilse tarayıcı kapanınca sona erer — bkz. Hikâye 6)
- Bir kullanıcının rolü, oturumu açıkken değiştirilirse yetkilendirme nasıl güncellenir? (İstemci tarafında rol önbelleğe alınmaz; her istekte rol sunucuda veritabanından yeniden okunur, bu yüzden değişiklik bir sonraki istekte hemen yansır — bkz. FR-011)
- E-posta/şifre ile kayıt olan kullanıcı, e-postasını doğrulamadan giriş yapamaz (zorunlu doğrulama); Google ile giriş yapan kullanıcının e-postası zaten doğrulanmış sayılır (bkz. FR-019).

## Gereksinimler *(zorunlu)*

### Fonksiyonel Gereksinimler

- **FR-001**: Sistem, ziyaretçilerin e-posta ve şifre ile kullanıcı hesabı oluşturmasına izin VERMELİ ve yeni hesaba varsayılan olarak "kullanıcı" rolü atamalıdır.
- **FR-002**: Sistem, kayıt sırasında e-posta biçimini ve şifrenin politikaya uygunluğunu doğrulamalıdır. Şifre politikası: en az 8 karakter, en az bir harf VE en az bir rakam içermelidir. Geçersiz girdiler anlaşılır hata mesajıyla reddedilir.
- **FR-003**: Sistem, aynı e-posta ile mükerrer hesap oluşturulmasını ENGELLEMELİdir.
- **FR-004**: Sistem, kayıtlı kullanıcıların e-posta ve şifre ile giriş yapmasına izin VERMELİdir.
- **FR-005**: Sistem, kullanıcıların Google (harici kimlik sağlayıcı) ile kayıt olmasına ve giriş yapmasına izin VERMELİdir.
- **FR-006**: Sistem, admin girişini YALNIZCA e-posta ve şifre ile kabul etmeli; admin için Google ile girişi sunmamalı/kabul etmemelidir.
- **FR-007**: Sistem, "kullanıcı" ve "admin" olmak üzere iki rol tanımlamalı ve her hesabı bir rol ile ilişkilendirmelidir.
- **FR-008**: Sistem, admin paneline erişimi YALNIZCA "admin" rolündeki hesaplara vermelidir.
- **FR-009**: Sistem, bir kullanıcının yalnızca kendisine ait veriye (kendi görüşme/rapor kayıtları) erişmesine izin VERMELİ; başka kullanıcıların verisine erişimi reddetmelidir.
- **FR-010**: Sistem, "admin" rolündeki hesaba tüm kullanıcıların verisine OKUMA erişimi vermelidir.
- **FR-011**: Sistem, tüm yetkilendirme kontrollerini sunucu tarafında yapmalı; yalnızca istemci tarafı kontrollere güvenmemelidir. *(Anayasa — Güvenlik ilkesi)*
- **FR-012**: Sistem, başarılı girişte bir oturum başlatmalı ve kullanıcının çıkış (logout) yapmasına izin VERMELİ; çıkışta oturumu sonlandırmalıdır.
- **FR-013**: Sistem, oturum yaşam süresini "Beni hatırla" seçimine göre belirlemelidir: seçiliyse oturum 30 gün geçerli olur; seçili değilse oturum session-scoped'dır ve tarayıcı oturumu kapanınca sona erer. Ayrı bir hareketsizlik (idle) zaman aşımı UYGULANMAZ. Yaşam süresi dolan oturumda yeniden giriş istenir.
- **FR-014**: Sistem, hatalı kimlik bilgisi girişlerinde hangi alanın hatalı olduğunu açığa çıkarmayan genel bir hata mesajı göstermelidir.
- **FR-015**: Sistem, sırları (kimlik sağlayıcı anahtarları, kimlik bilgileri) kaynak koduna gömmemeli; gizli yapılandırma dışarıdan sağlanmalıdır. *(Anayasa — Güvenlik ilkesi)*
- **FR-016**: Sistem, kullanıcı şifrelerini düz metin olarak saklamamalıdır (geri döndürülemez biçimde korunmalıdır).
- **FR-017**: Sistem, aynı hesap/e-posta için 10 başarısız giriş denemesinden sonra CAPTCHA veya artan gecikme (throttling) uygulamalıdır; sabit süreli tam hesap kilidi UYGULANMAZ.
- **FR-018**: Sistem, admin hesabını seed/migration yoluyla önceden tanımlamalıdır; uygulama içinden admin kaydı veya mevcut kullanıcının admine yükseltilmesi DESTEKLENMEZ. Admin kimlik bilgileri koda gömülmez; ortam değişkeni/güvenli yapılandırmadan sağlanır. *(Anayasa — Güvenlik ilkesi)*
- **FR-019**: Sistem, e-posta/şifre ile kayıt olan kullanıcılar için e-posta doğrulamasını ZORUNLU kılmalıdır: kayıt sonrası doğrulama bağlantısı gönderilir ve kullanıcı e-postasını doğrulamadan giriş yapamaz. Google ile giriş yapan kullanıcının e-postası zaten doğrulanmış sayılır ve ek doğrulama gerektirmez.
- **FR-020** *(geriye dönük eklendi, 2026-08-05 — bkz. Faz 12 notu)*: Sistem, oturum açan bir kullanıcıya kişisel verilerinin işlenmesine dair **KVKK aydınlatma metnini** göstermeli ve açık onayını almalıdır. Kurallar:
  - Onay durumu kullanıcı kaydında **kalıcı** olarak tutulur (onay anının zaman damgası); onay verilmemişse alan boştur.
  - Popup **yalnızca onay verilmemiş** kullanıcıya gösterilir; onaydan sonra bir daha görünmez (tek seferlik).
  - Onay **açık eylemle** verilir: metnin tamamı okunabilir olmalı ve kullanıcı bir onay kutusunu işaretlemeden onaylayamamalıdır — varsayılan olarak işaretli gelmez.
  - Onay durumunun okunması ve yazılması **oturum gerektirir**; kullanıcı yalnızca kendi onayını yazabilir. *(Anayasa İlke V — sunucu tarafı yetki)*
  - Google ile giriş dahil **tüm** giriş yolları bu kurala tabidir; onay, kimlik doğrulama yönteminden bağımsızdır.

### Anahtar Varlıklar *(veri içerdiği için dahil edilmiştir)*

- **Kullanıcı (User)**: Sisteme kayıtlı kişiyi temsil eder. Temel alanlar: `id` (benzersiz kimlik), `email` (benzersiz), `role` ("kullanıcı" veya "admin"). Bu üç alan, sonraki dilimlerin (görüşme sahipliği, admin görünürlüğü, yetkilendirme) veri temelidir. Ek olarak kimlik doğrulama için şifre bilgisi (geri döndürülemez biçimde korunan) ve/veya harici kimlik sağlayıcı bağlantısı (Google) ve **KVKK onay zaman damgası** (FR-020; boşsa onay henüz verilmemiştir) tutulur.
- **Rol (Role)**: Bir hesabın yetki düzeyini belirleyen ayrım — "kullanıcı" (yalnızca kendi verisi) ve "admin" (tüm verilere okuma + admin paneli).
- **Oturum (Session)**: Bir kullanıcının kimlik doğrulanmış etkin erişim dönemini temsil eder. Başlangıç, geçerlilik/yaşam süresi ("Beni hatırla" ile 30 gün veya session-scoped) ve sonlanma (çıkış veya süre dolması) durumlarını içerir.
- **Kimlik Sağlayıcı Bağlantısı (Identity Link)**: Bir kullanıcı hesabı ile harici sağlayıcı (Google) hesabı arasındaki ilişkiyi temsil eder; e-posta/şifre dışı giriş için kullanılır.

## Başarı Kriterleri *(zorunlu)*

### Ölçülebilir Sonuçlar

- **SC-001**: Yeni bir ziyaretçi, e-posta ve şifre ile kayıt işlemini 2 dakikanın altında tamamlayabilir.
- **SC-002**: Kayıtlı bir kullanıcı, doğru kimlik bilgileriyle giriş işlemini 30 saniyenin altında tamamlayabilir.
- **SC-003**: Bir kullanıcının başka bir kullanıcının verisine yetkisiz erişim denemelerinin %100'ü reddedilir (sunucu tarafında).
- **SC-004**: Admin olmayan hesapların admin paneline erişim denemelerinin %100'ü reddedilir.
- **SC-005**: Google ile ilk giriş yapan bir kullanıcının hesabı, mükerrer kayıt oluşturulmadan tek seferde oluşturulur (aynı e-posta için birden fazla kullanıcı hesabı oluşmaz).
- **SC-006**: Oturum yaşam süresi/atalet zaman aşımı dolduğunda korunan içeriğe erişim denemelerinin %100'ü reddedilir ve yeniden giriş istenir.
- **SC-007**: Hatalı kimlik bilgisi girişlerinde gösterilen mesajların hiçbiri, hesabın var olup olmadığını veya hangi alanın hatalı olduğunu açığa çıkarmaz.
- **SC-008**: KVKK onayı veren bir kullanıcı, sonraki hiçbir girişinde onay popup'ını tekrar görmez (onay tek seferliktir ve kalıcıdır).

## Varsayımlar

- Kullanıcı ve admin, web tarayıcısı üzerinden ve stabil internet bağlantısıyla erişir.
- Google, kullanıcı tarafı için desteklenen tek harici kimlik sağlayıcıdır; başka sağlayıcılar bu dilimin kapsamı dışındadır.
- Bu dilim yalnızca kimlik doğrulama ve yetkilendirme temelini kurar; korunan asıl içerik (görüşme, rapor) sonraki dilimlerde eklenir. Bu dilimde sahiplik/rol kuralları, gelecekteki kayıtlara uygulanabilecek biçimde tanımlanır.
- Şifre saklama ve oturum güvenliği için endüstri-standart uygulamalar esas alınır (şifre politikası: min. 8 karakter + en az bir harf ve bir rakam; oturum: "Beni hatırla" ile 30 gün, aksi halde session-scoped).
- Önce e-posta/şifre ile kayıtlı bir e-posta, sonradan Google ile giriş yaptığında sistem otomatik olarak aynı mevcut hesaba bağlar (mükerrer hesap oluşturmaz). Bu, makul bir varsayım olarak kabul edilmiştir. Tersi yönde (önce Google ile kayıtlı e-posta) parola hesabı oluşturulmaz; kullanıcı Google girişine yönlendirilir.
- Kullanıcı arayüzü teknoloji yığını anayasa gereği sabittir (React 19 + Vite + TypeScript + Tailwind + shadcn/ui); ancak bu spec teknoloji-bağımsızdır ve yalnızca davranışı tanımlar. Backend/veritabanı/kimlik sağlayıcı seçimleri ADR ile ayrıca gerekçelendirilecektir.

## Netleştirmeler (Clarifications)

### Oturum 2026-07-29

- **S:** Şifre politikası ne olmalı (FR-002)? → **K:** En az 8 karakter; en az bir harf VE en az bir rakam zorunlu.
- **S:** Kayıt sonrası e-posta doğrulaması zorunlu mu (FR-019)? → **K:** Zorunlu. E-posta/şifre ile kayıt olan kullanıcı, e-postasını doğrulamadan (gönderilen bağlantı ile) giriş yapamaz. Google ile giriş zaten doğrulanmış e-posta sağladığından ek doğrulama gerektirmez.
- **S:** İlk admin hesabı nasıl oluşturulur (FR-018)? → **K:** Seed/migration yoluyla önceden tanımlanır; uygulama içinden kayıt veya kullanıcı yükseltme yoktur. Admin kimlik bilgileri koda gömülmez, ortam değişkeni/güvenli yapılandırmadan gelir.
- **S:** Oturum yaşam süresi ve zaman aşımı değerleri ne olmalı (FR-013, Hikâye 6)? → **K:** "Beni hatırla" seçilirse oturum 30 gün geçerli; seçilmezse tarayıcı oturumu kapanınca (session-scoped) sona erer. Ayrı bir hareketsizlik (idle) zaman aşımı yoktur.
- **S:** Başarısız giriş koruması eşiği ve davranışı ne olmalı (FR-017, Hikâye 2)? → **K:** Aynı hesap/e-posta için 10 başarısız denemeden sonra CAPTCHA veya artan gecikme (throttling) devreye girer; sabit süreli tam kilit yoktur.
- **S:** Aynı e-posta hem e-posta/şifre hem Google ile geldiğinde eşleştirme kuralı nedir (Hikâye 3)? → **K:** E-posta daha önce Google ile kayıtlıysa parola **KAYDI** (sign-up) reddedilir; "Bu e-posta Google ile kayıtlıdır, lütfen Google ile giriş yapın" uyarısı gösterilir ve kullanıcı Google girişine yönlendirilir. Ancak aynı e-postayla parola **GİRİŞİ** (sign-in) denenirse, FR-014/SC-007 gereği bu özel mesaj gösterilmez — hesabın var olduğu/Google'lı olduğu sızmasın diye her zaman genel `401` döner (bulgu A1 çözümü). Tersine, önce e-posta/şifre ile kayıtlı bir e-posta Google ile gelirse otomatik olarak aynı hesaba bağlanır (Varsayımlar bölümüne eklendi).
