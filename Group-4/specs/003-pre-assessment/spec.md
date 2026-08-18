# Özellik Spesifikasyonu: Ön Yetkinlik Değerlendirmesi (Pre-assessment)

**Özellik Dalı (Branch)**: `003-pre-assessment`

**Oluşturulma**: 2026-07-30

**Durum**: Taslak

**Girdi**: Kullanıcı açıklaması: "AI destekli Mock Interview uygulamasının ikinci dikey dilimi — Pre-assessment (Ön Yetkinlik Değerlendirmesi): giriş yapmış kullanıcı ilgi alanı (frontend / backend / ml) ve deneyim seviyesi (intern / junior / senior) seçerek tek seferlik bir ön değerlendirme formu doldurur; sistem LLM ile bir yetkinlik raporu üretir, kaydeder ve kullanıcıya gösterir. Görüşme (interview) akışından bağımsızdır."

---

## Kapsam Notu

Bu spec **yalnızca** Ön Yetkinlik Değerlendirmesi dikey dilimini kapsar. Aşağıdakiler **KAPSAM DIŞIDIR** ve ayrı dilimlerde ele alınacaktır:

- Görüşme (mülakat) akışı ve cevaplama
- İş ilanı girişi (serbest metin veya PDF) ve PDF metin çıkarımı
- Görüşme sorularının üretimi
- Görüşme değerlendirme raporu (Teknik / Davranışsal / Genel)
- Admin paneli, istatistik ekranları ve maliyet raporlaması *(bu dilim yalnızca token/maliyet **kaydını** üretir; **görüntülenmesi** admin diliminin işidir)*

⚠️ **Yukarıdaki "Girdi" satırı tarihsel kayıttır ve artık geçerli değildir.** 2026-08-04 kapsam kararıyla ön değerlendirme girdisi yazılıma özgü olmaktan çıkarılıp **meslek-bağımsız** hale getirilmiştir: "ilgi alanı (frontend / backend / ml)" kavramı kaldırılmış, deneyim seviyesi kullanıcıya sorulmak yerine türetilir olmuştur. Güncel tanım için FR-002 ve Netleştirmeler → Oturum 2026-08-04'e bakınız.

Bu dilim, `001-auth-rol` diliminde tanımlanan **kullanıcı (User)** varlığını ve sahiplik/rol kurallarını hazır kabul eder; kimlik doğrulamayı yeniden tanımlamaz.

Bu dilim, LLM girdi/çıktı sözleşmesinin, şema doğrulamasının, zarif hata davranışının ve token/maliyet kaydının **tasarım sahibidir** (Anayasa İlke VI); sözleşme bu dilimin `contracts/llm-contract.md` ve `data-model.md` dosyalarında tanımlıdır ve `docs/API_CONVENTIONS.md` §3-§4'te cross-cutting olarak kayıtlıdır.

⚠️ **İnşa sahipliği farklıdır:** implementasyon sırası **Auth → Interview → Pre-assessment** olarak kesinleştiğinden, bu sözleşmeyi kodda ilk kuran dilim `002-interview`'dir. Bu dilim paylaşılan `LlmModule`'ü, `TokenUsage` tablosunu, dil çözümleyiciyi ve hız sınırı guard'ını **devralır — yeniden kurmaz**. Devralınan bir bileşen sözleşmeden saparsa düzeltme `002-interview` kapsamında yapılır.

---

## Kullanıcı Senaryoları & Test *(zorunlu)*

> Not: Kabul kriterleri Türkçe Gherkin biçiminde yazılmıştır — **Diyelim ki** (ön koşul), **Olduğunda** (eylem), **O zaman** (beklenen sonuç). Her hikâye mutlu yol (happy path), sınır durumu (edge) ve hata durumu (error) senaryolarını kapsar.

### Kullanıcı Hikâyesi 1 - Ön Değerlendirme Formunu Doldurma ve Rapor Alma (Öncelik: P1)

Oturum açmış bir kullanıcı — **mesleği ne olursa olsun** — Pre-assessment sekmesinden deneyimini ve çalışma tarzını anlatan çoktan seçmeli soruları cevaplar, kendini meslek-bağımsız bir 1-5 ölçeğinde değerlendirir, dilerse yetenek etiketleri ve kısa açık uçlu cevaplar ekler, formu gönderir ve kendisi için üretilmiş bir yetkinlik raporunu görür.

**Neden bu öncelik**: Dilimin çekirdek değeri budur; bu akış olmadan diğer hiçbir hikâye anlam taşımaz. Tek başına gösterilebilir uçtan uca değer üretir (UI → mantık → LLM → veri).

**Bağımsız Test**: Oturum açmış bir kullanıcı formu geçerli seçimlerle gönderdiğinde bir yetkinlik raporunun üretildiği, kalıcı olarak kaydedildiği ve ekranda gösterildiği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** oturum açmış ve daha önce ön değerlendirme yapmamış bir kullanıcı var, **Olduğunda** kullanıcı zorunlu alanları (deneyim, çalışma durumu, dört çalışma tarzı sorusu, öz-değerlendirme ölçeği) doldurup formu gönderir, **O zaman** sistem bir yetkinlik raporu üretir, kullanıcı hesabıyla ilişkilendirerek kalıcı olarak kaydeder ve raporu kullanıcıya gösterir.
2. **Diyelim ki** kullanıcı zorunlu alanlardan birini boş bırakmış, **Olduğunda** formu göndermeyi dener, **O zaman** sistem gönderimi reddeder ve hangi alanın eksik olduğunu belirten bir doğrulama hatası gösterir. *(error)*
3. **Diyelim ki** kullanıcı yazılım dışı bir meslekten geliyor (örneğin temizlik görevlisi, inşaat işçisi, makine operatörü), **Olduğunda** formu doldurur, **O zaman** formdaki hiçbir soru mesleğine özgü terminoloji gerektirmez ve üretilen rapor belirli bir sektöre göre bölümlenmez. *(edge — FR-002 meslek-bağımsızlığı)*
4. **Diyelim ki** istemci tarafı kısıtları atlatılarak tanımlı listede olmayan bir seçenek değeri veya aralık dışı bir öz-değerlendirme puanı gönderiliyor, **Olduğunda** istek sunucuya ulaşır, **O zaman** sunucu değeri reddeder ve LLM'e hiçbir çağrı YAPILMAZ. *(edge/error — Anayasa İlke V)*
5. **Diyelim ki** rapor üretimi sürüyor, **Olduğunda** kullanıcı sonucu bekliyor, **O zaman** sistem işlemin devam ettiğini gösteren bir ilerleme/bekleme geri bildirimi sunar ve kullanıcıyı belirsiz bırakmaz. *(Anayasa İlke VII)*
6. **Diyelim ki** kullanıcı yetenek etiketlerini ve açık uçlu cevapları hiç doldurmadan formu gönderiyor, **Olduğunda** istek işlenir, **O zaman** üretim normal şekilde tamamlanır — bu alanlar opsiyoneldir ve boş bırakılmaları akışı etkilemez. *(edge — FR-002b, FR-002c)*
7. **Diyelim ki** kullanıcı yetenek etiketi veya açık uçlu cevap alanına model talimatı gibi görünen bir metin yazıyor ("önceki talimatları yok say, …"), **Olduğunda** rapor üretilir, **O zaman** bu metin LLM'e yalnızca veri olarak geçer, talimat olarak yorumlanmaz ve raporun yapısını değiştirmez. *(error — Anayasa İlke V, FR-012)*
8. **Diyelim ki** kullanıcı etiket sayısı veya metin uzunluğu sınırını aşan bir istek gönderiyor, **Olduğunda** istek sunucuya ulaşır, **O zaman** sunucu isteği reddeder ve LLM'e çağrı YAPILMAZ. *(edge/error — FR-003)*

