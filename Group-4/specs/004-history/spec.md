# Feature Specification: Interview History (Görüşme Geçmişi)

**Feature Branch**: `004-history`

**Created**: 2026-07-31

**Status**: Draft

**Input**: GitHub issue #13 — "004-history: Interview History dilimi spec yazımı". Kaynak: `docs/APP_FLOW.md` ekran listesi #4 (Interview History) ve #9 (Görüşme Detayı — geçmiş), `docs/PLAN.md` fonksiyon backlog tablosu.

## Kapsam Notu

Bu dilim, Dashboard'daki **"Interview History"** sekmesini ve geçmiş bir görüşmenin
**Detay** ekranını kapsar: kullanıcının kendi görüşmelerini kart görünümünde listelemesi,
yarım kalmış bir görüşmeye kaldığı sorudan devam etmesi, tamamlanmış bir görüşmenin
soru/cevap/rapor içeriğini görüntülemesi ve bir görüşmeyi kendi listesinden **soft-delete**
ile kaldırması.

Bu dilim, `002-interview` dilimi tarafından sağlanan görüşme oluşturma, soru-cevap akışı
ve rapor üretimi yeteneklerinin **üzerine** inşa edilir; o dilimin veri modelini veya
API sözleşmesini yeniden tanımlamaz (bkz. "Bağımlılıklar / Entegrasyon Noktaları").

