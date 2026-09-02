# Feature Specification: Ödeme ve Abonelik (Ücretli Plan Kademeleri)

**Feature Branch**: `010-odeme-abonelik`

**Created**: 2026-09-02

**Status**: Draft

**Input**: User description: "Uygulamaya ödeme sistemi eklensin. Aylık abonelik modeli olsun: Free / Pro / Pro+. Planlar arasındaki tek fark aylık görüşme kotası (Free 3, Pro 50, Pro+ 100). Bir görüşme hakkı, görüşme BAŞLATILDIĞINDA düşsün; yarım kalan bir görüşmeye devam edildiğinde tekrar düşmesin."

> **Not (kapsam/önceki karar ile ilişki)**: Bu dilim, mevcut saatlik LLM hız
> sınırlamasının (`002-interview`, `docs/API_CONVENTIONS.md` 3.5) yerine
> GEÇMEZ. O sınır kötüye kullanım savunmasıdır ve olduğu gibi kalır; bu dilim
> onun ÜSTÜNE ayrı bir ticari kota katmanı ekler. İki katman farklı amaçlara
> hizmet eder ve farklı hata kodlarıyla ayrışır (429 vs. 402).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ücretsiz kullanıcının aylık kotasını tüketmesi (Priority: P1)

Ücretsiz plandaki bir kullanıcı ay içinde tanımlı sayıda görüşme başlatır. Kotası
dolduktan sonra yeni bir görüşme başlatmak istediğinde sistem isteği reddeder ve
kullanıcıyı plan yükseltme akışına yönlendirir. Kullanıcının halihazırda yarım
kalmış görüşmeleri bu durumdan etkilenmez; onlara devam edebilir ve raporlarını
alabilir.

**Why this priority**: Kotanın gerçekten uygulanması, tüm ticari modelin
dayanağıdır. Ödeme akışı olmadan da bağımsız olarak teslim edilebilir ve test
edilebilir (herkes Free planda kabul edilir).

**Independent Test**: Ücretsiz plandaki bir kullanıcı için kota sayısı kadar
görüşme oluşturulur; sonraki oluşturma isteğinin reddedildiği ve mevcut bir
görüşmeye cevap verme / rapor alma uçlarının çalışmaya devam ettiği doğrulanır.

**Acceptance Scenarios**:

1. **Given** ücretsiz plandaki bir kullanıcı bu takvim ayında kotasının altında görüşme başlatmış, **When** yeni bir görüşme başlatır, **Then** görüşme oluşturulur ve kalan hakkı bir azalır.
2. **Given** ücretsiz plandaki bir kullanıcı bu takvim ayında kotası kadar görüşme başlatmış, **When** yeni bir görüşme başlatmayı dener, **Then** sistem isteği reddeder, kullanılan/toplam hak bilgisini döner ve kullanıcıyı plan yükseltmeye yönlendirir.
3. **Given** kotası dolmuş bir kullanıcının yarım kalmış bir görüşmesi, **When** kullanıcı o görüşmeye cevap vermeye devam eder veya raporunu üretir, **Then** işlem başarıyla tamamlanır ve kotadan İLAVE bir hak DÜŞMEZ.
4. **Given** kotası dolmuş bir kullanıcı, **When** takvim ayı değişir, **Then** kotası sıfırlanır ve yeniden görüşme başlatabilir.
5. **Given** bir kullanıcı bu ay başlattığı bir görüşmeyi geçmişinden siler, **When** yeni bir görüşme başlatmayı dener, **Then** silinen görüşme kotadan düşmüş olarak SAYILMAYA DEVAM EDER (silme, hak iade etmez).

---

### User Story 2 - Ücretli plana geçiş (Priority: P1)

Kotası yetmeyen bir kullanıcı fiyatlandırma ekranından bir ücretli kademe seçer,
ödeme sağlayıcısının barındırdığı güvenli ödeme sayfasına yönlendirilir, ödemeyi
tamamlar ve uygulamaya döndüğünde planı yükselmiş olarak devam eder.