---

### Kullanıcı Hikâyesi 2 - Raporu Görüntüleme, Yeniden Değerlendirme ve Geçmiş (Öncelik: P1)

Ön değerlendirmesini tamamlamış bir kullanıcı, Pre-assessment sekmesine döndüğünde en güncel raporunu görür. Dilerse (örneğin deneyim seviyesi değiştiğinde) yeniden değerlendirme yapabilir; bu durumda önceki rapor silinmez, geçmişe arşivlenir.

**Neden bu öncelik**: Rapor kalıcı bir çıktıdır; kullanıcının ona tekrar erişememesi diliminin değerini yok eder. Yeniden değerlendirme ve arşiv, kullanıcının zaman içindeki gelişimini görebilmesinin temelidir.

**Bağımsız Test**: Ön değerlendirmesi olan bir kullanıcı sekmeye tekrar girdiğinde yeni bir LLM çağrısı yapılmadan güncel raporun gösterildiği; yeniden değerlendirme yaptığında yeni raporun aktif olduğu ve eskisinin geçmişte erişilebilir kaldığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** kullanıcının tamamlanmış bir ön değerlendirme raporu var, **Olduğunda** kullanıcı Pre-assessment sekmesine girer, **O zaman** sistem en güncel (aktif) raporu gösterir ve YENİ bir LLM çağrısı yapmaz.
2. **Diyelim ki** kullanıcının tamamlanmış bir ön değerlendirme raporu var, **Olduğunda** kullanıcı yeniden değerlendirme yapar, **O zaman** sistem yeni bir rapor üretir, bu raporu aktif kayıt yapar ve önceki raporu SİLMEDEN geçmişe arşivler.
3. **Diyelim ki** kullanıcının birden fazla arşivlenmiş ön değerlendirmesi var, **Olduğunda** kullanıcı geçmişini görüntüler, **O zaman** sistem raporları tarihe göre sıralı listeler ve kullanıcı eski bir raporu açıp içeriğini görebilir.
4. **Diyelim ki** kullanıcı hiç ön değerlendirme yapmamış, **Olduğunda** Pre-assessment sekmesine girer, **O zaman** sistem boş durum (empty state) ile formu gösterir. *(edge)*
5. **Diyelim ki** kullanıcı yeniden değerlendirme başlattı ancak üretim başarısız oldu, **Olduğunda** hata oluşur, **O zaman** önceki aktif rapor DEĞİŞMEDEN kalır ve kullanıcı raporsuz bırakılmaz. *(edge/error)*

---

### Kullanıcı Hikâyesi 3 - LLM Hatasında Zarif Davranış ve Kullanıcı Kontrolü (Öncelik: P1)

Rapor üretimi sırasında LLM hata verir, boş yanıt döner veya beklenen biçime uymayan bir çıktı üretirse, kullanıcı ne olduğunu anlar ve tekrar deneyebilir; sistem sessizce başarısız olmaz veya bozuk bir rapor göstermez.

**Neden bu öncelik**: Anayasa İlke VI sessiz başarısızlığı yasaklar ve İlke VII kullanıcıya kontrol sunmayı zorunlu kılar. LLM çağrısı bu dilimdeki tek dış bağımlılıktır; hata yolu mutlu yol kadar kritiktir.

**Bağımsız Test**: LLM yanıtı hata/boş/şema-dışı olacak şekilde taklit edildiğinde, kullanıcıya anlaşılır bir hata mesajı ve "tekrar dene" seçeneği sunulduğu, yarım/bozuk raporun kaydedilmediği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** LLM sağlayıcısı hata döndürüyor veya erişilemiyor, **Olduğunda** kullanıcı formu gönderir, **O zaman** sistem anlaşılır bir hata mesajı ile birlikte "tekrar dene" seçeneği sunar ve eksik/bozuk bir raporu KAYDETMEZ. *(error)*
2. **Diyelim ki** LLM boş yanıt veya beklenen rapor şemasına uymayan bir çıktı döndürdü, **Olduğunda** sistem yanıtı doğrular, **O zaman** doğrulama başarısız sayılır, rapor kaydedilmez ve kullanıcıya hata + tekrar deneme seçeneği gösterilir. *(error)*
3. **Diyelim ki** LLM çağrısı 30 saniyeyi aşıyor, **Olduğunda** süre sınırı dolar, **O zaman** sistem çağrıyı sonlandırır, kullanıcıyı bilgilendirir ve kendiliğinden yeniden denemeden kullanıcıya "tekrar dene" seçeneği sunar. *(edge)*
4. **Diyelim ki** bir rapor üretim denemesi başarısız oldu, **Olduğunda** kullanıcı "tekrar dene" seçeneğini kullanır, **O zaman** sistem yeni bir üretim denemesi başlatır ve başarılı olursa raporu kaydeder; başarısız denemeler arşive tamamlanmış kayıt olarak EKLENMEZ.
5. **Diyelim ki** üretilen rapor LLM tarafından düşük güvenle işaretlendi veya girdi yetersizliği nedeniyle sınırlı, **Olduğunda** rapor kullanıcıya sunulur, **O zaman** sistem bu belirsizliği gizlemez; raporun AI tarafından üretildiğini ve sınırlılığını açıkça belirtir. *(Anayasa İlke VII)*

---

### Kullanıcı Hikâyesi 4 - Erişim Denetimi ve Sahiplik (Öncelik: P1)

Ön değerlendirme yalnızca oturum açmış kullanıcılara açıktır; "kullanıcı" rolündeki bir hesap yalnızca kendi raporunu görebilir, "admin" rolündeki hesap ise tüm kullanıcıların raporlarını okuyabilir.

**Neden bu öncelik**: Rapor kişisel veridir; sızması gizlilik ihlalidir. Anayasa İlke V sunucu tarafı yetki kontrolünü zorunlu kılar.