> **Uzantı**: User Story 1'in liste ekranına filtreleme ve arama ekleyen kapsam
> (issue #42) ayrı bir dikey değildir; gereksinimleri FR-018…FR-028 olarak
> [`filtre-arama.md`](./filtre-arama.md) dosyasında tanımlıdır.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Geçmiş görüşmeleri kart görünümünde listeleme (Priority: P1)

Kullanıcı Dashboard'daki "Interview History" sekmesine girdiğinde, daha önce başlattığı
tüm görüşmeleri (tamamlanmış, yarım kalmış) kart biçiminde görür. Her kart pozisyon adını,
oluşturulma tarihini, mod (Sözlü / Yazılı) ve deneyim seviyesi (Stajyer / Junior / Senior)
rozetlerini ve durum rozetini (Tamamlandı / Yarım Kaldı / Silindi) gösterir.
Kullanıcının kendi silmiş olduğu görüşmeler bu listede **görünmez** (silinmiş rozeti
yalnızca admin tarafında görünür — bkz. Story 4).

**Why this priority**: Geçmiş görüşmelere erişim, bu dilimin temel değeridir; diğer tüm
senaryolar (devam etme, detay görüntüleme, silme) bu listeleme ekranından başlar. Listeleme
olmadan diğer hikâyeler test edilemez.

**Independent Test**: Farklı durumlarda (tamamlanmış, yarım kalmış, hiç görüşme yok) test
kullanıcılarıyla sekmeye girilip kartların doğru bilgi ve rozetle göründüğü, silinmiş
kayıtların listede yer almadığı doğrulanarak bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcının 2 tamamlanmış ve 1 yarım kalmış görüşmesi var, **Olduğunda**
   kullanıcı "Interview History" sekmesine girer, **O zaman** 3 kart görüntülenir; her kart
   pozisyon adı, oluşturulma tarihi ve doğru durum rozetini ("Tamamlandı" x2, "Yarım Kaldı"
   x1) gösterir.
2. **Diyelim ki** kullanıcının hiç görüşmesi yok, **Olduğunda** kullanıcı "Interview History"
   sekmesine girer, **O zaman** boş durum (empty state) mesajı gösterilir ve kullanıcı yeni
   görüşme başlatmaya yönlendirilir.
3. **Diyelim ki** kullanıcının bir görüşmesi kendi tarafından daha önce silinmiş, **Olduğunda**
   kullanıcı listeyi görüntüler, **O zaman** silinen görüşme listede **yer almaz** (rozet
   olarak da gösterilmez — kayıt tamamen görünmez).
4. **Diyelim ki** görüşme listesi çok sayıda kayıt içeriyor, **Olduğunda** kullanıcı listeyi
   görüntüler, **O zaman** kartlar en yeniden en eskiye doğru (oluşturulma tarihine göre)
   sıralanır.

---

### User Story 2 - Yarım kalmış görüşmeye devam etme (resume) (Priority: P2)

Kullanıcı, durum rozeti "Yarım Kaldı" olan bir kartta "Devam Et" aksiyonunu seçtiğinde,
kaldığı soru indeksinden itibaren soru-cevap ekranına yönlendirilir; önceki cevapları
değişmeden korunur ve yeni cevap doğrudan bir sonraki cevaplanmamış sorudan alınmaya
devam eder.

**Why this priority**: `docs/PLAN.md` fonksiyon backlog tablosunda resume **MVP** olarak
işaretlenmiştir; yarım kalan görüşmelerin kaybolmaması kullanıcı deneyimi için kritik
değer taşır, ancak listeleme (Story 1) olmadan erişilemez.

**Independent Test**: Yarım kalmış bir görüşme kaydıyla "Devam Et" aksiyonu tetiklenip
kullanıcının kaldığı sorudan devam ettiği, önceki cevapların bozulmadığı doğrulanarak
bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcının 8 sorudan 3'ünü yanıtladığı yarım kalmış bir görüşmesi var,
   **Olduğunda** kullanıcı kartındaki "Devam Et" aksiyonunu seçer, **O zaman** soru-cevap
   ekranı açılır, ilk 3 soru/cevap çifti değişmeden görüntülenir ve 4. soru aktif soru
   olarak sunulur.
2. **Diyelim ki** kullanıcı "Devam Et" aksiyonunu seçti, **Olduğunda** soru-cevap ekranı
   yüklenirken bir ağ/sunucu hatası oluşur, **O zaman** kullanıcıya anlaşılır bir hata
   mesajı gösterilir ve tekrar deneme seçeneği sunulur; görüşme durumu değişmez.
3. **Diyelim ki** kullanıcı devam etmek istediği görüşmeyi başka bir cihazda/sekmede zaten
   tamamlamış (durum artık "completed"), **Olduğunda** kullanıcı eski "Devam Et" aksiyonunu
   tetikler, **O zaman** sistem kullanıcıyı otomatik olarak Görüşme Detayı (Story 3) ekranına
   yönlendirir; "Yarım Kaldı" akışına zorlamaz.
4. **Diyelim ki** kullanıcı kendisine ait olmayan veya var olmayan bir görüşme kimliğiyle
   devam etmeyi dener (örn. doğrudan URL ile), **Olduğunda** istek gönderilir, **O zaman**
   sistem "kayıt bulunamadı" hatası döner; kaydın var olup olmadığı veya başkasına ait
   olduğu bilgisi **sızdırılmaz**.

---

### User Story 3 - Tamamlanmış görüşme detayını görüntüleme (Priority: P2)

Kullanıcı, durum rozeti "Tamamlandı" olan bir kartı seçtiğinde, Görüşme Detayı ekranına
gider; bu ekranda görüşmenin tüm soruları, verdiği cevaplar ve LLM tarafından üretilen
değerlendirme raporu (Teknik / Davranışsal / Genel) eksiksiz biçimde görüntülenir.

**Why this priority**: Kullanıcının geçmiş performansını gözden geçirebilmesi bu dilimin
ana değer teklifidir; listelemeden (Story 1) hemen sonra en sık kullanılacak akıştır.

**Independent Test**: Tamamlanmış bir görüşme kaydıyla kart seçilip detay ekranının tüm
soru/cevap çiftlerini ve raporu eksiksiz gösterdiği doğrulanarak bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcının tamamlanmış ve raporu hazır bir görüşmesi var, **Olduğunda**
   kullanıcı kartı seçer, **O zaman** Görüşme Detayı ekranı açılır; tüm sorular, verilen
   cevaplar ve rapor (Teknik/Davranışsal/Genel skorları + metinsel geri bildirim) sırayla
   görüntülenir.
2. **Diyelim ki** görüşme tamamlanmış ancak rapor üretimi başarısız olmuş (`reportStatus`
   "failed"), **Olduğunda** kullanıcı detay ekranını açar, **O zaman** soru/cevap içeriği
   yine de gösterilir; rapor bölümünde "rapor oluşturulamadı" bilgisi ve (varsa) tekrar
   deneme seçeneği sunulur — sessiz başarısızlık gösterilmez.
3. **Diyelim ki** kullanıcı kendisine ait olmayan bir görüşmenin detay kimliğine doğrudan
   erişmeyi dener, **Olduğunda** istek gönderilir, **O zaman** sistem "kayıt bulunamadı"
   hatası döner; kaydın var olup olmadığı bilgisi sızdırılmaz (Story 2 kriter 4 ile aynı
   kural).

---

### User Story 4 - Görüşmeyi silme (soft delete) (Priority: P3)

Kullanıcı bir kart üzerinden "Sil" aksiyonunu seçip onayladığında, görüşme kendi
"Interview History" listesinden kalıcı olarak kaybolur. Ancak kayıt fiziksel olarak
silinmez: admin panelinde aynı görüşme "Silindi" rozetiyle görünmeye devam eder (bu
davranış anayasal/PLAN.md kısıtıdır — netleştirilecek bir karar değil, uygulanması
gereken bir gereksinimdir).

**Why this priority**: Kullanıcı kontrolü (kendi geçmişini yönetebilme) önemli bir
gereksinimdir ancak listeleme, devam etme ve detay görüntüleme akışlarından sonra
gelir; bu üçü olmadan silme aksiyonunun bir bağlamı yoktur.

**Independent Test**: Herhangi bir durumdaki (tamamlanmış veya yarım kalmış) bir görüşme
kaydıyla silme aksiyonu tetiklenip kaydın kullanıcı listesinden kaybolduğu, buna karşın
admin görünümünde "Silindi" rozetiyle hâlâ göründüğü doğrulanarak bağımsız test edilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcının tamamlanmış bir görüşmesi var, **Olduğunda** kullanıcı
   kartındaki "Sil" aksiyonunu seçip onaylar, **O zaman** görüşme kullanıcının "Interview
   History" listesinden anında kaybolur.
2. **Diyelim ki** kullanıcı bir görüşmeyi sildi, **Olduğunda** admin ilgili görüşmenin
   detayını görüntüler, **O zaman** kayıt hâlâ mevcuttur ve "Silindi" durum rozetiyle
   işaretlenmiş biçimde tüm soru/cevap/rapor içeriğiyle görüntülenebilir.
3. **Diyelim ki** kullanıcı yarım kalmış (devam ettirilebilir) bir görüşmeyi siler,
   **Olduğunda** silme onaylanır, **O zaman** görüşme hem listeden kaybolur hem de artık
   "Devam Et" ile erişilemez hale gelir (Story 2 kriter 4'teki "bulunamadı" davranışıyla
   tutarlı).
4. **Diyelim ki** kullanıcı "Sil" aksiyonunu seçer, **Olduğunda** onay istemi (confirmation)
   gösterilir ve kullanıcı vazgeçer, **O zaman** görüşme silinmez ve listede olduğu gibi
   kalır (yanlışlıkla silmeye karşı koruma).
5. **Diyelim ki** görüşme zaten kullanıcı tarafından silinmiş (örn. iki sekmede aynı anda
   işlem yapıldı), **Olduğunda** ikinci silme isteği gönderilir, **O zaman** sistem hata
   fırlatmadan işlemi zaten tamamlanmış kabul eder (idempotent davranış) veya "kayıt
   bulunamadı" döner; kullanıcıya anlaşılır bir sonuç gösterilir.

---

### User Story 5 - Rapor dışa aktarımı ve skor trendi (Priority: P4)

Kullanıcı, Görüşme Detayı ekranından raporunu PDF olarak dışa aktarabilir ve "Interview
History" sekmesinde aynı pozisyon/meslek için zaman içindeki skor değişimini gösteren bir
trend grafiği görüntüleyebilir.

**Why this priority**: `docs/PLAN.md` fonksiyon backlog tablosunda bu iki fonksiyon
**Bonus'tan MVP'ye yükseltildi (2026-07-31 kararı)** — düşük implementasyon eforuna
karşılık kullanıcı için yüksek algılanan değer sağladıkları için. Yine de sıralamada son
sıradadır çünkü listeleme, devam etme, detay görüntüleme ve silme akışları olmadan bir
bağlamı yoktur; skor trendi ayrıca rubrik/model tutarlılığı ön koşuluna bağımlıdır
(PLAN.md fonksiyon backlog notu).

**Independent Test**: Tamamlanmış birden fazla raporlu görüşme kaydıyla PDF dışa aktarımının
çalıştığı ve trend grafiğinin doğru skorları çizdiği ayrı ayrı doğrulanarak test edilebilir;
diğer hikâyelerden bağımsız (ayrı bir dal olarak) geliştirilebilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcı tamamlanmış ve raporu hazır bir görüşme detayında, **Olduğunda**
   "PDF olarak indir" aksiyonunu seçer, **O zaman** rapor içeriğini (skorlar + metinsel
   geri bildirim) içeren bir dosya indirilir.
2. **Diyelim ki** kullanıcının aynı meslek/pozisyon için birden fazla tamamlanmış ve
   raporlanmış görüşmesi var, **Olduğunda** kullanıcı "Interview History" sekmesinde trend
   görünümünü açar, **O zaman** skorların zaman içindeki değişimini gösteren bir grafik
   görüntülenir.

---

### Edge Cases

- Kullanıcının hiç görüşmesi olmadığında liste ekranı boş durum (empty state) gösterir
  (Story 1 kriter 2).
- Aynı anda birden fazla "Yarım Kaldı" görüşme olabilir; her biri kendi kaldığı sorudan
  bağımsız olarak devam ettirilebilir — sistem tek bir aktif görüşmeyle sınırlamaz.
- Silinmiş bir görüşmeye ait "Devam Et" veya "Detay" bağlantısına (örn. tarayıcı geçmişi,
  yer imi) sonradan erişilmeye çalışılırsa, kullanıcı tarafında "kayıt bulunamadı" davranışı
  uygulanır (Story 2 kriter 4 ile tutarlı — kayıt var/yok/sahip değil ayrımı sızdırılmaz).
- Rapor üretimi başarısız olan tamamlanmış bir görüşme detay ekranında soru/cevaplar yine
  de gösterilir; yalnızca rapor bölümü hata durumunu yansıtır (Story 3 kriter 2).
- Liste veya detay verisi yüklenirken ağ/sunucu hatası oluşursa kullanıcıya anlaşılır hata
  mesajı ve tekrar deneme imkânı sunulur; sessiz başarısızlık yasaktır (Anayasa İlke VI/VII).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistem, kullanıcının "Interview History" sekmesinde yalnızca **kendisine ait**
  ve **soft-delete ile silinmemiş** görüşmeleri kart görünümünde listelemelidir.
- **FR-002**: Her görüşme kartı en az şu bilgileri göstermelidir: pozisyon adı, oluşturulma
  tarihi, mod rozeti (Sözlü / Yazılı — `Interview.mode`), deneyim seviyesi rozeti
  (Stajyer / Junior / Senior — `Interview.level`) ve durum rozeti (Tamamlandı / Yarım Kaldı).
  "Silindi" rozeti yalnızca admin tarafında gösterilir; kullanıcı kendi listesinde silinmiş
  kayıtları hiç görmez.
- **FR-003**: Kartlar varsayılan olarak oluşturulma tarihine göre en yeniden en eskiye doğru
  sıralanmalıdır.
- **FR-004**: Kullanıcının hiç görüşmesi olmadığı durumda sistem boş durum (empty state)
  mesajı ve yeni görüşme başlatmaya yönlendiren bir aksiyon göstermelidir.
- **FR-005**: Durum rozeti "Yarım Kaldı" (`in_progress`) olan bir kart için sistem "Devam Et"
  aksiyonu sunmalı; bu aksiyon kullanıcıyı kaldığı (cevaplanmamış ilk) sorudan devam edecek
  şekilde soru-cevap akışına yönlendirmelidir. Önceki cevaplanmış soru/cevap çiftleri
  değiştirilmeden korunur.
- **FR-006**: Durum rozeti "Tamamlandı" (`completed`) olan bir kart için sistem "Devam Et"
  yerine Görüşme Detayı ekranına yönlendiren bir aksiyon sunmalıdır.
- **FR-007**: Görüşme Detayı ekranı, tamamlanmış bir görüşmenin tüm sorularını, verilen
  cevaplarını ve (varsa) değerlendirme raporunu (Teknik / Davranışsal / Genel skorları +
  metinsel geri bildirim) eksiksiz görüntülemelidir.
- **FR-008**: Rapor üretimi başarısız olmuş tamamlanmış bir görüşme için Görüşme Detayı
  ekranı soru/cevap içeriğini yine de göstermeli; rapor alanında anlaşılır bir hata durumu
  bildirmelidir (sessiz başarısızlık yasak — Anayasa İlke VI/VII).
- **FR-009**: Kullanıcı kendisine ait olmayan veya var olmayan bir görüşme kimliğiyle
  (devam etme veya detay görüntüleme için) erişim denediğinde, sistem "kayıt bulunamadı"
  davranışı uygulamalı; kaydın var olup olmadığı veya başka bir kullanıcıya ait olduğu
  bilgisi sızdırılmamalıdır.
- **FR-010**: Sistem, kullanıcının bir kart üzerinden "Sil" aksiyonunu tetiklemesine izin
  vermeli ve geri dönüşü olmayan bu işlem öncesinde bir onay adımı sunmalıdır.
- **FR-011**: Kullanıcı bir görüşmeyi sildiğinde, sistem kaydı **soft-delete** olarak
  işaretlemeli (fiziksel olarak silmemeli); işaretlenen kayıt kullanıcının kendi listesinden
  ve devam etme/detay erişiminden derhal kaybolmalıdır.
- **FR-012**: Soft-delete ile işaretlenmiş bir görüşme, admin tarafında "Silindi" durum
  rozetiyle ve tüm soru/cevap/rapor içeriğiyle birlikte görüntülenebilir kalmalıdır
  (Anayasa İlke VI, `docs/PLAN.md` §1.1 — hard constraint, yeniden tartışılmaz).
- **FR-013**: Zaten silinmiş bir görüşme için tekrar silme isteği gönderildiğinde sistem
  hata fırlatmadan tutarlı ve anlaşılır bir sonuç döndürmelidir (idempotent davranış veya
  "kayıt bulunamadı").
- **FR-014**: Yarım kalmış bir görüşme "Devam Et" ile açıldığında, görüşme durumunun
  aslında başka bir yerden (örn. başka cihaz/sekme) tamamlanmış olduğu tespit edilirse,
  sistem kullanıcıyı otomatik olarak Görüşme Detayı ekranına yönlendirmelidir.
- **FR-015**: Liste veya detay verisi yüklenirken bir ağ/sunucu hatası oluşursa, sistem
  kullanıcıya anlaşılır bir hata mesajı ve tekrar deneme imkânı sunmalıdır.

- **FR-016**: Sistem, tamamlanmış ve raporu hazır bir görüşme için raporun PDF
  olarak dışa aktarılmasına izin vermelidir.
- **FR-017**: Sistem, aynı meslek/pozisyon için birden fazla tamamlanmış görüşme
  bulunduğunda, skorların zaman içindeki değişimini gösteren bir trend grafiği
  görüntüleyebilmelidir.

### Key Entities *(include if feature involves data)*

Bu dilim yeni bir veri varlığı **tanımlamaz**; `002-interview` dilimindeki `Interview`
varlığını (bkz. Bağımlılıklar bölümü) kavramsal düzeyde tüketir:

- **Görüşme (Interview) — kavramsal görünüm**: Bu dilimin ihtiyaç duyduğu alanlar: pozisyon
  adı, oluşturulma tarihi, mod (sözlü/yazılı), deneyim seviyesi (stajyer/junior/senior),
  durum (tamamlandı / yarım kaldı), silinme zamanı (soft-delete
  işareti — kullanıcı tarafında `null` olmayanlar hiç görünmez), sorular, cevaplar,
  değerlendirme raporu (varsa) ve rapor üretim durumu (başarılı/başarısız). Bu alanların
  gerçek şeması ve kaynağı `002-interview/data-model.md`'de tanımlıdır; bu dilim onu
  yeniden tanımlamaz, yalnızca kullanıcıya sunum (liste + detay) ve silme davranışı ekler.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Kullanıcılar "Interview History" sekmesine girdikten sonra 2 saniye içinde
  tüm geçmiş görüşme kartlarını görüntüleyebilir.
- **SC-002**: Kullanıcıların en az %95'i, yarım kalmış bir görüşmeye "Devam Et" aksiyonuyla
  kaldığı sorudan (önceki cevaplar kaybolmadan) başarıyla devam edebilir.
- **SC-003**: Kullanıcıların tamamladığı bir görüşmenin detayına (sorular + cevaplar +
  rapor) erişimi 3 tıklama/etkileşim içinde (Dashboard → History sekmesi → kart seçimi)
  tamamlanabilir.
- **SC-004**: Bir kullanıcı bir görüşmeyi sildiğinde, bu kayıt kendi listesinden %100
  oranında kaybolurken, admin tarafında hiçbir veri kaybı olmadan "Silindi" rozetiyle
  görüntülenebilir durumda kalır.
- **SC-005**: Silme onay adımı sayesinde yanlışlıkla/istemsiz silme sonucu geri dönüşü
  olmayan veri kaybı vakaları sıfıra iner (kullanıcı her zaman onay ekranında vazgeçebilir).

## Assumptions

- Görüşme oluşturma, soru-cevap akışı, cevap kaydı ve rapor üretimi tamamen `002-interview`
  dilimi tarafından sağlanır; bu dilim yalnızca listeleme, devam etmeye yönlendirme, detay
  görüntüleme ve silme davranışı ekler.
- "Devam Et" aksiyonu kullanıcıyı `002-interview` dilimindeki mevcut soru-cevap ekranına
  yönlendirir; soru-cevap etkileşiminin kendisi (soru gösterimi, cevap doğrulama, adaptif
  akış vb.) bu dilimin kapsamı dışındadır.
- Soft-delete, kullanıcı tarafında kaydı tamamen görünmez kılar; kısmi görünürlük (örn.
  "silinmiş öğeleri göster" filtresi kullanıcı tarafında) bu MVP kapsamında yoktur.
- Bir kullanıcı için eşzamanlı olarak birden fazla "Yarım Kaldı" görüşme bulunabilir; sistem
  tek bir aktif görüşmeyle sınırlama yapmaz (aksi `002-interview` tarafından zorunlu
  kılınmadıkça).
- Meslek/pozisyon filtresi ve admin'e özgü istatistik görünümleri bu dilimin kapsamı
  dışındadır (bkz. `002-interview/contracts/interview-api.md` — bu parametreler açıkça
  kapsam dışı bırakılmıştır); ileride `005-admin` dilimine aittir.
- PDF dışa aktarım ve skor trendi grafiği **MVP kapsamındadır** (2026-07-31 kararı ile
  Bonus'tan yükseltildi); ancak sıralamada diğer dört hikâyeden sonra gelir çünkü onların
  ürettiği veriye (rapor, tamamlanmış görüşme geçmişi) bağımlıdır.

## Bağımlılıklar / Entegrasyon Noktaları

- **`002-interview` dilimi (bağımlılık, salt referans — dosyaları değiştirilmez)**:
  - `specs/002-interview/data-model.md` içindeki `Interview` varlığının `status`
    (`in_progress` | `completed`) ve `deletedAt` (soft-delete işareti, İlke VI) alanları bu
    dilimin liste/detay/silme davranışının veri temelidir.
  - `specs/002-interview/contracts/interview-api.md` içindeki `GET /api/interviews`
    (liste, soft-delete görünürlük filtresi uygulanmış özet) ve `GET /api/interviews/:id`
    (detay/devam etme — `in_progress` iken cevaplanmamış soruya kadar, `completed` iken
    tam içerik + rapor) uç noktaları bu dilimin "listeleme" (Story 1) ve "devam etme /
    detay görüntüleme" (Story 2, 3) senaryolarının veri kaynağıdır.
  - `002-interview/contracts/interview-api.md` §2 notu açıkça belirtir: **silme uç noktası
    ve meslek filtresi parametreleri o dilimin kapsamı dışındadır** — silme davranışı
    (Story 4, FR-010–FR-013) bu dilimin (`004-history`) sorumluluğundadır.
- **Gelecekteki `005-admin` dilimi (bu dilime bağımlı olacak)**: Admin panelinin "silindi"
  görünümü (görüşme listesinde/detayında `deletedAt` alanının gösterimi), bu dilimde
  netleştirilen soft-delete kuralına (FR-011, FR-012) dayanacaktır. `005-admin` spec'i
  yazılırken bu dilimdeki silme davranışı **değiştirilmeden** referans alınmalıdır.
