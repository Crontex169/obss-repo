# Feature Specification: Admin Paneli (Görüşme İzleme & İstatistikler)

**Feature Branch**: `005-admin`

**Created**: 2026-08-03

**Status**: Draft

**Input**: User description: "Admin tarafı — tüm kullanıcıların görüşmelerini meslek bazında
filtreleyerek listeleme, herhangi bir görüşmenin sorular/cevaplar/rapor/token-maliyet
detayını görüntüleme (kullanıcı tarafından silinmiş olsa bile 'silindi' etiketiyle),
ve meslek bazlı sayı / ortalama görüşme süresi / tamamlanma oranı / token zaman serisi
gösteren bir istatistik ekranı. Admin salt-okunurdur; hiçbir kaydı değiştiremez veya
kalıcı silemez. Rol tabanlı erişim `001-auth-rol`'de kurulmuştur, bu dilim yalnızca
admin'e özel ekranları ve okuma uç noktalarını kapsar. Şema sahipliği bu dilimde
değildir: `User` (`001-auth-rol`), `Interview`/`Question`/`Answer`/`Report`
(`002-interview`), `TokenUsage` (`003-pre-assessment` tasarımı, `002-interview`
migration'ı) tabloları salt-okunur biçimde tüketilir. `004-history`'nin kullanıcı
tarafı soft-delete akışıyla çakışmaz; admin görünürlüğü `Interview.deletedAt` alanını
yalnızca **okur**, yazmaz."

## Clarifications

### Session 2026-08-03

- Q: Admin istatistik ekranındaki toplamlara (meslek bazlı sayı, ortalama süre, tamamlanma oranı, toplam token) kullanıcı tarafından silinmiş (soft-delete) görüşmeler dahil edilmeli mi? → A: Dahil edilir — istatistikler tüm görüşmeleri (silinmiş dahil) kapsar, tam denetim şeffaflığı sağlanır.
- Q: Admin görüşme listesinde ve detayında, görüşme sahibi kullanıcı hangi kimlik bilgisiyle gösterilmeli? → A: E-posta gösterilir (admin zaten tüm kullanıcı verisine okuma erişimine sahiptir, `001-auth-rol/contracts/authz-rules.md` R3).
- Q: Token tüketimi zaman serisi grafiğinde varsayılan granülarite ne olmalı? → A: Günlük granülarite, son 30 günlük varsayılan pencere.
- Q: Admin görüşme listesinde varsayılan sayfa boyutu kaç kayıt olmalı? → A: 20 kayıt/sayfa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tüm görüşmeleri meslek bazında listeleme (Priority: P1)

Admin, sisteme giriş yaptıktan sonra tüm kullanıcılara ait görüşmeleri tek bir listede
görür ve bu listeyi meslek/pozisyon alanına göre filtreleyebilir. Kullanıcı tarafından
silinmiş görüşmeler listeden düşmez; "silindi" etiketiyle görünür kalır.

**Why this priority**: Admin panelinin temel değeri budur — gözetim ve şeffaflık
olmadan diğer ekranların (detay, istatistik) bir anlamı yoktur. Bu hikaye tek başına
çalışır bir MVP oluşturur.

**Independent Test**: Farklı kullanıcılara ait, farklı mesleklerde ve farklı durumlarda
(tamamlandı/yarım/silinmiş) birkaç görüşme oluşturularak admin listesinin doğru
sayıda, doğru sırada ve doğru etiketlerle geldiği; meslek filtresi uygulandığında
yalnızca eşleşen kayıtların döndüğü doğrulanarak bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** sistemde birden fazla kullanıcıya ait tamamlanmış, yarım kalmış ve
   kullanıcı tarafından silinmiş görüşmeler var, **Olduğunda** admin görüşme listesini
   açar, **O zaman** tüm görüşmeler (silinmiş dahil) görünür ve her biri sahibinin
   e-posta adresi, pozisyon, tarih ve durum rozetiyle listelenir.
2. **Diyelim ki** admin listede belirli bir meslek/pozisyon değeri için filtre
   uygular, **Olduğunda** filtre uygulanır, **O zaman** yalnızca o mesleğe ait
   görüşmeler listelenir ve diğerleri gizlenir.
3. **Diyelim ki** bir görüşme kullanıcı tarafından silinmiş, **Olduğunda** admin
   listeyi görüntüler, **O zaman** o kayıt "silindi" etiketiyle birlikte ama veri
   kaybı olmadan listede kalır.
4. **Diyelim ki** oturum açmış bir admin kullanıcısı yok (anonim veya rol=`user`),
   **Olduğunda** admin listesi uç noktasına erişim denenir, **O zaman** istek
   reddedilir (sırasıyla `401`/`403`) ve hiçbir veri sızmaz.

---

### User Story 2 - Görüşme detayını inceleme (Priority: P2)

Admin, listeden seçtiği herhangi bir görüşmenin sorularını, verilen cevapları,
oluşturulan değerlendirme raporunu ve bu görüşmeye ait token/maliyet bilgisini
görüntüler; kayıt silinmiş olsa bile içerik eksiksiz görünür.

**Why this priority**: Listeleme "ne var" sorusunu, detay ekranı "ne oldu" sorusunu
yanıtlar — denetim ve destek senaryoları için gereklidir. Listeleme (P1) olmadan
anlamsızdır, bu yüzden ikinci sıradadır.

**Independent Test**: Sorusu/cevabı/raporu olan bir görüşme + ayrı bir "rapor henüz
üretilemedi/başarısız" durumundaki görüşme hazırlanarak, admin detay ekranının her iki
durumda da (tamamlanmış rapor ve eksik/başarısız rapor) doğru içerik gösterdiği ve
token/maliyet toplamının doğru hesaplandığı bağımsız doğrulanabilir.

**Acceptance Scenarios**:

1. **Diyelim ki** raporu tamamlanmış bir görüşme var, **Olduğunda** admin bu
   görüşmenin detayını açar, **O zaman** tüm sorular, verilen cevaplar, rapor
   (Teknik/Davranışsal/Genel skorları + metin) ve bu görüşmeye ait toplam
   token/maliyet bilgisi görüntülenir.
2. **Diyelim ki** görüşmenin raporu henüz üretilmemiş veya üretimi başarısız olmuş,
   **Olduğunda** admin detayı açar, **O zaman** sorular/cevaplar yine görünür,
   rapor bölümünde ise durum açıkça belirtilir (ör. "rapor yok" / "üretim başarısız"),
   hata teknik detayı sızdırılmaz.
3. **Diyelim ki** görüşme kullanıcı tarafından silinmiş, **Olduğunda** admin bu
   kaydın detayına girer, **O zaman** "silindi" durumu görünür ama tüm içerik
   (soru/cevap/rapor/maliyet) eksiksiz kalır.
4. **Diyelim ki** admin bir görüşme kaydını düzenlemeye veya silmeye çalışır (ör.
   doğrudan API çağrısıyla), **Olduğunda** böyle bir istek gönderilir, **O zaman**
   istek reddedilir (`403`) — admin panel bu veriler üzerinde yalnızca okuma
   yetkisine sahiptir.

---

### User Story 3 - Genel istatistikleri görüntüleme (Priority: P3)

Admin, tüm sistemdeki görüşmelere dair özet istatistikleri (meslek bazlı görüşme
sayısı, ortalama görüşme süresi, tamamlanan/yarım kalan oranı, zaman içindeki toplam
token tüketimi) tek bir ekranda görür.

**Why this priority**: Tekil kayıt incelemesinin (P1/P2) ötesinde sistemin genel
sağlığını ve kullanım eğilimini gösterir; MVP'nin çalışması P1/P2'ye bağlı değildir,
bu yüzden en düşük öncelikli fakat yine de MVP kapsamındadır (`docs/PLAN.md`).

**Independent Test**: Bilinen sayıda görüşme (farklı meslek, durum, tamamlanma süresi
ve token tüketimiyle) veritabanına hazırlanarak istatistik ekranının her metriği
(sayı, ortalama süre, oran, toplam token) elle hesaplanan beklenen değerlerle
karşılaştırılarak bağımsız doğrulanabilir.

**Acceptance Scenarios**:

1. **Diyelim ki** sistemde birden fazla meslekte tamamlanmış, yarım kalmış ve
   kullanıcı tarafından silinmiş görüşmeler var, **Olduğunda** admin istatistik
   ekranını açar, **O zaman** meslek başına görüşme sayısı, ortalama görüşme süresi
   ve tamamlanma/yarım kalma oranı — silinmiş görüşmeler dahil — gerçek verilerle
   birebir tutarlı gösterilir.
2. **Diyelim ki** farklı tarihlerde gerçekleşmiş LLM çağrıları (token tüketimi) var,
   **Olduğunda** admin istatistik ekranını açar, **O zaman** toplam token tüketimi
   günlük granülaritede, varsayılan son 30 günlük pencerede zaman serisi olarak
   görüntülenir ve toplam, tüm kayıtların toplamıyla eşleşir.
3. **Diyelim ki** sistemde henüz hiç görüşme yok, **Olduğunda** admin istatistik
   ekranını açar, **O zaman** hata vermeden "veri yok" durumunu ifade eden boş/sıfır
   değerli bir görünüm sunulur.

---

### Edge Cases

- Bir görüşmenin `position` (meslek) alanı boş/`null` ise (ilandan çıkarılamadıysa)
  hem listede hem istatistiklerde "Belirsiz" adlı ayrı bir kova altında gösterilir;
  sessizce göz ardı edilmez.
- Aynı anda çok sayıda görüşme kaydı olduğunda liste 20'şer kayıtlık sayfalar
  halinde gösterilir; admin performans kaybı yaşamadan gezinebilir.
- Bir kullanıcı hesabı tamamen silinirse (gelecekte eklenebilecek bir "hesap silme"
  özelliği), o kullanıcıya ait görüşmeler admin tarafında nasıl gösterileceği bu
  dilimin kapsamı dışındadır (bkz. Assumptions — hesap silme MVP'de yok).
- Admin, kendi rolüne ait olmayan bir yazma/silme isteği gönderirse (ör. tarayıcı
  geliştirici araçlarıyla doğrudan API çağrısı) sunucu tarafında reddedilir; istemci
  tarafı gizleme (buton olmaması) tek başına yeterli kabul edilmez.
- Token/maliyet kaydı bir görüşme için hiç oluşmamışsa (ör. LLM çağrısı sırasında
  loglama başarısız olduysa, bkz. `003-pre-assessment` FR), detay ekranında
  "maliyet bilgisi yok" olarak gösterilir, hata fırlatılmaz.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistem, admin'e özel tüm listeleme/detay/istatistik uç noktalarına
  erişimi yalnızca `role="admin"` oturumuyla sınırlamalıdır; oturumsuz istek `401`,
  rolü yetersiz oturum `403` almalıdır (`001-auth-rol` `authz-rules.md` R1, R3).
- **FR-002**: Sistem, admin'e tüm kullanıcılara ait tüm görüşmeleri tek bir listede
  sunmalı; her kayıt en az sahibinin **e-posta adresini** (`User.email`),
  pozisyon/meslek, oluşturulma tarihi, durum (tamamlandı/yarım kaldı) ve silinme
  durumu bilgisini içermelidir.
- **FR-003**: Sistem, admin görüşme listesinin meslek/pozisyon alanına göre
  filtrelenmesine izin vermelidir; pozisyonu belirlenemeyen kayıtlar ayrı bir
  "Belirsiz" filtre değeriyle erişilebilir olmalıdır.
- **FR-004**: Sistem, kullanıcı tarafından soft-delete edilmiş (`deletedAt` dolu)
  görüşmeleri admin listesinden **gizlememeli**; bu kayıtlar "silindi" durumuyla
  birlikte, verisi eksiksiz biçimde görünür kalmalıdır.
- **FR-005**: Sistem, admin'in seçtiği herhangi bir görüşmenin tüm sorularını,
  verilen cevaplarını ve (varsa) değerlendirme raporunu (Teknik/Davranışsal/Genel
  skorları + metinsel geri bildirim) eksiksiz görüntülemesine izin vermelidir —
  görüşme sahibi kim olursa olsun ve silinmiş olsa dahi.
- **FR-006**: Sistem, rapor henüz üretilmemiş veya üretimi başarısız olmuş
  görüşmelerde bu durumu admin'e açıkça belirtmeli, iç hata detayını (sağlayıcı
  yanıtı, stack trace vb.) sızdırmamalıdır (`docs/API_CONVENTIONS.md` §2).
- **FR-007**: Sistem, admin'in görüşme detayında o görüşmeye ait toplam token
  tüketimi ve hesaplanan maliyeti görüntülemesine izin vermelidir; ilgili kayıt
  yoksa (loglama başarısız olduysa) "maliyet bilgisi yok" biçiminde zarif bir
  durum gösterilmelidir.
- **FR-008**: Sistem, admin panelinde görüşme/rapor/kullanıcı verisi üzerinde
  **hiçbir yazma, güncelleme veya kalıcı silme işlemine izin vermemelidir**; böyle
  bir istek `403` ile reddedilmelidir (salt-okunur ilke, `authz-rules.md` R3).
- **FR-009**: Sistem, admin'e meslek/pozisyon başına toplam görüşme sayısını
  gösteren bir istatistik görünümü sunmalıdır; bu sayıma kullanıcı tarafından
  silinmiş (soft-delete) görüşmeler de **dahildir** (tam denetim şeffaflığı).
- **FR-010**: Sistem, admin'e görüşmelerin ortalama tamamlanma süresini (tamamlanma
  anı − başlangıç anı üzerinden hesaplanan) göstermelidir; hesaba silinmiş
  görüşmeler de **dahildir**.