**Bağımsız Test**: Oturum açmamış bir isteğin reddedildiği, bir kullanıcının başka bir kullanıcının rapor kaydına erişemediği ve adminin erişebildiği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** oturum açmamış bir ziyaretçi var, **Olduğunda** ön değerlendirme formuna veya bir rapora erişmeye çalışır, **O zaman** sistem erişimi reddeder ve giriş yapılmasını ister. *(error)*
2. **Diyelim ki** A ve B olmak üzere "kullanıcı" rolünde iki hesap ve A'ya ait bir ön değerlendirme raporu var, **Olduğunda** kullanıcı B doğrudan bu rapora erişmeye çalışır, **O zaman** sistem sunucu tarafında erişimi reddeder ve raporun içeriğini sızdırmaz. *(error)*
3. **Diyelim ki** bir kullanıcının kendi raporu var, **Olduğunda** kullanıcı raporunu görüntüler, **O zaman** sistem erişime izin verir.
4. **Diyelim ki** farklı kullanıcılara ait ön değerlendirme raporları var, **Olduğunda** "admin" rolündeki bir hesap bu raporları görüntüler, **O zaman** sistem tüm raporlara okuma erişimi verir.
5. **Diyelim ki** "admin" rolündeki bir hesap var, **Olduğunda** admin bir ön değerlendirme kaydını oluşturmayı, değiştirmeyi veya silmeyi dener, **O zaman** sistem işlemi reddeder (admin erişimi salt okunurdur). *(edge/error)*
6. **Diyelim ki** yalnızca istemci tarafı kontrolleri atlatılarak doğrudan bir rapor kaynağına istek yapılıyor, **Olduğunda** istek sunucuya ulaşır, **O zaman** sunucu tarafı yetki kontrolü isteği reddeder. *(edge/error)*

---

### Kullanıcı Hikâyesi 5 - Token ve Maliyet Kaydı (Öncelik: P2)

Her ön değerlendirme LLM çağrısı için tüketilen token miktarı ve tahmini maliyet kaydedilir; böylece admin dilimi bu veriyi raporlayabilir.

**Neden bu öncelik**: Anayasa İlke VI bunu zorunlu kılar ve admin dilimi buna bağımlıdır; ancak kullanıcıya dönük değer üretmediği için P1 değildir.

**Bağımsız Test**: Bir ön değerlendirme üretildikten sonra, o çağrıya ait token kullanımı ve maliyet bilgisinin ilgili kullanıcı ve kayıtla ilişkili olarak saklandığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** bir ön değerlendirme başarıyla üretildi, **Olduğunda** işlem tamamlanır, **O zaman** sistem bu çağrıya ait token kullanımını (girdi/çıktı) ve tahmini maliyeti, kullanıcı ve kayıt ilişkisiyle birlikte saklar.
2. **Diyelim ki** bir LLM çağrısı başarısız oldu ancak sağlayıcı yine de token tüketti, **Olduğunda** hata işlenir, **O zaman** sistem tüketilen tokenı yine de kaydeder (maliyet takibinde boşluk oluşmaz). *(edge)*
3. **Diyelim ki** token/maliyet kaydı yazılamıyor, **Olduğunda** rapor üretimi başarılı olmuştur, **O zaman** kullanıcıya rapor gösterilmeye devam eder; kayıt hatası kullanıcı akışını bozmaz ancak sessizce yutulmaz (sistem tarafında görünür kılınır). *(edge)*

---

### Sınır Durumları (Edge Cases)