**Why this priority**: Gelirin gerçekleştiği akış budur; User Story 1'in ortaya
çıkardığı kısıtın çözümüdür.

**Independent Test**: Sağlayıcının test ortamında bir ödeme tamamlanarak,
kullanıcının planının ve aylık kotasının yükseldiği doğrulanabilir.

**Acceptance Scenarios**:

1. **Given** ücretsiz plandaki bir kullanıcı, **When** fiyatlandırma ekranından bir ücretli kademe seçer, **Then** sistem kullanıcıyı ödeme sağlayıcısının barındırdığı ödeme sayfasına yönlendirir.
2. **Given** kullanıcı ödemeyi başarıyla tamamlamış, **When** ödeme sağlayıcısı ödemeyi sisteme bildirir, **Then** kullanıcının planı seçilen kademeye yükselir, aylık kotası o kademenin kotası olur ve abonelik bitiş tarihi kaydedilir.
3. **Given** kullanıcı ödeme sayfasından vazgeçip geri döner, **When** uygulamaya geri yönlendirilir, **Then** planı DEĞİŞMEZ ve ücretsiz plan kısıtları aynen geçerli kalır.
4. **Given** kullanıcı ödemeyi tamamlamış ancak bildirim henüz sisteme ulaşmamış, **When** kullanıcı uygulamaya geri döner, **Then** sistem "ödemeniz işleniyor" durumunu gösterir ve plan yükseltmesini yalnızca sağlayıcı bildirimi doğrulandıktan sonra uygular.

---

### User Story 3 - Aboneliğin yenilenmesi, iptali ve sona ermesi (Priority: P2)

Ücretli kullanıcı aboneliğini yönetir: ödeme yöntemini günceller, kademe
değiştirir veya aboneliğini iptal eder. İptal edildiğinde ödenmiş dönem sonuna
kadar hakları devam eder, dönem sonunda ücretsiz plana döner.

**Why this priority**: Mutlu yol (US2) çalışırken bağımsız doğrulanabilir; ancak
ticari olarak zorunludur (iptal edememek kabul edilemez).

**Independent Test**: Abonelik bitiş tarihi geçmişe alınmış bir kullanıcının
ücretsiz plan kotasına düştüğü doğrulanarak test edilebilir.

**Acceptance Scenarios**:

1. **Given** ücretli plandaki bir kullanıcı, **When** abonelik yönetim ekranını açar, **Then** ödeme yöntemini güncelleyebileceği, kademe değiştirebileceği ve iptal edebileceği sağlayıcı ekranına yönlendirilir.
2. **Given** aboneliğini iptal etmiş bir kullanıcı, **When** ödenmiş dönem henüz bitmemiş, **Then** kullanıcı kademesinin tüm haklarını dönem sonuna kadar kullanmaya DEVAM EDER.
3. **Given** aboneliğin ödenmiş dönemi sona ermiş ve yenileme ödemesi alınmamış, **When** kullanıcı yeni bir görüşme başlatmak ister, **Then** ücretsiz plan kotası uygulanır.
4. **Given** ücretli kullanıcının yenileme ödemesi başarıyla alınmış, **When** sağlayıcı bunu bildirir, **Then** abonelik bitiş tarihi yeni dönem sonuna uzatılır ve kullanıcı kesintisiz devam eder.
5. **Given** ücretli kullanıcı daha yüksek bir kademeye geçmiş, **When** sağlayıcı kademe değişimini bildirir, **Then** kullanıcının aylık kotası yeni kademenin kotası olur.

---

### User Story 4 - Kalan hakkın görünür olması (Priority: P2)

Kullanıcı, mevcut planını ve bu ay kaç görüşme hakkı kaldığını arayüzde görür.