- **FR-011**: Sistem, admin'e tamamlanan görüşmelerin yarım kalanlara oranını
  göstermelidir; bu orana silinmiş görüşmeler de **dahildir**.
- **FR-012**: Sistem, admin'e zaman içindeki toplam LLM token tüketimini **günlük
  granülaritede, varsayılan olarak son 30 günlük pencerede** zaman serisi biçiminde
  göstermelidir; toplam, silinmiş görüşmelere ait token kayıtları dahil olmak
  üzere, tüm token kayıtlarının toplamıyla tutarlı olmalıdır.
- **FR-013**: Sistem, hiç görüşme/token kaydı olmadığında istatistik ekranını hata
  vermeden, "veri yok" durumunu ifade eden bir görünümle sunmalıdır.
- **FR-014**: Sistem, admin görüşme listesini **varsayılan olarak 20 kayıt/sayfa**
  sayfalama ile sunmalıdır; büyük hacimli listelerde admin performans kaybı
  yaşamadan gezinebilmelidir.
- **FR-015**: Admin panel arayüzü, kullanıcı panelinden görsel olarak ayırt edilebilir
  olmalıdır (aynı yerleşim, farklı vurgu rengi — `docs/APP_FLOW.md` §5 kararı; görsel
  detaylar bu dilimin kapsamı dışında, `docs/APP_FLOW.md`/UI kararlarına referans verir).