- Kullanıcı formu iki sekmede aynı anda gönderirse ne olur? (Tek bir kayıt oluşur; aynı kullanıcı için aynı anda birden fazla üretim çalışmaz ve aktif rapor tek kalır — bkz. FR-004.)
- Kullanıcı rapor üretilirken sayfayı kapatır veya bağlantısı koparsa ne olur? (Üretim tamamlanırsa rapor kaydedilir ve kullanıcı döndüğünde görür — bkz. Hikâye 2, kriter 1.)
- LLM yanıtı beklenen alanların bir kısmını içeriyor, bir kısmını içermiyorsa ne olur? (Şema doğrulaması başarısız sayılır; kısmi rapor kaydedilmez — bkz. Hikâye 3, kriter 2.)
- Tanımlı listede olmayan bir seçenek değeri veya aralık dışı bir öz-değerlendirme puanı gönderilirse ne olur? (Sunucu reddeder, LLM çağrılmaz — bkz. Hikâye 1, kriter 4.)
- Kullanıcı yetenek etiketine veya açık uçlu cevaba model talimatı yazarsa ne olur? (Metin LLM'e yalnızca veri olarak izole edilerek geçer, talimat olarak yorumlanmaz — bkz. Hikâye 1, kriter 7 ve FR-012.)
- Kullanıcı çok sayıda veya çok uzun yetenek etiketi gönderirse ne olur? (Adet/uzunluk sınırı sunucu tarafında uygulanır, sınırı aşan istek LLM'e ulaşmadan reddedilir — bkz. FR-003.)
- Kullanıcının mesleği öneri listesinde hiç karşılık bulmuyorsa ne olur? (Etiketini serbest metin olarak yazabilir; öneri listesi kapsayıcı olma iddiası taşımaz — bkz. FR-002b, Varsayımlar.)
- Kullanıcı hesabı silinirse ön değerlendirme raporuna ne olur? (Bu dilimde kullanıcı hesabı silme akışı yoktur; rapor kullanıcıya bağlıdır — bkz. Varsayımlar.)
- Ard arda çok sayıda başarısız deneme yapılırsa ne olur? (Saatte 5 üretim çağrısı sınırına takılır; başarısız çağrılar da sayılır — bkz. FR-013.)
- Kullanıcı arka arkaya çok sayıda yeniden değerlendirme yaparsa maliyet nasıl sınırlanır? (Yeniden değerlendirme de aynı saatlik 5 çağrı sınırına tabidir — bkz. FR-013.)
- Hız sınırına takılan kullanıcı ne görür? (Yeni üretim başlatılmaz; sınırın ne zaman sıfırlanacağını belirten anlaşılır bir mesaj gösterilir ve mevcut aktif rapora erişimi engellenmez — bkz. FR-013.)
- Yeniden değerlendirme sürerken kullanıcı raporunu görüntülemek isterse ne görür? (Önceki aktif rapor gösterilmeye devam eder; yeni rapor ancak doğrulamayı geçtiğinde aktif olur — bkz. Hikâye 2, kriter 5.)
- Tarayıcı dili Türkçe veya İngilizce dışında bir dilse rapor hangi dilde üretilir? (`en`'e düşülür — bkz. FR-017.)
- Kullanıcının dil tercihi, eski bir raporu görüntülediği sırada farklıysa ne olur? (Arşivlenmiş rapor üretildiği dilde gösterilir, yeniden çevrilmez — bkz. FR-019.)

## Gereksinimler *(zorunlu)*

### Fonksiyonel Gereksinimler

- **FR-001**: Sistem, ön değerlendirme formuna ve raporlarına erişimi YALNIZCA oturum açmış kullanıcılara vermelidir.
- **FR-002**: Ön değerlendirme formundaki tüm sorular **meslek-bağımsız** olmalıdır: herhangi bir meslek grubundan (inşaat, temizlik, üretim/makine, sağlık, satış, lojistik, bilişim…) bir adayın, mesleğine özgü terminoloji bilmesine gerek kalmadan cevaplayabileceği sorular kullanılır. Belirli bir sektöre özgü seçenek listesi (örneğin yazılım teknolojileri) zorunlu girdi olarak KULLANILMAZ. Sistem aşağıdaki **zorunlu** çoktan seçmeli alanları almalıdır:
  - **Toplam çalışma deneyimi** — kapalı liste (hiç / 1 yıldan az / 1-3 yıl / 3-5 yıl / 5-10 yıl / 10+ yıl), tam olarak bir seçim.
  - **Şu anki çalışma durumu** — kapalı liste (tam zamanlı çalışıyor / yarı zamanlı çalışıyor / iş arıyor / öğrenci), tam olarak bir seçim.
  - **Çalışma tarzı soruları** — her biri tam olarak bir seçim, kapalı liste: (a) hangi tür işte daha verimli olduğu, (b) tek başına mı ekiple mi çalışmayı tercih ettiği, (c) yeni bir işi nasıl öğrendiği, (d) beklenmedik bir sorunla karşılaştığında ilk ne yaptığı.

  **Eğitim durumu** aynı formatta sorulur ancak **opsiyoneldir** (boş bırakılabilir).
- **FR-002a**: Sistem, adayın kendini **meslek-bağımsız** bir dizi nitelik üzerinden **1-5 ölçeğinde** değerlendirmesini almalıdır. Ölçek maddeleri her meslek grubu için anlamlı olmalıdır (örneğin: dikkat ve titizlik, yeni şey öğrenme hızı, insanlarla iletişim, fiziksel dayanıklılık, zaman planlama, baskı altında sakin kalma, sorumluluk alma, ekip içinde uyum). Bu alan **zorunludur**; madde listesi sunucu tarafında tanımlıdır ve istemciden gelen madde adları bu listeye karşı doğrulanır. *(Sosyal beğenilirlik yanlılığı nedeniyle "kurallara uyarım" gibi herkesin en yüksek puanı vereceği maddeler ölçeğe dâhil EDİLMEZ — ayırt edicilik taşımaz.)*
- **FR-002b**: Sistem, adayın **yetenek etiketleri** girmesine izin VERMELİdir. Etiket girişi hem **sunucu tarafında tanımlı öneri listesinden seçimle** hem de **serbest metin** olarak yapılabilir (öneri listesi meslek-bağımsızdır ve kapsayıcı olma iddiası taşımaz). Bu alan **opsiyoneldir**. Serbest metin kabul edildiği için sistem: (a) etiket sayısını ve etiket başına uzunluğu sınırlamalı, (b) etiketleri LLM'e **daima veri olarak izole** etmeli (FR-012), (c) sınırları aşan girdiyi sunucu tarafında reddetmelidir.
- **FR-002c**: Sistem, adaya **kısa açık uçlu** sorular sormalıdır (en iyi olduğu şey, geliştirmek istediği yön, iki yıllık hedefi). Bu alanlar **opsiyoneldir** ve her biri uzunluk sınırına tabidir. Serbest metin oldukları için FR-002b'nin (b) ve (c) maddelerindeki izolasyon ve sınır kuralları burada da aynen geçerlidir.
- **FR-002d**: Sistem, görüşme dilimindeki zorluk seviyesi ön-doldurması için kullanılan **deneyim seviyesi** değerini (`intern` / `junior` / `senior`) kullanıcıya SORMAMALI, **toplam çalışma deneyiminden türetmelidir**. Gerekçe: "junior/senior" yazılım sektörü jargonudur ve meslek-bağımsızlık ilkesini (FR-002) ihlal eder. Türetilen değer kayıtla birlikte saklanır ve `002-interview` FR-021 ön-doldurması bu değeri kullanmaya devam eder.
- **FR-003**: Sistem, gönderilen tüm **kapalı liste** değerlerini (deneyim, çalışma durumu, eğitim, çalışma tarzı seçimleri, öz-değerlendirme madde adları ve puanları) **sunucu tarafında** tanımlı listeye karşı doğrulamalı; liste dışı, aralık dışı veya eksik zorunlu değerlerde isteği reddetmeli ve LLM çağrısı yapmamalıdır. Serbest metin alanları (FR-002b, FR-002c) için doğrulama **uzunluk ve adet sınırlarıyla** yapılır; sınırı aşan istek yine LLM'e ulaşmadan reddedilir. *(Anayasa İlke V)*
- **FR-004**: Sistem, bir kullanıcı için aynı anda **en fazla bir aktif** ön değerlendirme raporu bulunmasını sağlamalı; eşzamanlı gönderimlerde bile tek bir üretim çalışmalı ve mükerrer aktif kayıt oluşmasını ENGELLEMELİdir.
- **FR-005**: Sistem, doğrulanmış girdileri kullanarak LLM'den bir yetkinlik raporu üretmeli ve raporu kullanıcı hesabıyla ilişkilendirerek kalıcı olarak saklamalıdır.
- **FR-006**: Üretilen yetkinlik raporu, ön değerlendirmeye özgü **sabit ve yapılandırılmış** bir şemaya uymalı ve en az şunları içermelidir:
  - **Genel özet** — raporun serbest metin özeti.
  - **Güçlü yönler** — adayın öne çıkan yönlerinin başlık listesi (meslek-bağımsız ifadeler).
  - **Gelişim alanları** — adayın geliştirebileceği yönlerin başlık listesi.
  - **Çalışma tarzı özeti** — adayın çalışma tarzı cevaplarından (FR-002) türeyen kısa metin: nasıl bir ortamda verimli olduğu, nasıl öğrendiği, sorunla nasıl başa çıktığı.
  - **Güven seviyesi** — raporun ne kadar güvenilir olduğuna dair belirteç (düşük / orta / yüksek); İlke VII gereği belirsizliğin gizlenmemesi için zorunludur.

  Rapor **belirli bir mesleğe/sektöre göre bölümlenmez** — 2026-08-04 öncesindeki "ilgi alanı başına değerlendirme" yapısı KALDIRILMIŞTIR (FR-002 meslek-bağımsızlığı gereği; aday hangi meslekten olursa olsun aynı rapor şekli üretilir).

  Bu rapor **öğrenme yol haritası İÇERMEZ** — kişiye özel yol haritası artık görüşme (interview) tamamlandığında, o görüşmenin performansına dayalı olarak üretilir; tanımı `002-interview`'in kendi spec'inde ayrı bir gereksinimdir (bkz. FR-016).
- **FR-006a**: Rapor, serbest metin bloğu olarak DEĞİL, alanları ayrı ayrı erişilebilen **makine-okunur yapılandırılmış veri** olarak saklanmalıdır; böylece ileride başka bir dilim (örneğin görüşme soru üretimi) bu raporu yeniden ayrıştırmaya gerek kalmadan girdi olarak tüketebilir. Bu dilim böyle bir tüketim GERÇEKLEŞTİRMEZ (bkz. FR-016), yalnızca şemayı buna uygun tasarlar.
- **FR-006b**: Rapor **sayısal yetkinlik skoru İÇERMEZ**. Girdi tümüyle adayın **kendi beyanıdır** (deneyim, çalışma tarzı tercihleri, öz-değerlendirme puanları, kendi yazdığı yetenek etiketleri); bundan ölçülmüş bir skor üretmek yanıltıcı olur. Özellikle adayın 1-5 öz-değerlendirme puanları (FR-002a) rapora **puan olarak yansıtılmaz** ve bunlardan ortalama/toplam bir "yetkinlik skoru" HESAPLANMAZ — bunlar yalnızca niteliksel yorumun girdisidir. Rapor niteliksel yönlendirme sunar (güçlü yönler / gelişim alanları / çalışma tarzı), ölçüm iddiasında bulunmaz. *(Anayasa İlke VII — belirsizliği gizlememe)*
- **FR-007**: Sistem, LLM ile etkileşim için açık bir girdi/çıktı sözleşmesi tanımlamalı; dönen yanıtı bu şemaya karşı doğrulamalı ve doğrulamayı geçmeyen yanıtı KAYDETMEMELİdir. *(Anayasa İlke VI)*
- **FR-008**: Sistem, LLM hatası, boş yanıt, şema uyumsuzluğu veya süre aşımı durumunda kullanıcıya anlaşılır bir hata mesajı ve "tekrar dene" seçeneği sunmalıdır; sessiz başarısızlık YASAKTIR. *(Anayasa İlke VI, VII)*
- **FR-008a**: Sistem, LLM üretim çağrısına **30 saniyelik** bir süre sınırı uygulamalı ve sınır dolduğunda çağrıyı sonlandırmalıdır.
- **FR-008b**: Sistem, başarısız veya süresi dolan çağrıları **kendiliğinden yeniden DENEMEMELİdir**; her yeniden deneme kullanıcı tarafından açıkça tetiklenir. *(Anayasa İlke VII — kullanıcı kontrolü; ayrıca gizli maliyet ve FR-013 hakkının sessizce tüketilmesi önlenir)*
- **FR-009**: Sistem, başarısız üretim denemelerini tamamlanmış rapor olarak KAYDETMEMELİ ve başarısız bir yeniden değerlendirme denemesinin mevcut aktif raporu bozmasına veya silmesine izin VERMEMELİdir.
- **FR-009a**: Sistem, kullanıcının yeniden değerlendirme yapmasına izin VERMELİ; yeni rapor aktif kayıt olurken önceki rapor SİLİNMEDEN arşivlenmeli ve kullanıcı tarafından tarih sırasıyla görüntülenebilmelidir.
- **FR-010**: Sistem, her LLM çağrısı için token kullanımını (girdi ve çıktı) ve tahmini maliyeti, kullanıcı ve ilgili kayıt ilişkisiyle birlikte saklamalıdır; bu kayıt başarısız çağrılar için de tutulur. *(Anayasa İlke VI)*
- **FR-011**: Sistem, "kullanıcı" rolündeki bir hesabın YALNIZCA kendi ön değerlendirme raporlarına (aktif ve arşivlenmiş) erişmesine izin VERMELİ; tüm yetki kontrollerini sunucu tarafında yapmalıdır. *(Anayasa İlke V)*
- **FR-011a**: Sistem, "admin" rolündeki hesaba tüm kullanıcıların ön değerlendirme kayıtlarına ve rapor içeriklerine **OKUMA** erişimi vermelidir (`001-auth-rol` FR-010 ile tutarlı). Admin bu kayıtları oluşturamaz, değiştiremez veya silemez.
- **FR-012**: Sistem, kullanıcı girdilerini LLM'e daima **veri** olarak izole etmeli; hiçbir kullanıcı girdisinin model talimatı olarak yorumlanmasına izin VERMEMELİdir. *(Anayasa İlke V)* Bu dilim 2026-08-04 itibarıyla **serbest metin girdisi kabul ettiğinden** (yetenek etiketleri FR-002b, açık uçlu cevaplar FR-002c) bu gereksinim artık teorik değil, **fiilî bir saldırı yüzeyine** karşıdır: serbest metin alanları sistem talimatından ayrı bir veri bloğunda taşınır, sınırlayıcı etiketlerle çevrelenir ve içeriğindeki hiçbir ifade talimat olarak değerlendirilmez.
- **FR-013**: Sistem, kullanıcı başına ön değerlendirme üretim çağrılarını **saatte 5 ile** sınırlamalıdır. Başarılı ve başarısız çağrılar birlikte sayılır (maliyeti doğuran çağrının kendisidir). Sınır aşıldığında sistem yeni üretim başlatmaz ve kullanıcıya sınırın ne zaman sıfırlanacağını bildiren anlaşılır bir mesaj gösterir.
- **FR-014**: Sistem, raporun AI tarafından üretildiğini kullanıcıya açıkça belirtmeli ve raporun kesin bir yetkinlik ölçümü olmadığını (belirsizliği) gizlememelidir. *(Anayasa İlke VII)*
- **FR-015**: Sistem, rapor üretimi sürerken kullanıcıya işlemin devam ettiğini gösteren bir geri bildirim sunmalıdır. *(Anayasa İlke VII)*
- **FR-016**: Sistem, kullanıcının **aktif** bir ön değerlendirme kaydı varsa, o kaydın **tam yapılandırılmış CompetencyReport içeriğini** (genel özet, güçlü yönler, gelişim alanları, çalışma tarzı özeti, güven seviyesi — FR-006) ve kayıttaki **öz-değerlendirme puanları ile yetenek etiketlerini** (FR-002a, FR-002b) görüşme (`002-interview`) soru üretim prompt'una **context olarak** VERMELİdir. Bu içerik LLM'e her zaman **veri** olarak izole edilir, asla model talimatı olarak yorumlanamaz (Anayasa İlke V; FR-012 ile aynı izolasyon disiplini). Ön değerlendirmesi **olmayan** bir kullanıcı görüşme başlatabilmeye devam eder — bu zenginleştirme **zorunlu bir bağımlılık değildir**, yalnızca kayıt varsa devreye girer.
  - Aktarımı kodda **gerçekleştiren taraf `002-interview`'dir** (bu dilimin verisini okur); context'in şekli ve kapsamının **tasarım sahibi bu dilimdir** (`contracts/llm-contract.md`).
  - Zorluk seviyesi ön-doldurması (`experienceLevel` → görüşme formu, `002-interview` FR-021) bu context aktarımından **bağımsız**, ayrı bir form ön-doldurma mekanizmasıdır.
  - Bu davranış artık **Bonus değil, MVP kapsamındadır**; `docs/PLAN.md` Fonksiyon Backlog tablosu buna göre güncellenmelidir.
  - Rapor şemasının makine-okunur olması (FR-006a) bu tüketimin temelidir.
- **FR-017**: Sistem, raporun üretileceği dili kullanıcının etkin dil tercihine göre belirlemelidir. Tercih, tarayıcının bildirdiği dilden otomatik çözümlenir: Türkçe ise `tr`, aksi halde `en`. Bu dilimde kullanıcıya manuel dil değiştirme sunulmaz (`docs/PLAN.md` — auto-detect MVP, manuel seçim Bonus).
- **FR-018**: Dil, LLM girdi/çıktı sözleşmesinde açık bir parametre olmalı ve üretilen raporun tüm metinsel içeriği (genel özet, güçlü yönler, gelişim alanları, çalışma tarzı özeti) o dilde olmalıdır. Rapor şemasının **alan adları ve enum değerleri dilden bağımsız sabittir**; yalnızca içerik çevrilir, böylece şema doğrulaması dile bağımlı hale gelmez.
- **FR-019**: Sistem, her raporun hangi dilde üretildiğini rapor kaydıyla birlikte saklamalıdır; arşivlenmiş raporlar, kullanıcının dil tercihi sonradan değişse bile üretildikleri dilde görüntülenir.

### Anahtar Varlıklar *(veri içerdiği için dahil edilmiştir)*

- **Ön Değerlendirme (PreAssessment)**: Bir kullanıcının bir ön yetkinlik değerlendirmesi girişimini temsil eder. Temel alanlar: `id`, sahibi olan kullanıcı ilişkisi (`userId`); **zorunlu meslek-bağımsız girdiler** — toplam çalışma deneyimi, çalışma durumu, dört çalışma tarzı seçimi (verimlilik tarzı, ekip tercihi, öğrenme tarzı, sorun yaklaşımı), 1-5 öz-değerlendirme puanları (`selfRatings`, FR-002a); **opsiyonel girdiler** — eğitim durumu, yetenek etiketleri (`skills` — serbest/önerili, FR-002b), açık uçlu cevaplar (`openAnswers`, FR-002c); **türetilmiş** deneyim seviyesi (`experienceLevel` — intern/junior/senior, kullanıcıya sorulmaz, FR-002d); üretim dili (`language` — `tr`/`en`), durum (üretiliyor / tamamlandı / başarısız), aktif olup olmadığı (`isActive` — kullanıcı başına en fazla bir aktif kayıt), oluşturulma zamanı. Bir kullanıcının çok sayıda arşivlenmiş kaydı olabilir.

  *(2026-08-04 öncesinde bu varlık `interestAreas` ve `skillSelections` alanlarını taşıyordu; meslek-bağımsızlık kararıyla ikisi de KALDIRILDI.)*
- **Yetkinlik Raporu (CompetencyReport)**: Bir ön değerlendirmeye ait, LLM tarafından üretilmiş ve şemaya göre doğrulanmış yapılandırılmış rapor. Alanlar: genel özet, güçlü yönler (liste), gelişim alanları (liste), çalışma tarzı özeti, güven seviyesi (düşük/orta/yüksek). Sektöre/mesleğe göre bölümlenmez (bkz. FR-006 — eski "ilgi alanı başına değerlendirme" yapısı kaldırıldı). Öğrenme yol haritası İÇERMEZ (taşındı → `002-interview`). Sayısal skor içermez (FR-006b). Serbest metin bloğu olarak değil, alanları ayrı erişilebilir yapılandırılmış veri olarak saklanır (FR-006a).
- **Token Kullanımı (TokenUsage)**: Bir LLM çağrısının maliyet kaydı. Temel alanlar: ilişkili kullanıcı, ilişkili kayıt/işlem türü, girdi token sayısı, çıktı token sayısı, tahmini maliyet, zaman damgası, çağrının başarılı olup olmadığı. Bu varlık cross-cutting'dir; sonraki LLM dilimleri (soru üretimi, görüşme raporu) aynı varlığı kullanır.
- **Kullanıcı (User)**: `001-auth-rol` diliminde tanımlanmıştır. Bu dilim yalnızca `id` ve `role` alanlarına sahiplik/yetki için dayanır; yeniden tanımlamaz. `role` değeri "admin" olan hesaplar tüm ön değerlendirme kayıtlarına salt okunur erişime sahiptir (FR-011a).

## Başarı Kriterleri *(zorunlu)*

### Ölçülebilir Sonuçlar

- **SC-001**: Bir kullanıcı, ön değerlendirme formunun **zorunlu** alanlarını 3 dakikanın altında doldurup gönderebilir (opsiyonel yetenek etiketleri ve açık uçlu cevaplar hariç). *(2026-08-04'te 1 dakikadan yükseltildi: meslek-bağımsız soru seti 6 çoktan seçmeli + 8 maddelik öz-değerlendirme ölçeği içeriyor; eski 1 dakika hedefi 2 alanlı forma göreydi.)*
- **SC-001a**: Formdaki zorunlu soruların %100'ü meslek-bağımsızdır: hiçbiri belirli bir sektöre özgü terminoloji veya araç/teknoloji bilgisi gerektirmez. *(FR-002)*
- **SC-002**: Başarılı gönderimlerin %95'inde yetkinlik raporu 30 saniyenin altında kullanıcıya sunulur. Hiçbir kullanıcı 30 saniyeden uzun bekletilmez; bu süreyi aşan çağrılar sonlandırılıp hata olarak sunulur (FR-008a).
- **SC-003**: Ön değerlendirmesini tamamlamış bir kullanıcı, güncel raporuna sonradan tek adımda (Pre-assessment sekmesine girerek) ulaşabilir.
- **SC-004**: LLM hatası, boş yanıt veya şema uyumsuzluğu durumlarının %100'ünde kullanıcı anlaşılır bir hata mesajı ve tekrar deneme seçeneği görür; bu durumların hiçbirinde eksik veya bozuk rapor kaydedilmez.
- **SC-005**: Oturum açmamış erişim denemelerinin ve "kullanıcı" rolündeki bir hesabın başkasına ait rapora erişim denemelerinin %100'ü sunucu tarafında reddedilir; admin rolündeki okuma erişimi bunun tanımlı istisnasıdır ve yazma denemelerinin %100'ü reddedilir.
- **SC-006**: Tamamlanan her ön değerlendirme için token ve maliyet kaydı oluşur; kayıt kapsama oranı %100'dür.
- **SC-007**: Aynı kullanıcı için eşzamanlı gönderimler dahil hiçbir koşulda birden fazla **aktif** ön değerlendirme kaydı oluşmaz.
- **SC-008**: Tanımlı liste dışı seçenek değeri, aralık dışı öz-değerlendirme puanı veya uzunluk/adet sınırını aşan serbest metin içeren isteklerin %100'ü, LLM çağrısı yapılmadan reddedilir.
- **SC-008a**: Yetenek etiketi veya açık uçlu cevap alanına yerleştirilen talimat benzeri metinlerin %100'ü LLM'e veri olarak geçer; hiçbiri raporun şemasını, dilini veya bölüm yapısını değiştiremez. *(FR-012)*
- **SC-009**: Yeniden değerlendirme yapan bir kullanıcının önceki raporlarının %100'ü erişilebilir kalır; hiçbir tamamlanmış rapor kaybolmaz veya üzerine yazılmaz.
- **SC-010**: Kaydedilen her rapor, tanımlı şemanın tüm zorunlu alanlarını (genel özet, güçlü yönler, gelişim alanları, çalışma tarzı özeti, güven seviyesi) içerir; eksik alanlı rapor kaydedilmez, hiçbir raporda öğrenme yol haritası, sayısal yetkinlik skoru veya mesleğe/sektöre göre bölümlenmiş bir yapı bulunmaz.
- **SC-011**: Üretilen raporların %100'ünde metinsel içerik, kaydedilen dil değeriyle (`tr`/`en`) aynı dildedir; şema alan adları her iki dilde de değişmez.
- **SC-012**: Bir kullanıcı için bir saatlik pencerede 5'ten fazla LLM üretim çağrısı yapılamaz; sınırı aşan isteklerin %100'ü LLM'e ulaşmadan reddedilir.

## Varsayımlar

- Kullanıcı kimlik doğrulama, oturum yönetimi ve rol ayrımı `001-auth-rol` diliminde tamamlanmıştır ve bu dilim tarafından hazır kabul edilir.
- Ön değerlendirme **opsiyoneldir**: kullanıcı bunu yapmadan da görüşme akışını kullanabilir; bir onboarding zorunluluğu değildir (bkz. `docs/APP_FLOW.md` — akışlar bağımsızdır).
- Ön değerlendirmenin **zorunlu** girdileri kapalı seçim listelerinden oluşur; **opsiyonel** girdileri (yetenek etiketleri FR-002b, açık uçlu cevaplar FR-002c) serbest metindir. ⚠️ 2026-08-04 öncesinde bu spec "serbest metin alanı yoktur, injection yüzeyi minimumdur" varsayımına dayanıyordu; meslek-bağımsızlık kararıyla bu varsayım **geçersizleşti**. Serbest metin artık kabul edildiği için izolasyon (FR-012) ve uzunluk/adet sınırı (FR-003) bu dilimde teorik değil **zorunlu** korumalardır.
- Zorunlu çoktan seçmeli soruların hepsi **tekli** seçimdir; öz-değerlendirme ölçeği tüm maddeleri için puan bekler (FR-002a).
- Yetenek etiketi öneri listesi (FR-002b) **kapsayıcı olma iddiası taşımaz** — hiçbir liste tüm meslekleri kapsayamayacağı için serbest giriş bilinçli olarak açık bırakılmıştır. Liste yalnızca kullanıcıya fikir vermek ve yazım tutarlılığını artırmak içindir.
- Rapor kullanıcıya özeldir ve bu dilimde kullanıcı tarafından silinemez; silme/soft-delete davranışı görüşme kayıtları için tanımlıdır ve bu dilimin kapsamı dışındadır. Yeniden değerlendirme eski raporu silmez, arşivler (FR-009a).
- `docs/APP_FLOW.md` ön değerlendirmeyi "tek seferlik" olarak tanımlıyordu; netleştirme sonucunda bu kural **kullanıcı başına tek aktif rapor + arşivlenen geçmiş** olarak revize edilmiştir. ✅ `docs/APP_FLOW.md` §5 bu doğrultuda **güncellendi**.
- `docs/APP_FLOW.md` bölüm 3.1 LLM çıktısını "yetkinlik skorları + metinsel özet" olarak tarif ediyordu; netleştirme sonucunda **sayısal skor kaldırılmıştır** (FR-006b). ✅ `docs/APP_FLOW.md` §3.1 ve §5 **güncellendi**. Rapor ekranında grafik/skor görselleştirmesi bu dilimde YOKTUR; radar/bar chart yalnızca görüşme raporuna aittir (ADR-0011 o dilime aittir).
- Rapor şemasının makine-okunur olması (FR-006a) ileriye dönük bir tasarım tercihiydi; ✅ 2026-08-03 clarify oturumunda fiilen devreye alındı: görüşme dilimi, kullanıcının **aktif** ön değerlendirme raporunun **tam içeriğini** soru üretim prompt'una context olarak alır (FR-016); ayrıca `experienceLevel` ile seviye alanını ön-doldurmaya devam eder (`002-interview` FR-021, bağımsız mekanizma). Rapor yoksa görüşme normal şekilde ve zorunlu bağımlılık olmadan çalışır. Bu dilim context şeklinin tasarım sahibidir; aktarımı kodda gerçekleştiren `002-interview`'dir.
- LLM sağlayıcı seçimi bu spec'in kapsamı dışındadır; ✅ **ADR-0007** ile karara bağlanmıştır (Groq birincil + DeepSeek yedek, tek `openai` SDK) ve `docs/TECH_STACK.md` güncellenmiştir. Spec teknoloji-bağımsızdır; yalnızca davranışı ve sözleşmeyi tanımlar.
- Bu dilimin **tasarladığı** LLM sözleşmesi, şema doğrulaması ve token/maliyet kaydı yapısı tüm LLM dilimleri tarafından paylaşılır. Kodda ilk kuran dilim `002-interview`'dir (sıra kararı); bu dilim devralır ve kendi prompt/şemasını verir.
- Kullanıcı arayüzü teknoloji yığını anayasa gereği sabittir (React 19 + Vite + TypeScript + Tailwind + shadcn/ui); Pre-assessment dashboard'da kendi sekmesi olarak yer alır (`docs/APP_FLOW.md` ekran 5).

## Netleştirmeler (Clarifications)

### Oturum 2026-07-30 (clarify)

- **S:** Admin, ön değerlendirme raporlarını görebilecek mi (FR-011)? → **K:** Evet. Admin tüm kullanıcıların ön değerlendirme kayıtlarına ve rapor içeriklerine OKUMA erişimine sahiptir; `001-auth-rol` FR-010 ile tutarlıdır ve ek istisna kuralı gerekmez. Admin erişimi salt okunurdur — oluşturma/değiştirme/silme yapamaz.
- **S:** LLM zaman aşımı ne olmalı ve sistem otomatik yeniden deneme yapmalı mı (Hikâye 3)? → **K:** 30 saniye timeout (SC-002 ile aynı ölçü). Otomatik yeniden deneme YOK; her tekrar denemeyi kullanıcı açıkça tetikler. Böylece gizli maliyet oluşmaz ve saatlik 5 çağrı hakkı sessizce tükenmez.
- **S:** Hız sınırı kaç olmalı (FR-013)? → **K:** Kullanıcı başına saatte 5 üretim çağrısı; başarılı ve başarısız çağrılar birlikte sayılır. Sınıra takılan kullanıcı yeni üretim başlatamaz ama mevcut raporuna erişmeye devam eder.
- **S:** 0–100 yetkinlik skoru neye dayanacak (FR-006)? → **K:** Skor tamamen KALDIRILDI. Girdi yalnızca kullanıcının kendi beyanı olduğu için sayısal skor yanıltıcı olurdu; rapor niteliksel kalır (genel özet + ilgi alanı başına güçlü/gelişim konuları + yol haritası + güven seviyesi). ✅ `docs/APP_FLOW.md` bölüm 3.1'deki "yetkinlik skorları" ifadesi ve rapor ekranındaki grafik beklentisi bu dilim için **güncellendi**.
- **S:** Rapor hangi dilde üretilecek? → **K:** Kullanıcının etkin dil tercihine göre (TR/EN); tercih tarayıcı dilinden otomatik çözümlenir, TR/EN dışında `en`'e düşer (FR-017). Bu dilimde UI çeviri katmanı veya manuel dil değiştirici KURULMAZ — `docs/PLAN.md` gereği auto-detect MVP, manuel seçim Bonus. Bu dilimin tasarladığı desen, LLM sözleşmesindeki `language` parametresidir; tüm LLM dilimleri aynı deseni kullanır. ✅ Güncelleme: `002-interview` de **aynı `Accept-Language` mekanizmasını** kullanır (`common/language.ts`, `docs/API_CONVENTIONS.md` §4.2) — iş ilanı metninden dil algılama **Bonus'a** alınmıştır. Şema alan adları dilden bağımsız sabit kalır (FR-018).

### Oturum 2026-07-30 (specify)

- **S:** Yetkinlik raporu hangi sabit şemaya sahip olacak (FR-006)? → **K:** Ön değerlendirmeye özgü şema: genel özet + seçilen her ilgi alanı için (güçlü konular, gelişim konuları) + öğrenme yol haritası + güven seviyesi. *(Bu oturumda şema skor içeriyordu; clarify oturumunda skor kaldırıldı — bkz. aşağıdaki clarify kaydı.)* Görüşme raporunun Teknik/Davranışsal/Genel ekseni KULLANILMAZ; iki rapor türü bağımsız evrilir.
- **S:** Rapor, görüşme soru üretimine beslenebilecek yapıda mı olmalı? → **K:** Evet — rapor serbest metin değil, alanları ayrı erişilebilen makine-okunur yapılandırılmış veri olarak saklanır (FR-006a). Ancak bu dilimde görüşmeye aktarım YAPILMAZ (FR-016); şema yalnızca ileriye dönük hazır tutulur.
- **S:** Kullanıcı ön değerlendirmeyi tekrar yapabilir mi (FR-004, Hikâye 2)? → **K:** Evet. Yeniden değerlendirme yapılabilir; yeni rapor aktif olur, önceki rapor silinmeden arşivlenir ve geçmişten görüntülenebilir. Kullanıcı başına en fazla **bir aktif** rapor bulunur. ✅ `docs/APP_FLOW.md`'deki "tek seferlik" ifadesi bu doğrultuda **güncellendi**.

### Oturum 2026-08-03 (clarify)

- **S:** Ön değerlendirme formuna eklenecek yeni soru alanları hangi kapalı-seçim formatını almalı (FR-002)? → **K:** Her ilgi alanına özgü teknoloji/araç checklist'i (çoklu seçim, sunucu tarafı kapalı liste) + seçilen her öğe için 1-5 Likert öz-değerlendirmesi. Serbest metin yok (Anayasa İlke V). Alanlar opsiyoneldir; girilirse LLM'e yapılandırılmış veri olarak verilir ve ilgi alanı başına güçlü/gelişim konularının tutarlılığını artırır (FR-002a).
- **S:** Ön değerlendirme raporu görüşme soru üretim prompt'una context olarak verilirken tam rapor mu, özet mi geçirilmeli (eski FR-016)? → **K:** Tam yapılandırılmış CompetencyReport JSON'u context olarak geçirilir (özetleme adımı yok — zaten şema doğrulamalı, sınırlı boyutlu veri). Eski "rapor içeriği görüşmeye aktarılamaz" kuralı **tersine çevrildi**; aktarım artık MVP kapsamında ve zorunlu olmayan bir zenginleştirme (ön değerlendirmesi olmayan kullanıcı etkilenmez). FR-016 buna göre yeniden yazıldı.
- **S:** Öğrenme yol haritası bu dilimin rapor şemasından (FR-006) tamamen kaldırılıp yerine ne konulmalı? → **K:** Bu dilimde yalnızca kaldırılır (FR-006, SC-010, Anahtar Varlıklar güncellendi); *(bu oturumda şema öğrenme yol haritası içeriyordu — bkz. 2026-07-30 specify kaydı, bu clarify ile üzerine yazıldı)*. Kişiye özel yol haritası artık görüşme tamamlandığında, o görüşmenin performansına göre üretilir — tam tanımı ayrı bir `002-interview` clarify oturumuna bırakılır, bu spec sadece yönlendirme notu taşır.

### Oturum 2026-08-04 (kapsam kararı — meslek-bağımsızlık)

Tetikleyici: uygulamanın bir mühendise gösterilmesi sonrası gelen geri bildirim — *"bu uygulamayı sadece yazılımcılar kullanmayacak; temizlikçi de, inşaatçı da, makineci de cevaplayabilmeli."* Bu, o ana kadarki tüm ön değerlendirme girdi tasarımının (ilgi alanı = frontend/backend/ml, teknoloji checklist'i = react/nodejs/python) yazılım sektörüne kilitli olduğunu ortaya çıkardı.

- **S:** Ön değerlendirme soruları hangi kapsamda olmalı? → **K:** Tüm sorular **meslek-bağımsız** olacak (FR-002). `InterestArea` kavramı (frontend/backend/ml) ve ona bağlı teknoloji/araç checklist'i (eski FR-002a) **tamamen kaldırıldı**. Yerine her meslek grubunun cevaplayabileceği set geldi: deneyim süresi + çalışma durumu + 4 çalışma tarzı sorusu (zorunlu, çoktan seçmeli), meslek-bağımsız 8 maddelik 1-5 öz-değerlendirme ölçeği (zorunlu), eğitim durumu (opsiyonel).
- **S:** Teknoloji checklist'inin yerine yetenek girişi nasıl olmalı? → **K:** **Etiket girişi** — hem sunucu tarafı öneri listesinden seçim hem de **serbest metin** girişi (FR-002b). Kapalı liste ısrarı terk edildi çünkü hiçbir liste tüm meslekleri kapsayamaz. Bedeli: bu dilim ilk kez gerçek bir prompt injection yüzeyi kazandı — izolasyon (FR-012) ve sınır doğrulaması (FR-003) buna göre güçlendirildi.
- **S:** Açık uçlu sorular olacak mı? → **K:** Evet, 3 kısa açık uçlu soru (en iyi olunan şey, geliştirilmek istenen yön, 2 yıllık hedef), **opsiyonel** ve uzunluk sınırlı (FR-002c). Çalışma koşulları soruları (vardiya/seyahat/fiziksel iş) ve belge/sertifika listesi **kapsama alınmadı** — ilki mülakat/ilan tarafına ait, ikincisi yetenek etiketleriyle örtüşüyor.
- **S:** `experienceLevel` (intern/junior/senior) ne olacak — `002-interview` FR-021 ön-doldurması buna bağlı? → **K:** Kullanıcıya **sorulmayacak**, toplam çalışma deneyiminden **türetilecek** (FR-002d). "Junior/senior" yazılım jargonudur; meslek-bağımsızlık ilkesini ihlal eder. Türetilen değer saklanır, `002-interview` ön-doldurması bozulmadan çalışmaya devam eder.
- **S:** Rapor şeması nasıl değişecek? → **K:** "İlgi alanı başına güçlü/gelişim konuları" (`alanlar`) yapısı **kaldırıldı** — mesleğe göre bölümleme meslek-bağımsızlıkla çelişiyor. Yeni şema: genel özet + güçlü yönler + gelişim alanları + **çalışma tarzı özeti** + güven seviyesi (FR-006). Çalışma tarzı özeti yeni eklendi çünkü görüşme context'i (FR-016) için en ayırt edici sinyal orada.
- **S:** Öz-değerlendirme puanları rapora skor olarak yansıyacak mı? → **K:** Hayır. FR-006b güçlendirildi: puanlardan ortalama/toplam bir "yetkinlik skoru" hesaplanmaz, yalnızca niteliksel yorumun girdisidir. Girdi tümüyle adayın kendi beyanı olduğu için ölçüm iddiası yanıltıcı olurdu.
- **S:** SC-001 ("form 1 dakikada doldurulur") hâlâ geçerli mi? → **K:** Hayır, 3 dakikaya çıkarıldı. Eski hedef 2 alanlı forma göreydi; yeni set 6 çoktan seçmeli + 8 ölçek maddesi içeriyor.

> Kalan belirsizlikler `/speckit-clarify` oturumunda ele alınacaktır.