**Why this priority**: Kotaya ancak reddedildiğinde çarpmak kötü bir deneyimdir;
ancak kısıtın kendisi (US1) olmadan anlamsızdır.

**Independent Test**: Profil/kota uç noktası çağrılarak plan, kullanılan ve
toplam hak alanlarının döndüğü doğrulanabilir.

**Acceptance Scenarios**:

1. **Given** oturum açmış herhangi bir kullanıcı, **When** uygulamayı kullanır, **Then** mevcut planını ve bu ayki kullanılan/toplam görüşme hakkını görebilir.
2. **Given** ücretsiz plandaki bir kullanıcı, **When** kotasının tamamına yaklaşır veya kotası dolar, **Then** arayüzde plan yükseltme çağrısı görünür.

---

### Edge Cases

- Kullanıcı aynı anda iki sekmeden görüşme başlatırsa kota sayımı yarışabilir; kabul edilen tavan, limitin en fazla bir görüşme aşılmasıdır (bkz. `plan.md`).
- Ödeme bildirimi sağlayıcı tarafından birden çok kez gönderilebilir; aynı bildirimin tekrar işlenmesi kullanıcının hakkını veya abonelik süresini ÇOĞALTMAMALIdır.
- Ödeme bildirimi hiç ulaşmazsa kullanıcı ödeme yapmış ama yükselmemiş olur; sistem bu durumu sessizce geçmemeli, kayıt altına almalıdır.
- Kullanıcı ay ortasında abone olursa içinde bulunduğu takvim ayı için kısmi bir pencere alır (bkz. Assumptions).
- Hesabı silinen kullanıcının abonelik verisi de kullanıcı satırıyla birlikte gider; sağlayıcı tarafındaki aboneliğin iptali bu dilimin kapsamı dışındadır (bkz. Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistem, her kullanıcı için üç plan kademesinden birini TANIMLAMALIdır: `free`, `pro`, `pro_plus`. Ödeme yapmamış veya aboneliği sona ermiş her kullanıcı `free` kademesindedir.
- **FR-002**: Sistem, her plan kademesi için aylık görüşme başlatma kotası UYGULAMALIdır: `free` = 3, `pro` = 50, `pro_plus` = 100.
- **FR-003**: Sistem, kota penceresini takvim ayı olarak hesaplamalıdır; pencere ayın ilk günü 00:00 UTC'de başlar.
- **FR-004**: Sistem, bir görüşme hakkını yalnızca YENİ görüşme oluşturulduğunda düşmelidir; var olan bir görüşmeye cevap verme, rapor üretme veya rapor yeniden deneme işlemleri kotayı TÜKETMEMELİdir.
- **FR-005**: Sistem, kullanıcı tarafından silinmiş görüşmeleri de kota sayımında saymaya DEVAM ETMELİdir; silme işlemi hak iade ETMEZ.
- **FR-006**: Sistem, aylık kotası dolmuş bir kullanıcının yeni görüşme başlatma isteğini reddetmeli ve yanıtta mevcut plan, kullanılan hak ve toplam hak bilgisini DÖNMELİdir.
- **FR-007**: Kota aşımı yanıtı, mevcut saatlik hız sınırlaması yanıtından AYIRT EDİLEBİLİR olmalıdır; istemci "bekle" ile "planını yükselt" durumlarını karıştırmamalıdır.
- **FR-008**: Sistem, mevcut saatlik LLM hız sınırlamasını KORUMALIdır; plan kotası onun yerine geçmez, üstüne eklenir.
- **FR-009**: Kota kontrolü, saatlik hız sınırlaması sayacı artırılmadan ÖNCE yapılmalıdır; hakkı dolduğu için reddedilen kullanıcı saatlik hakkını KAYBETMEMELİdir.
- **FR-010**: Sistem, kullanıcının ücretli bir kademe seçip ödeme yapmasına izin VERMELİdir; ödeme, ödeme sağlayıcısının barındırdığı sayfada tamamlanmalıdır.
- **FR-011**: Sistem, kart numarası, son kullanma tarihi, CVC gibi ödeme aracı verilerini HİÇBİR ZAMAN almamalı, işlememeli, loglamamalı veya saklamamalıdır.
- **FR-012**: Sistem, bir kullanıcının planını yalnızca ödeme sağlayıcısından gelen ve doğruluğu kriptografik olarak DOĞRULANMIŞ bir bildirime dayanarak yükseltmelidir; kullanıcının ödeme sonrası geri yönlendirildiği adrese güvenerek plan yükseltmesi YAPILMAMALIdır.
- **FR-013**: Sistem, doğrulanamayan bir ödeme bildirimini reddetmeli ve bu bildirime dayanarak hiçbir veri değişikliği YAPMAMALIdır.
- **FR-014**: Ödeme bildirimi işleme mantığı idempotent OLMALIdır; aynı bildirimin tekrar işlenmesi abonelik süresini uzatmamalı veya kotayı çoğaltmamalıdır.
- **FR-015**: Sistem, kullanıcının aboneliğini yönetebileceği (ödeme yöntemi güncelleme, kademe değiştirme, iptal) bir yola erişim SAĞLAMALIdır.
- **FR-016**: Abonelik iptal edildiğinde kullanıcı, ödenmiş dönemin sonuna kadar kademesinin haklarını KORUMALI; dönem sonunda otomatik olarak `free` kademesine DÜŞMELİdir.
- **FR-017**: Yenileme ödemesi alınamayan abonelik, ödenmiş dönem sonunda kendiliğinden sona ERMELİdir; sistemin ayrı bir borç takip/tekrar deneme mantığı yürütmesi gerekmez.
- **FR-018**: Sistem, oturum açmış kullanıcıya mevcut plan kademesini, bu ay kullanılan hak sayısını ve toplam hak sayısını SUNMALIdır.
- **FR-019**: Sistem, ödeme ve abonelik ile ilgili güvenlik açısından anlamlı olayları (ödeme oturumu başlatma, doğrulanmış bildirim işleme, doğrulanamayan bildirim reddi, kota aşımı) kayıt altına ALMALIdır; sessiz başarısızlık yasaktır.
- **FR-020**: Ödeme bildirimlerinin ham içeriği ve sağlayıcı gizli anahtarları loglara YAZILMAMALIdır.

### Key Entities *(include if feature involves data)*

- **Plan Kademesi (Plan Tier)**: Bir kullanıcının hangi kota sınıfında olduğunu belirten değer (`free` | `pro` | `pro_plus`). Kullanıcıya ait iki bilgiden (kademe + abonelik bitiş zamanı) TÜRETİLİR; ayrıca saklanan bir "durum" alanı yoktur.
- **Abonelik Bitiş Zamanı**: Kullanıcının ödenmiş döneminin bittiği an. Bu an geçmişte ise kullanıcı `free` kabul edilir. Yenileme ödemesi bu anı ileri taşır; iptal bu anı değiştirmez.
- **Ödeme Sağlayıcısı Müşteri Kimliği**: Uygulamadaki kullanıcı ile sağlayıcı tarafındaki müşteri kaydını eşleyen dış kimlik. Ödeme bildirimleri bu kimlik üzerinden kullanıcıya bağlanır.
- **Kullanıcı (User)**: Mevcut `001-auth-rol` varlığı; bu dilim ona abonelik alanları ekler.
- **Görüşme (Interview)**: Mevcut `002-interview` varlığı; kota sayımının kaynağıdır (bu ay oluşturulmuş satır sayısı). Bu dilim Görüşme varlığına alan EKLEMEZ.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Aylık kotası dolmuş kullanıcıların yeni görüşme başlatma denemelerinin %100'ü reddedilir.
- **SC-002**: Yarım kalmış bir görüşmeye devam eden kullanıcıların hiçbirinde ilave hak düşmez (kota tüketimi ölçümlerinde %0 yanlış düşüm).
- **SC-003**: Doğrulanamayan ödeme bildirimlerinin %100'ü reddedilir ve bu bildirimlerin hiçbiri veritabanında değişiklik yaratmaz.
- **SC-004**: Aynı ödeme bildiriminin tekrar tekrar işlenmesi, abonelik bitiş tarihinde hiçbir ek değişiklik yaratmaz (idempotency testleri geçer).
- **SC-005**: Ödemesi doğrulanan kullanıcıların %100'ünde plan kademesi ve aylık kota, bildirim işlendikten sonra 1 dakika içinde yükselmiş olur.
- **SC-006**: Abonelik bitiş tarihi geçmiş kullanıcıların %100'ü ücretsiz plan kotasına düşer.
- **SC-007**: Kota aşımı yanıtı ile saatlik hız sınırı yanıtı, istemci tarafında ek bilgiye ihtiyaç duymadan birbirinden ayrılabilir.

## Assumptions

- **Kota penceresi takvim ayıdır ve her kademe için aynıdır.** Sağlayıcının fatura dönemiyle birebir örtüşmez: ayın 15'inde abone olan kullanıcı içinde bulunduğu takvim ayı için kısmi bir pencere alır. Bu bilinçli bir sadeleştirmedir; alternatifi (ücretli kademelere fatura dönemi, ücretsiz kademeye takvim ayı) iki ayrı pencere mantığı gerektirirdi. Ücretli kademelerin kotası yüksek olduğu için kayma pratikte kimseyi mağdur etmez.
- **Bir görüşme hakkı, görüşme oluşturulduğu anda düşer.** Kullanıcı görüşmeyi yarıda bıraksa bile hak geri gelmez; soru üretimi maliyeti o anda oluşmuştur. Yarım kalan görüşmeye DEVAM etmek yeni bir kayıt yaratmadığı için kendiliğinden ücretsizdir — ayrı bir kural gerekmez.
- **Planlar arasındaki tek fark kotadır.** Sesli mod, PDF rapor, geçmiş saklama süresi ve LLM model kalitesi tüm kademelerde AYNIDIR. Kullanıcı kararı (2026-09-01): özellik kilidi kapsam dışıdır.
- **Kota limitleri kodda sabittir** (3 / 50 / 100), veritabanında değil. Tek bir plan matrisi vardır ve yönetim arayüzünden değiştirilmez; DB'ye taşımak boş bir tablo demektir. Limit değişimi kod değişikliği + dağıtım gerektirir.
- **Fiyatlar bu spec'te tanımlı DEĞİLDİR.** Fiyat, para birimi ve fatura dönemi ödeme sağlayıcısında tanımlanır; uygulama fiyatı hiçbir yerde saklamaz veya doğrulamaz.
- **Ödeme sayfası sağlayıcı tarafından barındırılır.** Uygulama kendi ödeme formunu yazmaz; bu, kart verisi kapsam dışında kalsın diye bilinçli bir karardır (FR-011).
- **Borç takibi (dunning), fatura arşivi, kupon/indirim, yıllık plan, takım/kurumsal plan, vergi/fatura belgesi üretimi ve para iadesi bu dilimin KAPSAMI DIŞINDADIR.** İhtiyaç doğarsa ayrı dilim konusudur.
- **Hesap silme ile abonelik iptali ayrı işlemlerdir.** Uygulama hesabı silindiğinde abonelik verisi kullanıcı satırıyla birlikte gider; sağlayıcı tarafındaki aktif aboneliğin iptali bu dilimin kapsamında değildir.
- Bu spec, bilinçli olarak ödeme sağlayıcısı adı belirtmez (Anayasa İlke II); sağlayıcı seçimi ve teknik yaklaşım `plan.md` aşamasında netleştirilir.