### Key Entities

> Bu dilim **hiçbir yeni veri tablosu tanımlamaz**; aşağıdaki varlıklar başka
> dilimlerde tanımlıdır ve burada yalnızca **salt-okunur** biçimde tüketilir.

- **User** (şema sahibi `001-auth-rol`): Admin'in "kim" bilgisini gösterdiği
  kullanıcı kaydı — `id`, `email`, `role`.
- **Interview** (şema sahibi `002-interview`): Listeleme ve detay ekranlarının
  merkezi kaydı — `position`, `status`, `createdAt`, `completedAt`, `deletedAt`,
  `currentQuestionOrder`, `reportStatus`, `mode`, `level`, `language` alanları
  admin görünümünde kullanılır (bkz. `004-history/data-model.md`'deki tüketim
  tablosuna benzer biçimde; bu dilim kendi eşdeğerini kendi `data-model.md`'sinde
  tanımlar).
- **Question / Answer** (şema sahibi `002-interview`): Detay ekranında görüntülenen
  soru-cevap çiftleri.
- **Report** (şema sahibi `002-interview`): Detay ekranında görüntülenen
  Teknik/Davranışsal/Genel skorları ve metinsel geri bildirim.
- **TokenUsage** (tasarım sahibi `003-pre-assessment`, tablo `002-interview`
  migration'ında oluşturulur — cross-cutting): İstatistik ekranındaki toplam
  token/maliyet hesaplarının ve detay ekranındaki görüşme başına maliyetin tek
  kaynağı.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin, herhangi bir görüşmenin tam detayına (sorular, cevaplar,
  rapor, maliyet) listeden tek bir seçimle, sayfa yüklenmesi dahil 3 saniye
  içinde ulaşabilir.
- **SC-002**: Meslek filtresi uygulanan görüşme listesi sonuçlarının %100'ü
  seçilen mesleğe aittir (yanlış pozitif/negatif yok).
- **SC-003**: Kullanıcı tarafından silinen görüşmelerin %100'ü admin listesinde
  "silindi" etiketiyle, veri kaybı olmadan görünür kalır.
- **SC-004**: Admin olmayan (anonim veya rolü `user` olan) erişim denemelerinin
  %100'ü admin uç noktalarında reddedilir ve hiçbir veri sızmaz.
- **SC-005**: Admin panelinden gönderilen tüm yazma/güncelleme/silme
  denemelerinin %100'ü reddedilir (salt-okunur garanti).
- **SC-006**: İstatistik ekranındaki toplam token tüketimi ve tamamlanma oranı
  değerleri, ham veritabanı kayıtlarından bağımsız olarak hesaplanan referans
  değerlerle %100 tutarlıdır.
- **SC-007**: Sistemde hiç görüşme kaydı olmadığında istatistik ekranı hata
  fırlatmadan (0 hata oranı) açılır.

## Assumptions

- Admin girişi (kimlik doğrulama, yalnızca e-posta/şifre, Google reddi) zaten
  `001-auth-rol` kapsamında tanımlıdır; bu dilim yalnızca oturum açmış admin'e
  özel ekranları ve okuma uç noktalarını kapsar, giriş akışını yeniden tanımlamaz.
- Admin paneli bu MVP'de **tamamen salt-okunurdur**: düzenleme, kalıcı silme,
  kullanıcı yönetimi (hesap askıya alma/silme, rol değiştirme) kapsam dışıdır
  (`docs/APP_FLOW.md` ekran listesi yalnızca görüntüleme + filtre + istatistik
  tanımlar).
- Görüşme listesi tek bir birleşik ekrandır ("Tüm kullanıcılar/görüşmeler" —
  `docs/APP_FLOW.md` #10); kullanıcı bazlı ayrı bir "kullanıcı yönetimi" ekranı
  bu dilimin kapsamında değildir.
- Filtreleme MVP'de yalnızca meslek/pozisyon alanına göredir (`docs/APP_FLOW.md`
  §5 kararı); kullanıcı adı/e-posta arama veya tarih aralığı filtresi bu dilimin
  kapsamı dışındadır (gerekirse ayrı bir bonus fonksiyon olarak eklenir).
- İstatistik ekranındaki meslek bazlı sayı, ortalama süre ve tamamlanma oranı
  MVP'de tüm-zamanlar (all-time) toplamını gösterir; token zaman serisi ise
  günlük granülaritede son 30 günlük varsayılan pencerede gösterilir (bkz.
  Clarifications). Her iki metrik için de tarih aralığı seçilebilir filtreleme
  bonus kapsamındadır.
- "Ortalama görüşme süresi" `Interview.completedAt − Interview.createdAt`
  farkından hesaplanır — bu hesap kuralı zaten `002-interview/data-model.md`'de
  tanımlıdır, burada yeniden tanımlanmaz.
- Rapor/PDF dışa aktarımı admin tarafı için bu dilimin kapsamında değildir
  (kullanıcı tarafı dışa aktarım `004-history` FR-016 kapsamındadır).
- Şema sahipliği yoktur: bu dilim `User`, `Interview`, `Question`, `Answer`,
  `Report`, `TokenUsage` tablolarında **hiçbir yeni alan veya tablo açmaz**; yalnızca
  var olan alanları okur (`docs/API_CONVENTIONS.md` §1 hata kodu sözleşmesine ve
  `001-auth-rol/contracts/authz-rules.md` R3 admin okuma kuralına tabidir).
