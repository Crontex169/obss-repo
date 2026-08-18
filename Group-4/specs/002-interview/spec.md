# Özellik Spesifikasyonu: Görüşme (Interview)

**Özellik Dalı (Branch)**: `002-interview`

**Oluşturulma**: 2026-07-30

**Durum**: Taslak

**Girdi**: Kullanıcı açıklaması: "AI destekli Mock Interview uygulamasının ikinci dikey dilimi — Interview (Görüşme): Kullanıcı iş ilanını (serbest metin veya PDF yükleyerek) girer, soru sayısı N ve mod (sözlü real-time sesli AI asistan / yazılı) seçer. LLM iş ilanına göre N soru üretir (karışık tip: çoktan seçmeli veya açık uçlu). Sorular sırayla (soru i tamamlanmadan soru i+1 gösterilmez) kullanıcıya sunulur ve cevaplanır. Adaptif soru akışı (bonus): her cevap sonrası LLM cevabı değerlendirip bir sonraki sorunun zorluğunu/odağını buna göre ayarlayabilir. Kullanıcı görüşmeyi yarıda bırakıp sonra kaldığı yerden devam edebilir (resume, status=in_progress). Tüm sorular cevaplandıktan sonra LLM tüm soru-cevapları değerlendirip bir değerlendirme raporu üretir: Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar, ve Teknik/Davranışsal/Genel olmak üzere 3 sabit eksende skor + gerekirse birkaç ek değerlendirme notu. Rapor kullanıcıya sunulur ve daha sonra Interview History sekmesinden tekrar görüntülenebilir."

---

## Kapsam Notu

Bu spec **yalnızca** Görüşme (Interview) dikey dilimini kapsar. Aşağıdakiler **KAPSAM DIŞIDIR** ve ayrı dilimlerde ele alınacaktır:

- Ön Yetkinlik Değerlendirmesi / Pre-assessment akışının kendisi — `003-pre-assessment` dilimi. **Bu dilimle bağı:** yalnızca **opsiyonel zenginleştirme**; aktif bir ön değerlendirme varsa seviye alanı ön-doldurulur (FR-021). Ön değerlendirme raporunun soru/rapor prompt'una ek bağlam olarak geçirilmesi **Bonus** kapsamındadır: bu dilim prompt'ta yalnızca **slot** hazırlar, dolduran kod `003-pre-assessment` diliminde gelir. **Zorunlu bağımlılık yoktur** — ön değerlendirmesi olmayan kullanıcı görüşme başlatabilir.
- Kimlik doğrulama & rol (001-auth-rol diliminde zaten ele alındı; bu dilim onu bir bağımlılık olarak varsayar — her görüşme kaydı bir sahibe (`userId`) bağlıdır ve yalnızca sahibi tarafından erişilebilir)
- Admin istatistik ekranları ve token/maliyet raporlama ekranları (`005-admin` — ancak bu dilimde token/maliyet verisinin üretilip kaydedilmesi ve admin'in ihtiyaç duyduğu alanların (pozisyon, tamamlanma zamanı) doldurulması **zorunludur**; ekranlaştırma kapsam dışıdır — FR-016, FR-023, FR-024)
- Interview History listesi/silme akışının UI detayları ve **silme uç noktası** (`004-history`); bu dilim yalnızca veri temelini (görüşme kayıtları, durumları, raporları), soft-delete alanını ve **liste filtresini** üretir (`docs/API_CONVENTIONS.md` §4.3)

**Bu dilimin İNŞA ETTİĞİ cross-cutting altyapı** *(sonraki dikeyler devralır — implementasyon sırası Auth → Interview → Pre-assessment)*:

| Bileşen | Tasarım sahibi | Not |
|---------|----------------|-----|
| Paylaşılan `LlmModule` (`generateStructured`, sağlayıcı port, iki katmanlı şema, hata sınıfları, timeout) | `docs/API_CONVENTIONS.md` §3 + `specs/003-pre-assessment/contracts/llm-contract.md` | Bu dilim **kurar**; `003-pre-assessment` devralır |
| `TokenUsage` tablosu + `LlmOperation` enum | `specs/003-pre-assessment/data-model.md` | Tek maliyet tablosu (§4.1) |
| Dil çözümleyici (`Accept-Language` → tr/en) + `ReportLanguage` enum | `docs/API_CONVENTIONS.md` §4.2 | FR-020 |
| LLM hız sınırı guard'ı | `docs/API_CONVENTIONS.md` §3.5 | FR-022 |
| `ExperienceLevel` enum | `specs/003-pre-assessment/data-model.md` | FR-021 (ortak enum, eşleme yok) |

---

## Kullanıcı Senaryoları & Test *(zorunlu)*

> Not: Kabul kriterleri Türkçe Gherkin biçiminde yazılmıştır — **Diyelim ki** (ön koşul), **Olduğunda** (eylem), **O zaman** (beklenen sonuç). Her hikâye mutlu yol (happy path), sınır durumu (edge) ve hata durumu (error) senaryolarını kapsar.

### Kullanıcı Hikâyesi 1 - İş İlanı Girme ve Soru Üretimi (Öncelik: P1)

Kullanıcı, yeni bir görüşme başlatmak için iş ilanını (serbest metin yazarak veya PDF yükleyerek) girer, üretilecek soru sayısını (N) ve görüşme modunu (sözlü/yazılı) seçer; sistem iş ilanına göre LLM aracılığıyla N adet karışık tipte (çoktan seçmeli veya açık uçlu) soru üretir.

**Neden bu öncelik**: Görüşme dilimi için giriş kapısıdır; iş ilanı ve soru üretimi olmadan hiçbir soru-cevap akışı başlayamaz. Tek başına (soru listesinin başarıyla üretildiğini göstererek) gösterilebilir değer üretir.

**Bağımsız Test**: Geçerli bir iş ilanı metni ve N değeri girilerek görüşmenin oluşturulduğu, tam olarak N adet sorunun üretildiği ve görüşme durumunun "devam ediyor" (in_progress) olarak başladığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** oturum açmış bir kullanıcı serbest metin olarak bir iş ilanı girmiş ve N=8, mod=yazılı seçmiş, **Olduğunda** kullanıcı görüşmeyi başlatır, **O zaman** sistem iş ilanına dayalı tam olarak 8 soru üretir, görüşme kaydını "devam ediyor" durumunda oluşturur ve kullanıcıya ilk soruyu gösterir.
2. **Diyelim ki** oturum açmış bir kullanıcı iş ilanını PDF dosyası olarak yüklemiş, **Olduğunda** kullanıcı görüşmeyi başlatır, **O zaman** sistem PDF'ten metni sunucu tarafında çıkarır ve bu metne dayalı soru üretimini aynı şekilde gerçekleştirir.
3. **Diyelim ki** kullanıcı soru sayısı alanına izin verilen aralığın (5-20) dışında bir değer girmiş, **Olduğunda** kullanıcı görüşmeyi başlatmaya çalışır, **O zaman** sistem isteği reddeder ve geçerli aralığı belirten bir doğrulama hatası gösterir. *(error)*
4. **Diyelim ki** kullanıcı boş bir iş ilanı metni göndermiş veya yüklediği PDF'ten metin çıkarılamamış (taranmış görüntü, bozuk dosya vb.), **Olduğunda** kullanıcı görüşmeyi başlatmaya çalışır, **O zaman** sistem isteği reddeder ve iş ilanı içeriğinin okunamadığını/eksik olduğunu belirten anlaşılır bir hata mesajı gösterir. *(error)*
5. **Diyelim ki** LLM soru üretimi sırasında bir hata döndürür veya zaman aşımına uğrar, **Olduğunda** kullanıcı görüşmeyi başlatmaya çalışır, **O zaman** sistem yarım kalmış bir görüşme kaydı OLUŞTURMAZ ve kullanıcıya tekrar deneme imkânı sunan bir hata mesajı gösterir. *(edge/error)*
6. **Diyelim ki** kullanıcı iş ilanı alanına bir işi/rolü tarif etmeyen bir metin göndermiş (örn. yemek tarifi, haber metni, anlamsız karakter dizisi veya yalnızca modele verilmiş talimatlardan oluşan metin), **Olduğunda** kullanıcı görüşmeyi başlatır, **O zaman** sistem HİÇ SORU ÜRETMEZ, görüşme kaydı oluşturmaz ve girilen metnin iş ilanı olarak anlaşılamadığını belirten bir hata mesajı gösterir. *(error)*

---

### Kullanıcı Hikâyesi 2 - Soru-Cevap Akışı (Sıralı, Kilit Kuralı) (Öncelik: P1)

Kullanıcı, üretilen soruları sırasıyla cevaplar. Soru `i` cevaplanıp kaydedilmeden soru `i+1` kullanıcıya gösterilmez; kullanıcı geriye dönüp önceki bir cevabı değiştiremez.

**Neden bu öncelik**: Görüşmenin çekirdek etkileşimidir; soru üretimi tek başına değer üretmez, kullanıcının soruları cevaplayıp ilerleyebilmesi gerekir. Değerlendirme raporunun ön koşuludur.

**Bağımsız Test**: Bir görüşmede sorulara sırayla cevap verildiğinde her cevaptan sonra bir sonraki sorunun açıldığı, cevaplanmamış bir sorunun asla önceden gösterilmediği ve tüm sorular bitince görüşmenin tamamlandığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** "devam ediyor" durumundaki bir görüşmede kullanıcıya soru `i` gösterilmiş, **Olduğunda** kullanıcı soru `i`'yi cevaplayıp gönderir, **O zaman** sistem cevabı kaydeder ve soru `i+1`'i (varsa) kullanıcıya gösterir; soru `i+1` bu ana kadar hiç gösterilmemiştir.
2. **Diyelim ki** kullanıcı son soruyu (soru N) cevaplamış, **Olduğunda** cevap kaydedilir, **O zaman** sistem görüşmeyi "tamamlandı" durumuna geçirir ve değerlendirme raporu üretim sürecini başlatır.
3. **Diyelim ki** kullanıcı zaten cevaplanmış bir soruya (örneğin doğrudan bir istek ile) tekrar cevap göndermeye veya önceki bir cevabı değiştirmeye çalışır, **Olduğunda** istek sunucuya ulaşır, **O zaman** sistem isteği reddeder; zaten cevaplanmış sorular değiştirilemez. *(edge/error)*
4. **Diyelim ki** kullanıcı henüz sırası gelmemiş bir soruya (örn. soru `i+2`) doğrudan cevap göndermeye çalışır (istemci tarafı kontrolleri atlatarak), **Olduğunda** istek sunucuya ulaşır, **O zaman** sunucu tarafı kural bu isteği reddeder ve yalnızca sıradaki cevaplanmamış soruyu kabul eder. *(edge/error)*
5. **Diyelim ki** çoktan seçmeli bir soru için kullanıcı sunulan seçeneklerden biri dışında bir değer gönderir, **Olduğunda** cevap sunucuya ulaşır, **O zaman** sistem cevabı reddeder ve geçerli seçeneklerden birinin seçilmesi gerektiğini belirtir. *(error)*

---

### Kullanıcı Hikâyesi 3 - Görüşmeyi Yarıda Bırakıp Devam Etme (Resume) (Öncelik: P2)

Kullanıcı, "devam ediyor" durumundaki bir görüşmeyi tamamlamadan ayrılabilir ve daha sonra kaldığı sorudan (son cevaplanmamış soru) devam edebilir.

**Neden bu öncelik**: Kullanıcı deneyimi için önemlidir ve gerçekçi kullanım senaryolarını (kesintiye uğrama, zaman kısıtı) destekler; ancak temel soru üretimi ve soru-cevap akışı çalıştıktan sonra eklenebilir.

**Bağımsız Test**: "Devam ediyor" durumundaki bir görüşmede birkaç soru cevaplandıktan sonra oturum sonlandırılıp yeniden açıldığında, kullanıcının tam olarak kaldığı (son cevaplanmamış) sorudan devam ettirildiği ve önceki cevapların korunduğu doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** kullanıcının "devam ediyor" durumunda, bazı soruları cevaplanmış bir görüşmesi var, **Olduğunda** kullanıcı bu görüşmeye Interview History üzerinden geri döner, **O zaman** sistem kullanıcıyı doğrudan son cevaplanmamış soruya götürür ve önceki cevaplar/sorular değişmeden görüntülenebilir kalır.
2. **Diyelim ki** kullanıcının birden fazla "devam ediyor" durumunda görüşmesi var, **Olduğunda** kullanıcı listeden birini seçip devam eder, **O zaman** sistem yalnızca seçilen görüşmenin durumunu ilerletir; diğer yarım kalmış görüşmeler etkilenmeden "devam ediyor" durumunda kalır. *(edge)*
3. **Diyelim ki** kullanıcı, başka bir kullanıcıya ait "devam ediyor" durumundaki bir görüşmeyi kimliğini bilerek doğrudan bir istekle açmaya çalışır, **Olduğunda** istek sunucuya ulaşır, **O zaman** sistem erişimi reddeder ve görüşme içeriğini sızdırmaz. *(error)*
4. **Diyelim ki** "devam ediyor" durumundaki bir görüşme uzun süre (örn. günler) hiç cevaplanmadan bekletilmiş, **Olduğunda** kullanıcı geri döner, **O zaman** sistem görüşmeyi hâlâ "devam ediyor" durumunda kabul eder ve kaldığı yerden devam ettirir; süre aşımına bağlı otomatik iptal UYGULANMAZ. *(edge)*

---

### Kullanıcı Hikâyesi 4 - Adaptif Soru Akışı (Bonus) (Öncelik: P3)

Kullanıcı her soruyu cevapladıktan sonra sistem, isteğe bağlı olarak, LLM aracılığıyla verilen cevabı değerlendirip bir sonraki sorunun zorluk seviyesini ayarlayabilir **ve** sorunun içeriğini adayın cevabında geçen somut noktalara (bahsettiği bir proje, araç, olay, deneyim...) bağlayabilir — yalnızca zorluk kaydırma değil, cevaba **ilişkili** bir sonraki soru.

**Neden bu öncelik**: Ürüne belirgin bir farklılaşma katan bonus bir yetenektir; ancak sabit (adaptif olmayan) soru akışı olmadan da görüşme dilimi eksiksiz ve değerli bir MVP oluşturur. Bu nedenle temel akıştan (Hikâye 1-3) sonra ele alınır.

**Bağımsız Test**: Adaptif akış etkinken bir soru zayıf/güçlü cevaplandığında bir sonraki sorunun zorluk/odağının buna göre farklılaştığı; adaptif akış olmadan sabit soru setinin değişmeden sunulduğu, her iki durumda da toplam soru sayısının N'de sabit kaldığı doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** adaptif soru akışı etkin bir görüşmede kullanıcı bir soruyu güçlü/detaylı cevaplamış, **Olduğunda** sistem cevabı LLM ile değerlendirir, **O zaman** bir sonraki soru, önceki cevabın gücüne uygun şekilde zorluğu artırılmış veya odağı derinleştirilmiş olarak üretilir.
2. **Diyelim ki** adaptif soru akışı etkin bir görüşmede kullanıcı bir soruyu zayıf/eksik cevaplamış, **Olduğunda** sistem cevabı LLM ile değerlendirir, **O zaman** bir sonraki soru daha temel seviyede veya farklı bir odakta üretilir; toplam soru sayısı N olarak sabit kalır.
2a. **Diyelim ki** kullanıcı cevabında somut bir şeyden bahsetmiş (bir proje, araç, olay, deneyim), **Olduğunda** sistem cevabı değerlendirir, **O zaman** üretilen sonraki soru bu somut noktaya atıfla kurulur — jenerik/soyut bir soru yerine adayın kendi cevabına gönderme yapan bir soru üretilir; sorunun genel konusu/odağı (önceden planlanmış taslağın kapsadığı beceri/alan) korunur. *(FR-010)*
2b. **Diyelim ki** iş ilanı birden fazla farklı beceri/konu başlığı (hem mesleğe özgü hem genel/soft beceriler) içeriyor, **Olduğunda** sistem N soruyu üretir, **O zaman** sorular bu başlıklar arasında mümkün olduğunca dağıtılır — aynı konu N sorunun tamamında tekrarlanmaz; ilan hangi meslekten olursa olsun (yazılım, inşaat, sağlık, üretim, satış, lojistik...) sorular o mesleğin terimleriyle kurulur, yazılım/teknoloji terminolojisi varsayılmaz. *(FR-029)*
3. **Diyelim ki** cevap değerlendirme adımında LLM hata döndürür veya zaman aşımına uğrar, **Olduğunda** sistem bir sonraki soruyu ayarlamaya çalışır, **O zaman** sistem görüşmeyi durdurmaz; bir sonraki soru için önceden planlanmış/varsayılan soruya geri döner (uyarlama başarısız olsa da akış kesintiye uğramaz). *(edge/error)*
4. **Diyelim ki** bir görüşme adaptif akış olmadan (sabit mod) başlatılmış, **Olduğunda** kullanıcı soruları cevaplar, **O zaman** sorular, önceden üretilmiş sabit sırayla değişmeden sunulur ve hiçbir soru cevaba göre yeniden üretilmez. *(edge)*

---

### Kullanıcı Hikâyesi 5 - Tüm Cevaplar Sonrası Değerlendirme Raporu Üretimi (Öncelik: P1)

Kullanıcı tüm soruları cevapladıktan sonra sistem, tüm soru-cevap çiftlerini LLM'e göndererek bir değerlendirme raporu üretir: Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar bölümleri ve Teknik/Davranışsal/Genel olmak üzere 3 sabit eksende skor (gerekirse birkaç ek değerlendirme notuyla). Rapor kullanıcıya sunulur ve daha sonra Interview History üzerinden tekrar görüntülenebilir.

**Neden bu öncelik**: Görüşme dilimin nihai değeridir — kullanıcının asıl aradığı çıktı budur; soru üretimi ve cevaplama, rapor üretilmeden ürüne tam değer katmaz.

**Bağımsız Test**: Tüm sorular cevaplandıktan hemen sonra bir raporun otomatik üretildiği, raporun Genel İzlenim/Güçlü Yönler/Geliştirilmesi Gereken Alanlar bölümlerini ve 3 eksende (Teknik/Davranışsal/Genel) skorları içerdiği, ve bu raporun daha sonra Interview History'den tekrar açılabildiği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** bir görüşmenin tüm N sorusu cevaplanmış, **Olduğunda** sistem son cevabı kaydeder, **O zaman** sistem otomatik olarak tüm soru-cevap çiftlerini LLM'e gönderir ve Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar ile Teknik/Davranışsal/Genel eksenlerinde sayısal skorlar içeren bir rapor üretir; görüşme durumu "tamamlandı" olur.
2. **Diyelim ki** rapor başarıyla üretilmiş, **Olduğunda** kullanıcı raporu görüntüler, **O zaman** sistem raporu kullanıcıya sunar ve raporu görüşme kaydıyla ilişkili olarak kalıcı biçimde saklar.
3. **Diyelim ki** daha önce tamamlanmış ve raporu üretilmiş bir görüşme var, **Olduğunda** kullanıcı Interview History sekmesinden bu görüşmeyi tekrar açar, **O zaman** sistem önceden üretilmiş aynı raporu (yeniden LLM çağrısı yapmadan) gösterir.
4. **Diyelim ki** rapor üretimi sırasında LLM hata döndürür veya zaman aşımına uğrar, **Olduğunda** sistem raporu oluşturmaya çalışır, **O zaman** sistem görüşmeyi "tamamlandı ancak rapor bekleniyor/başarısız" bir ara durumda tutar, kullanıcıya anlaşılır bir hata/durum mesajı gösterir ve rapor üretimini yeniden deneme imkânı sunar; cevaplanmış sorular ve cevaplar kaybolmaz. *(edge/error)*
5. **Diyelim ki** bir kullanıcı başka bir kullanıcının tamamlanmış görüşme raporuna kimliğini bilerek doğrudan bir istekle erişmeye çalışır, **Olduğunda** istek sunucuya ulaşır, **O zaman** sistem erişimi reddeder ve rapor içeriğini sızdırmaz. *(error)*

---

### Kullanıcı Hikâyesi 6 - Soru Ekranında İpucu & Rehberlik Paneli (Bonus) (Öncelik: P3)

Kullanıcı, aktif soru ekranının yanında varsayılan kapalı, kendi tıklamasıyla açılan bir
**"İpucu & Rehberlik"** paneli görür. Panelde iki ayrı sekme vardır: **İpucu** (soruya nasıl
daha iyi cevap verilebileceğine dair kısa, genel rehberlik — cevabı doğrudan vermez) ve
**Neden bu soru?** (LLM'in bu soruyu neden sorduğu, ilanın hangi kısmını/gereksinimini
ölçtüğüne dair kısa açıklama). İçerikler, o sorunun üretildiği LLM çağrısında ek alan
olarak gelir; panel açıldığında **ek bir LLM çağrısı yapılmaz**.

**Neden bu öncelik**: Adaya şeffaflık ve öğrenme değeri katan, değerlendirmeyi etkilemeyen
bir bonus zenginleştirmedir; temel soru-cevap akışı (Hikâye 1-2) olmadan anlamı yoktur, bu
yüzden ondan sonra ele alınır. GitHub issue #48.

**Bağımsız Test**: Bir soruya `tip`/`rationale` alanlarıyla üretildiğinde panelin varsayılan
kapalı geldiği, kullanıcı ikonla açtığında iki sekmenin de ayrı ayrı doğru içeriği gösterdiği
ve panel açma olayının (hangi sekme, hangi soru) loglandığı ama rapor/skor içeriğini
etkilemediği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** aktif bir soru `tip` ve `rationale` alanlarıyla üretilmiş, **Olduğunda**
   kullanıcı soru ekranını açar, **O zaman** panel varsayılan **kapalı** gelir; soru
   gösterildiği anda otomatik açılmaz (adil değerlendirme).
2. **Diyelim ki** panel kapalı, **Olduğunda** kullanıcı "İpucu göster" ikonuna/butonuna
   tıklar, **O zaman** panel açılır ve "İpucu" sekmesi varsayılan seçili gelir; "Neden bu
   soru?" sekmesine ayrıca tıklanarak geçilebilir — iki içerik **karıştırılmaz**.
3. **Diyelim ki** kullanıcı paneli (herhangi bir sekmesini) açmış, **Olduğunda** bu olay
   gerçekleşir, **O zaman** sistem bu olayı (görüşme, soru sırası, sekme) sunucu tarafında
   loglar; bu bilgi değerlendirme raporuna veya admin görünümüne **hiçbir şekilde** yansımaz.
   *(FR-034)*
4. **Diyelim ki** bir soru için LLM `tip`/`rationale` üretememiş (alanlar `null`),
   **Olduğunda** kullanıcı soru ekranını görür, **O zaman** sistem soruyu yine normal
   şekilde sunar; panel bu soru için içeriği eksik/boş gösterir veya gizlenir, akış
   hiçbir şekilde engellenmez. *(edge)*
5. **Diyelim ki** görüşme sözlü (voice) modda, **Olduğunda** kullanıcı soru ekranını görür,
   **O zaman** panel yazılı moddakiyle aynı şekilde (yardımcı görsel öğe olarak) sunulur.
6. **Diyelim ki** ilan metninden türetilen `rationale`/`tip` içinde etiket taklidi veya
   biçimlendirme benzeri karakterler bulunuyor, **Olduğunda** panel bu içeriği
   görüntüler, **O zaman** sistem içeriği **düz metin** olarak gösterir; markdown/HTML
   olarak yorumlanmaz veya yürütülmez (İlke V). *(error/edge)*

### Kullanıcı Hikâyesi 7 - Sesli Asistanın Doğru Telaffuzu (Öncelik: P2)

Sözlü modda asistan, soru metnindeki teknik terimleri ve yabancı kelimeleri **doğru
telaffuzla** okur. `C#` "si şarp" olarak duyulur, "C kare" olarak değil; Türkçe cümle
içindeki İngilizce terim hecelenmez. Uzun sorular sonuna kadar okunur, ortada kesilmez.

**Neden bu öncelik**: Yanlış okunan bir soru mülakatın ciddiyetini bozar ve adayın soruyu
anlamasını zorlaştırır — sözlü modun temel işlevini doğrudan sakatlar. GitHub issue #54.

**Bağımsız Test**: Sözlü bir görüşmede `C#`, `.NET`, `CI/CD` gibi terimler içeren ve 200
karakterden uzun bir soru okutularak; terimlerin doğru telaffuz edildiği ve okumanın
kesilmediği doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** görüşme dili Türkçe ve soru metni `C#` içeriyor, **Olduğunda** asistan
   soruyu okur, **O zaman** terim "si şarp" olarak seslendirilir; "C kare" veya
   "C hashtag" duyulmaz. *(FR-035)*
2. **Diyelim ki** Türkçe bir soru metninde çok heceli bir İngilizce terim geçiyor,
   **Olduğunda** asistan soruyu okur, **O zaman** terim hecelenmez veya Türkçe fonetiğiyle
   bozulmaz. *(FR-035)*
3. **Diyelim ki** görüşme dili İngilizce, **Olduğunda** `C#` içeren bir soru okunur,
   **O zaman** terim "C sharp" olarak seslendirilir. *(FR-035)*
4. **Diyelim ki** soru metni 200 karakterden uzun, **Olduğunda** asistan soruyu okur,
   **O zaman** metin **sonuna kadar** okunur; tarayıcının uzun metni sessizce kesmesi
   engellenir. *(FR-036; edge)*
5. **Diyelim ki** sistemde aynı dil için birden fazla ses kurulu, **Olduğunda** asistan
   konuşur, **O zaman** en kaliteli ses otomatik seçilir; uygun ses yoksa tarayıcı
   varsayılanıyla okuma **yine yapılır**. *(FR-036; edge)*
6. **Diyelim ki** soru metninde telaffuz sözlüğünde bulunmayan bir terim var, **Olduğunda**
   asistan soruyu okur, **O zaman** metin olduğu gibi okunur; hata üretilmez ve okuma
   kesilmez. *(edge)*

---

### Kullanıcı Hikâyesi 8 - Sesli Asistanla Gerçek Mülakat Akışı (Öncelik: P2)

Sözlü modda kullanıcı, soru okuyan bir hoparlörle değil, görüşmeyi **yürüten** bir asistanla
karşılaşır: önce karşılama, sonra sorular, aralarda geçiş replikleri, sonunda kapanış.
Mikrofon asistan sustuğunda kendiliğinden açılır, kullanıcı sustuğunda kapanır; metne
dökülen cevap gönderilmeden önce kullanıcıda durur.

**Neden bu öncelik**: Mock interview'ın değeri gerçek mülakat hissini vermesindedir; buton
güdümlü soru okuma bu değeri vermez. Temel soru-cevap akışına (Hikâye 2) bağımlıdır.
GitHub issue #54.

**Bağımsız Test**: Sözlü bir görüşme başlatılıp; karşılamanın ilk sorudan önce geldiği,
mikrofonun okuma bitince açıldığı, sessizlikte kapandığı ve transkriptin onaya sunulduğu
doğrulanarak bağımsızca test edilebilir.

**Kabul Kriterleri**:

1. **Diyelim ki** sözlü bir görüşme başlıyor, **Olduğunda** ilk soru ekrana gelir,
   **O zaman** asistan önce **karşılama** yapar (pozisyon, soru sayısı, soru başına süre);
   ilk soru bundan **sonra** okunur. *(FR-037)*
2. **Diyelim ki** asistan konuşmasını bitirdi, **Olduğunda** okuma sona erer, **O zaman**
   mikrofon **otomatik** açılır; kullanıcı butona basmak zorunda kalmaz. *(FR-039)*
3. **Diyelim ki** asistan konuşuyor, **Olduğunda** bu sırada mikrofon durumu incelenir,
   **O zaman** mikrofon **kapalıdır**; asistanın kendi sesi transkripte karışmaz. *(FR-039)*
4. **Diyelim ki** kullanıcı konuşmayı bıraktı, **Olduğunda** sessizlik eşiği aşılır,
   **O zaman** kayıt otomatik durur ve transkript **onay/düzeltme** için gösterilir;
   gönderim yalnızca kullanıcının onayıyla olur. *(FR-039; ADR-0010 / R2)*
5. **Diyelim ki** kullanıcı cevabını gönderdi ve adaptif akış açık, **Olduğunda** sıradaki
   soruya geçilir, **O zaman** asistan önce kısa bir **geçiş repliği** söyler, sonra soruyu
   okur. *(FR-037, FR-038)*
6. **Diyelim ki** asistan geçiş repliği söylüyor, **Olduğunda** replik incelenir, **O zaman**
   replik **değerlendirme içermez**: puan, olumlu/olumsuz yargı ("iyi cevap", "eksik
   kaldı") veya not ima eden ifade **kullanılmaz** — geri bildirim yalnızca rapordadır.
   *(FR-038)*
7. **Diyelim ki** son soru cevaplandı, **Olduğunda** görüşme tamamlanır, **O zaman** asistan
   **kapanış** yapar ve kullanıcı rapor ekranına yönlendirilir. *(FR-037)*
8. **Diyelim ki** görüşme sözlü modda ilerliyor, **Olduğunda** kullanıcı ekrana bakar,
   **O zaman** hangi aşamada olunduğu görülür: *Asistan konuşuyor* / *Sizi dinliyorum* /
   *Cevabınızı kontrol edin*.
9. **Diyelim ki** kullanıcı otomatik akışı istemiyor, **Olduğunda** otomatik akışı kapatır,
   **O zaman** mikrofon ve geçişler manuel kontrole döner; görüşme kesintiye uğramaz.
   *(İlke VII — kullanıcı kontrolü)*
10. **Diyelim ki** sözlü modda yeni bir soru geldi, **Olduğunda** asistan soruyu okumaya
    başlar, **O zaman** soru süresi **okuma bitene kadar başlamaz**; aday soruyu duymadan
    süresini harcamaz. *(FR-040)*
11. **Diyelim ki** adaptif akış kapalı veya LLM replik üretemedi, **Olduğunda** sıradaki
    soruya geçilir, **O zaman** sistem şablon bir geçiş repliği kullanır; akış sessiz
    kalmaz ve **ek LLM çağrısı yapılmaz**. *(FR-037, FR-038; edge)*

---

### Sınır Durumları (Edge Cases)

- Kullanıcı, PDF yerine desteklenmeyen bir dosya biçimi (örn. .docx, .jpg) yüklerse ne olur? (reddedilir, desteklenen biçim uyarısı gösterilir — bkz. Hikâye 1)
- Kullanıcı, izin verilen azami boyutu (10 MB) aşan bir PDF dosyası yüklerse ne olur? (reddedilir, azami dosya boyutunu belirten bir doğrulama hatası gösterilir — bkz. FR-002)
- LLM soru üretiminde istenenden az/çok soru döndürürse ne olur? (sistem N sayısını zorunlu kılar; uyumsuzluk durumunda hata olarak ele alınır ve görüşme oluşturulmaz — bkz. Hikâye 1, kriter 5)
- Kullanıcı sözlü modda mikrofon erişimini reddederse ne olur? (yazılı moda geçiş teklif edilir; görüşme kaybedilmez — bkz. FR-025)
- Kullanıcının tarayıcısı konuşma tanıma/sentezlemeyi desteklemiyorsa ne olur? (sözlü mod seçeneği UI'da devre dışı gösterilir, kullanıcı yazılı moda yönlendirilir — bkz. FR-025, ADR-0010 / R1)
- Sözlü modda metne dökülen cevap hatalı çıkarsa ne olur? (kullanıcı gönderim **öncesi** metni görür ve düzeltebilir; bu, cevabın değiştirilemezliğini bozmaz — kayıt gönderimden sonra oluşur, bkz. FR-007, ADR-0010 / R2)
- Kullanıcı saatlik LLM çağrı sınırını aşarsa ne olur? (istek reddedilir, ne zaman tekrar deneyebileceği bildirilir; mevcut görüşmeleri etkilenmez — bkz. FR-022)
- İş ilanında pozisyon adı belirtilmemişse ne olur? (pozisyon alanı boş bırakılır, görüşme normal oluşturulur; admin filtresinde "Belirsiz" olarak gruplanır — bkz. FR-023)
- Aynı kullanıcı aynı anda birden fazla "devam ediyor" görüşme başlatabilir mi? (evet, her biri bağımsız kayıt ve durum taşır — bkz. Hikâye 3, kriter 2)
- Adaptif akış etkinken LLM'in ürettiği "sonraki soru" sayısı toplam N'i aşarsa ne olur? (sistem toplam soru sayısını N'de sabit tutar; uyarlama yalnızca içeriği/zorluğu değiştirir, sayıyı değiştirmez — bkz. Hikâye 4, kriter 2)
- Token/maliyet verisi her LLM çağrısında (soru üretimi, adaptif uyarlama, rapor üretimi) nasıl tutulur? (her çağrı için paylaşılan `TokenUsage` kaydına bir satır yazılır ve görüşmeye bağlanır; görüşme toplamı bu satırlardan hesaplanır, kayıtta denormalize toplam tutulmaz; görüntüleme/raporlama `005-admin` diliminde — bkz. Kapsam Notu, `docs/API_CONVENTIONS.md` §4.1)
- Kullanıcı, iş ilanı yerine alakasız ama dolu bir metin (yemek tarifi, şarkı sözü, haber) gönderirse ne olur? (LLM aynı çağrıda "iş ilanı değil" kararını döndürür, hiç soru üretilmez, görüşme oluşturulmaz ve kullanıcıya metnin iş ilanı olarak anlaşılamadığı bildirilir — bkz. FR-028, Hikâye 1 kriter 6)
- Gerçek bir iş ilanı, içinde modele yönelik talimat gibi görünen cümleler taşırsa ne olur? (ilan reddedilmez; o cümleler veri olarak yok sayılır ve ilanın geri kalanından soru üretilir — bkz. FR-028, Anayasa İlke V)
- İlan gerçek ama çok kısa/belirsizse ne olur? (reddedilmez; sorular ilandan anlaşılan meslek alanının temel yetkinliklerine dayandırılır — yanlış ret, kullanıcının hiç görüşme yapamamasına yol açacağı için ret eşiği bilinçli olarak dardır, bkz. FR-028)
- Kullanıcı, cevap olarak boş/anlamsız metin (örn. tek karakter) gönderirse ne olur? (sistem cevabı kabul eder — biçimsel doğrulama uygulanır, ancak içerik kalitesi değerlendirmesi rapor aşamasında ele alınır)

- Sözlü modda asistan konuşurken mikrofon açık kalırsa ne olur? (kalmaz — asistan konuşurken mikrofon kapalı tutulur, aksi halde asistanın kendi sesi transkripte karışır; bkz. FR-039)
- Sözlü modda telaffuz sözlüğünde olmayan bir terim geçerse ne olur? (metin olduğu gibi okunur; hata üretilmez ve okuma kesilmez — bkz. FR-035)
- Sözlü modda TTS hiç çalışmazsa süre sayacı ne olur? (yine başlar; okuma sinyali gelmese de akış kilitlenmez — bkz. FR-040)
- Adaptif akış kapalıyken sözlü modda geçişler nasıl yapılır? (istemci şablon geçiş repliği kullanır; ek LLM çağrısı yapılmaz — bkz. FR-037, FR-038)

## Gereksinimler *(zorunlu)*

### Fonksiyonel Gereksinimler

- **FR-001**: Sistem, oturum açmış kullanıcıların yeni bir görüşme başlatmak üzere iş ilanını serbest metin olarak girmesine veya PDF dosyası olarak yüklemesine izin VERMELİdir.
- **FR-002**: Sistem, PDF olarak yüklenen iş ilanlarından metni sunucu tarafında çıkarmalı ve çıkarılan metni soru üretiminde kullanmalıdır. Metin çıkarılamazsa (boş/okunamayan PDF) istek anlaşılır bir hata mesajıyla reddedilmelidir. Yüklenen PDF dosyası 10 MB'ı aşarsa sistem isteği reddetmeli ve izin verilen azami boyutu belirten bir doğrulama hatası göstermelidir.
- **FR-003**: Sistem, kullanıcının görüşme başlatırken üretilecek soru sayısını (N, 5-20 aralığında), görüşme modunu (sözlü real-time sesli AI asistan veya yazılı) ve adaptif soru akışının bu görüşme için etkin olup olmayacağını seçmesine izin VERMELİdir; zorluk seviyesi (`intern` | `junior` | `senior`) **zorunlu** bir alandır ve seçilmezse `400` döner (bkz. `contracts/interview-api.md`).
- **FR-004**: Sistem, girilen iş ilanına dayanarak LLM aracılığıyla tam olarak N adet soru üretmelidir. Yazılı modda üretilen sorular karışık tipte (çoktan seçmeli veya açık uçlu) olabilir; sözlü modda ise tüm sorular yalnızca açık uçlu olarak üretilir (çoktan seçmeli soru üretilmez).
- **FR-005**: Sistem, her yeni görüşmeyi oturumu açmış kullanıcıya ait bir kayıt olarak "devam ediyor" (in_progress) durumunda oluşturmalı ve bu kaydı ilgili kullanıcıya bağlamalıdır.
- **FR-006**: Sistem, soruları sırayla sunmalı; soru `i` cevaplanıp kaydedilmeden soru `i+1` kullanıcıya ASLA gösterilmemeli veya sunucu tarafından kabul edilmemelidir.
- **FR-007**: Sistem, zaten cevaplanmış bir sorunun cevabının değiştirilmesine veya yeniden gönderilmesine İZİN VERMEMELİdir.
- **FR-008**: Sistem, çoktan seçmeli sorular için yalnızca sunulan seçenekler arasından bir cevabı geçerli KABUL ETMELİdir; açık uçlu sorular için serbest metin cevabı kabul etmelidir. Sözlü modda soru metni ekranda klasik biçimde gösterilir ve **istemci** tarafından sesli olarak okunur; kullanıcı cevabını sesli verir ve **istemci** konuşmayı metne dönüştürür. **Sunucu, sözlü modda gelen cevabı yazılı moddan farksız işler** — hazır metin alır, ses işlemez (ADR-0010). Cevabın kökeni `sourceMode` alanında saklanır.
- **FR-009**: Sistem, "devam ediyor" durumundaki bir görüşmeyi, kullanıcı ayrılıp geri döndüğünde son cevaplanmamış sorudan devam ettirebilmeli (resume) ve önceki soru/cevapları değişmeden korumalıdır.
- **FR-010**: Sistem, isteğe bağlı adaptif soru akışını DESTEKLEMELİdir: kullanıcı bu ayarı hesap genelinde değil, her görüşmeyi başlatırken ayrı ayrı seçer; etkinleştirildiğinde her cevaptan sonra LLM aracılığıyla cevap değerlendirilir ve bir sonraki sorunun zorluğu/odağı buna göre ayarlanır; toplam soru sayısı her durumda N'de sabit kalmalıdır.
- **FR-011**: Sistem, adaptif uyarlama adımında LLM hatası/zaman aşımı oluşursa akışı KESİNTİYE UĞRATMAMALI ve önceden planlanmış/varsayılan bir sonraki soruya geri dönmelidir.
- **FR-012**: Sistem, görüşmenin son sorusu cevaplandığında görüşme durumunu otomatik olarak "tamamlandı" (completed) durumuna geçirmeli ve değerlendirme raporu üretim sürecini başlatmalıdır.
- **FR-013**: Sistem, tamamlanan bir görüşmenin tüm soru-cevap çiftlerini LLM'e göndererek bir değerlendirme raporu üretmelidir. Rapor; Genel İzlenim, Güçlü Yönler, Geliştirilmesi Gereken Alanlar bölümlerini ve Teknik/Davranışsal/Genel olmak üzere 3 sabit eksende 0-100 aralığında yüzdesel skoru içermeli; gerekirse birkaç ek değerlendirme notu eklenebilir.
- **FR-014**: Sistem, üretilen raporu ilgili görüşme kaydıyla ilişkilendirerek kalıcı biçimde saklamalı ve kullanıcı Interview History üzerinden tekrar görüntülediğinde raporu yeniden LLM çağrısı yapmadan aynı içerikle sunmalıdır.
- **FR-015**: Sistem, rapor üretimi sırasında LLM hatası/zaman aşımı oluşursa görüşmeyi veri kaybı olmadan bir ara durumda (rapor bekleniyor/başarısız) tutmalı ve kullanıcıya yeniden deneme imkânı sunmalıdır.
- **FR-016**: Sistem, her LLM çağrısı (soru üretimi, adaptif uyarlama, rapor üretimi) için token/maliyet bilgisini üretip **paylaşılan token kullanım kaydına** ilgili görüşmeye bağlı olarak yazmalıdır; başarısız çağrılar da kaydedilmelidir. Bu verinin görüntülenmesi/raporlanması bu dilimin kapsamı dışındadır. *(bkz. Kapsam Notu; şema `docs/API_CONVENTIONS.md` §4.1 — tek `TokenUsage` tablosu)*
- **FR-017**: Sistem, bir görüşme kaydına yalnızca sahibi olan kullanıcının erişmesine izin VERMELİ; başka bir kullanıcının görüşmesine (devam ediyor veya tamamlanmış, sorular/cevaplar/rapor dahil) erişim sunucu tarafında REDDEDİLMELİdir. *(Anayasa — Güvenlik ilkesi; 001-auth-rol dilimindeki yetkilendirme temeline dayanır)*
- **FR-018**: Sistem, bir kullanıcının aynı anda birden fazla "devam ediyor" durumunda görüşmesi olmasına izin VERMELİdir; her görüşme bağımsız olarak ilerler.
- **FR-019**: Sistem, soru üretimi veya rapor üretimi sırasında LLM hatası/zaman aşımı oluşursa yarım/tutarsız bir görüşme kaydı OLUŞTURMAMALI ve kullanıcıya tekrar deneme imkânı sunmalıdır. *(bkz. Hikâye 1, kriter 5)*
- **FR-020**: Sistem, soruların ve raporun üretim dilini (`tr` | `en`) isteğin `Accept-Language` başlığından çözümlemeli (`tr*` → `tr`, aksi halde `en`), bu dili görüşme kaydında SAKLAMALI ve görüşme sonradan görüntülendiğinde aynı dili kullanmalıdır. Alan adları ve enum değerleri çevrilmez; yalnızca kullanıcıya gösterilen metin çevrilir. *(cross-cutting — `docs/API_CONVENTIONS.md` §4.2; `003-pre-assessment` ile aynı mekanizma)*
- **FR-021**: Sistem, kullanıcının seçtiği zorluk seviyesini (FR-003) görüşme kaydında saklamalı ve soru üretimi prompt'una girdi olarak VERMELİdir. Kullanıcının tamamlanmış ve aktif bir ön değerlendirmesi (pre-assessment) varsa, yeni görüşme formundaki seviye alanı o kayıttaki deneyim seviyesiyle **ön-doldurulmalıdır**; kullanıcı bu değeri değiştirebilir. Ön değerlendirme kaydının bulunmaması görüşme başlatmayı ENGELLEMEMELİdir — bağımlılık zorunlu değildir. *(bkz. Kapsam Notu; `docs/PLAN.md` Fonksiyon Backlog)*
- **FR-022**: Sistem, LLM çağrısı üreten uç noktalara kullanıcı başına saatlik bir üst sınır UYGULAMALIdır: yeni görüşme oluşturma **3/saat**, rapor üretimi yeniden deneme **5/saat**, cevap gönderme **60/saat**. Sayaç başarılı ve başarısız çağrıları birlikte sayar; aşımda istek reddedilir ve kullanıcıya ne zaman tekrar deneyebileceği bildirilir. *(sağlayıcı ücretsiz katman kotası paylaşılan kaynaktır — `docs/API_CONVENTIONS.md` §3.5)*
- **FR-023**: Sistem, soru üretimi sırasında iş ilanından pozisyon/meslek adını **aynı LLM çağrısında** çıkarıp görüşme kaydında SAKLAMALIdır; çıkarılamazsa alan boş bırakılır ve görüşme normal şekilde oluşturulur. *(admin meslek filtresi ve istatistiklerinin veri temeli — `docs/PLAN.md` 1.1; ayrı bir LLM çağrısı yapılmaz)*
- **FR-024**: Sistem, görüşme tamamlandığında tamamlanma zamanını KAYDETMELİdir; görüşme süresi bu zaman ile oluşturulma zamanı arasındaki farktır. *(admin "ortalama görüşme süresi" istatistiğinin tek kaynağı — `docs/PLAN.md` 1.1)*
- **FR-025**: Sistem, sözlü modda tarayıcının konuşma tanıma/sentezleme yeteneğini önceden TESPİT ETMELİ; yetenek yoksa sözlü mod seçeneğini devre dışı göstermeli ve kullanıcıyı yazılı moda yönlendirmelidir. Mikrofon izni reddedilirse görüşme kaybedilmeden yazılı moda düşülmelidir. *(ADR-0010 / R1, R3; Anayasa İlke VII — zarif toparlanma, sessiz başarısızlık yasak)*
- **FR-026**: Sistem, değerlendirme raporunda 3 eksen skorunun yanı sıra **0-100 aralığında tek bir genel puan** SUNMALIdır. Genel puan LLM tarafından üretilmez; üç eksen skorunun **aritmetik ortalamasının en yakın tam sayıya yuvarlanmasıyla** hesaplanır ve rapor kaydıyla birlikte saklanır (rapor `ready` olduktan sonra değişmez — FR-014).
- **FR-027**: Sistem, soru tipinden (çoktan seçmeli veya açık uçlu) bağımsız olarak **her soru için 90 saniyelik (1,5 dakika) bir süre sınırı** UYGULAMALIdır. Süre istemci tarafında geri sayım olarak gösterilir; süre dolduğunda o ana kadarki girdi (yazılmış metin veya işaretlenmiş seçenek) otomatik olarak gönderilir, hiçbir girdi yoksa **boş cevap** kaydedilir ve akış sıradaki soruya geçer. Boş cevap, rapor üretimi prompt'unda "cevap verilmedi" olarak işaretlenir. Süre sınırı bilgilendiricidir; sunucu tarafında zorlanmaz (eleyici bir kısıt değildir) ve değeri tek bir yapılandırma sabitinden okunur — sonradan ayarlanabilir.

- **FR-028**: Sistem, girilen metnin bir işi/rolü tarif edip etmediğini **soru üretimiyle aynı LLM çağrısında** değerlendirmeli; tarif etmiyorsa HİÇ SORU ÜRETMEMELİ, görüşme kaydı OLUŞTURMAMALI ve kullanıcıya metnin iş ilanı olarak anlaşılamadığını bildiren bir hata döndürmelidir. Ret eşiği dardır: ilan kısa, özensiz veya belirsiz olması ret sebebi DEĞİLDİR; yalnızca metnin tamamı bir iş tarifi değilse reddedilir. Gerçek bir ilanın içine gömülü talimat benzeri cümleler de ret sebebi değildir — veri olarak yok sayılır. Kullanıcıya gösterilen mesaj **sunucu tarafından üretilir**, modelin ürettiği serbest metin kullanıcıya gösterilmez. *(ayrı bir LLM çağrısı yapılmaz — FR-023 ile aynı yaklaşım; Anayasa İlke V; sözleşme `contracts/interview-flow-rules.md` §4.1)*
- **FR-029**: Sistem, soru üretiminde iş ilanının **meslek-bağımsız** olduğunu varsaymalı — yazılım/teknoloji terminolojisi ilan bunu içermiyorsa varsayılmaz, sorular ilanın gerçek mesleğinin (inşaat, sağlık, üretim, satış, lojistik, bilişim, temizlik...) diliyle kurulur. Sistem, ilandan ayırt edilebilen **farklı beceri/konu başlıklarını** (mesleğe özgü beceriler VE iletişim/sorumluluk/zaman yönetimi gibi genel beceriler) tespit etmeli ve üretilen N soruyu bu başlıklar arasında dağıtmaya ÇALIŞMALIdır; sınırlı soru sayısında tek bir konunun tekrar tekrar sorulması yerine geniş bir yetkinlik kesitinin ölçülmesi hedeflenir. Bu bir kesinlik garantisi değildir — LLM'in en iyi çabasıdır, doğrulanabilir sunucu tarafı bir kural değildir. *(bkz. Hikâye 1 & 4; Anayasa İlke VII)*
- **FR-030**: Sistem, kullanıcının **aktif ve tamamlanmış** bir ön değerlendirme (`003-pre-assessment`) kaydı varsa, o kaydın CompetencyReport içeriğini (genel özet, güçlü yönler, gelişim alanları, çalışma tarzı özeti, güven seviyesi), öz-değerlendirme puanlarını ve yetenek etiketlerini soru üretim prompt'una **context olarak VERMELİdir** (`003-pre-assessment` FR-016 ile karşılıklı sözleşme). Bu içerik iş ilanından AYRI, izole edilmiş bir veri bloğu olarak taşınır ve ASLA model talimatı olarak yorumlanmaz (Anayasa İlke V — job posting izolasyonuyla aynı disiplin); iş ilanı içeriği her zaman ÖNCELİKLİDİR. Ön değerlendirme kaydı olmayan bir kullanıcı için görüşme normal şekilde başlar — bu zenginleştirme zorunlu bir bağımlılık DEĞİLDİR. **Genişletme (2026-08-12):** aynı kaynak ve aynı izolasyon disipliniyle, adaptif uyarlama adımına da (FR-010) opsiyonel context olarak verilir — bkz. Oturum 2026-08-12.

- **FR-031**: Sistem, soru üretimi sırasında **aynı LLM çağrısında** her soru için ek olarak `tip` (soruya nasıl daha iyi cevap verilebileceğine dair kısa, genel rehberlik — cevabı doğrudan vermez) ve `rationale` (LLM'in bu soruyu neden sorduğu, ilanın hangi kısmını/gereksinimini ölçtüğü) alanlarını ÜRETEBİLMELİdir; bu alanlar **zorunlu değildir** — LLM üretemezse `null` kalır ve soru yine geçerli kabul edilir. Adaptif uyarlama (FR-010) hedef soruyu güncellediğinde bu alanları da yeniden üretebilir; başarısız olursa (FR-011) mevcut değerler (varsa) korunur. *(GitHub issue #48, bkz. Hikâye 6)*
- **FR-032**: Sistem, görüşme soru ekranında (yazılı VE sözlü modda) soru bazlı bir "İpucu & Rehberlik" paneli SUNMALIdır; panel **varsayılan kapalı** gelir ve yalnızca kullanıcının açık bir eylemiyle (ikon/buton) açılır — soru gösterildiği an otomatik açılmaz. Panelde "İpucu" ve "Neden bu soru?" içerikleri **ayrı sekme/bölüm** olarak sunulur, tek bir metin bloğunda karıştırılmaz. Bir soru için `tip`/`rationale` `null` ise ilgili sekme boş/gizli gösterilir; bu, soru-cevap akışını ENGELLEMEZ. *(Hikâye 6)*
- **FR-033**: Sistem, `tip`/`rationale` içeriğini kullanıcıya **her zaman düz metin** olarak göstermelidir; LLM çıktısı markdown/HTML olarak render EDİLMEZ ve yürütülebilir içerik olarak yorumlanmaz (İlke V — prompt-injection/markdown-injection riskine karşı). Sunucu bu alanları depolamadan önce serbest metin sanitizasyonundan (kontrol karakteri + etiket taklidi temizliği) geçirir. *(Hikâye 6 kriter 6)*
- **FR-034**: Sistem, kullanıcının İpucu & Rehberlik panelini (hangi sekmeyi, hangi soru için) açtığı olayını **gözlemlenebilirlik/telemetri amacıyla** sunucu tarafında KAYDETMELİdir; bu kayıt yalnızca iç loglama içindir — değerlendirme raporunu, skorları veya admin'e gösterilen görüşme verisini **hiçbir şekilde etkilemez** ve adaya/admin'e "ipucuna baktı" şeklinde YANSITILMAZ. *(Hikâye 6 kriter 3; Kapsam Dışı)*
- **FR-035**: Sistem, sözlü modda metni sese vermeden ÖNCE bir telaffuz normalizasyonundan geçirmelidir: teknik sembol/kısaltmalar (`C#`, `.NET`, `CI/CD`, `SQL`, `KPI`, `ISO`, `m²`...) o dilde doğru okunacak biçime çevrilir ve sembol/sayı kalıpları (`%50`, `3-5`, `5+`, `&`, `/`) sözcüğe dönüştürülür. Sözlük **meslek-bağımsız** olmalıdır (FR-029 ile tutarlı) — yalnızca yazılım terimlerini kapsayamaz. Sözlükte bulunmayan terim **hata üretmez**, metin olduğu gibi okunur. Çok heceli İngilizce kelimelerde fonetik yazım güvenilir olmadığından ilgili parça İngilizce sese devredilir; metinden "bu kısım İngilizce mi" şeklinde **sezgisel çıkarım YAPILMAZ** (Türkçe kelimelerin çoğu da İngilizce imlasına uyar, sezgisel bir dedektör Türkçe metni bozardı). *(GitHub issue #54, bkz. Hikâye 7)*
- **FR-036**: Sistem, sözlü modda mevcut tarayıcı sesleri arasından dile en uygun ve en kaliteli olanı **otomatik SEÇMELİ**, konuşma hızını görüşme tonuna göre ayarlamalı ve metni **cümle sınırlarından parçalayarak** seslendirmelidir; uygun ses bulunamazsa tarayıcı varsayılanıyla okuma yine yapılır (zarif bozulma). Parçalama, tarayıcının uzun metni sessizce kesmesini engeller — uzun bir soru **sonuna kadar** okunur. *(Hikâye 7 kriter 4, 5; İlke VII)*
- **FR-037**: Sistem, sözlü modda soru-cevap akışını bir **görüşme diyaloğu** olarak sunmalıdır: ilk soruda karşılama (pozisyon, soru sayısı, soru başına süre), sorular arasında geçiş repliği, görüşme sonunda kapanış. Karşılama/geçiş/kapanış metinleri **istemci tarafı şablonlardan** gelir — bunlar için LLM çağrısı **yapılmaz** ve token/maliyet **oluşmaz**. *(Hikâye 8 kriter 1, 5, 7, 11)*
- **FR-038**: Sistem, adaptif akış etkinken cevaba özel kısa bir görüşmeci repliğini (`interviewerRemark`) **mevcut adaptif değerlendirme LLM çağrısında** ek alan olarak üretebilmelidir; bunun için **ayrı bir LLM çağrısı yapılmaz** (FR-023/FR-031 ile aynı yaklaşım). Replik **zorunlu değildir** — üretilemezse `null` kalır ve istemci şablon geçişine düşer. Replik **değerlendirme İÇERMEZ**: puan, olumlu/olumsuz yargı veya not ima eden ifade taşıyamaz; geri bildirim yalnızca değerlendirme raporundadır. Replik **kalıcı DEĞİLDİR** (görüşme kaydının parçası değil, yalnızca o anki seslendirmenin parçası) ve kullanıcıya okunmadan önce FR-033 ile aynı serbest metin sanitizasyonundan geçirilir. *(Hikâye 8 kriter 5, 6, 11; İlke V)*
- **FR-039**: Sistem, sözlü modda **eller serbest** bir akış sunmalıdır: asistanın okuması bittiğinde mikrofon otomatik açılır, kullanıcı sustuğunda (sessizlik eşiği) kayıt otomatik durur ve metne dökülen cevap **onay/düzeltme** için kullanıcıda bekler — otomatik gönderim **YOKTUR** (ADR-0010 / R2). Asistan konuşurken mikrofon **KAPALI** tutulmalıdır (eko engeli). Sessizlik eşiği her yeni konuşma parçasında sıfırlanır; cümle arası düşünme molası cevabın sonu sayılmaz. Kullanıcı otomatik akışı kapatıp manuel kontrole dönebilmelidir (İlke VII). *(Hikâye 8 kriter 2, 3, 4, 9)*
- **FR-040**: Sistem, sözlü modda soru süresini (FR-027) asistan soruyu **okumayı bitirdiğinde** başlatmalıdır; okuma sırasında süre işlemez. Okuma yapılamıyorsa (TTS desteği yok veya sentez hatası) süre yine başlar — akış hiçbir durumda kilitlenmez. *(Hikâye 8 kriter 10; edge)*


### Anahtar Varlıklar *(veri içerdiği için dahil edilmiştir)*

- **Görüşme (Interview)**: Bir kullanıcının başlattığı tek bir mock interview oturumunu temsil eder. Temel alanlar: `id`, `userId` (sahip kullanıcı — 001-auth-rol dilimindeki Kullanıcı varlığına referans), iş ilanı içeriği (kaynak: serbest metin veya PDF'ten çıkarılmış metin), soru sayısı (N), mod (sözlü/yazılı), zorluk seviyesi, üretim dili, ilandan çıkarılan pozisyon adı, adaptif akışın etkin olup olmadığı, `status` (`in_progress` | `completed`), oluşturulma tarihi, tamamlanma tarihi, silinme işareti (soft-delete). Token/maliyet **bu varlıkta toplanmaz** — paylaşılan token kullanım kaydından hesaplanır (FR-016).
- **Token Kullanımı (TokenUsage)** *(cross-cutting — şema sahibi `003-pre-assessment`)*: Her LLM çağrısının token ve maliyet kaydı. Bu dilim `question_generation`, `adaptive_evaluation`, `interview_report` işlemleri için satır yazar ve kaydı ilgili görüşmeye bağlar (FR-016).
- **Soru (Question)**: Bir görüşmeye ait, LLM tarafından üretilmiş tek bir soruyu temsil eder. Temel alanlar: `id`, `interviewId`, sıra numarası (i), tip (çoktan seçmeli | açık uçlu), soru metni, çoktan seçmeli ise seçenekler listesi, (adaptif akışta) hangi önceki cevaba göre uyarlandığı bilgisi.
- **Cevap (Answer)**: Kullanıcının belirli bir soruya verdiği yanıtı temsil eder. Temel alanlar: `id`, `questionId`, cevap içeriği (seçilen seçenek veya serbest metin), cevaplanma zamanı. Bir soruya en fazla bir cevap bağlanabilir ve cevap kaydedildikten sonra değiştirilemez.
- **Değerlendirme Raporu (Report)**: Tamamlanmış bir görüşmenin LLM tarafından üretilen nihai değerlendirmesini temsil eder. Temel alanlar: `id`, `interviewId`, Genel İzlenim metni, Güçlü Yönler listesi, Geliştirilmesi Gereken Alanlar listesi, Teknik/Davranışsal/Genel eksenlerinde 0-100 aralığında yüzdesel skorlar, bu üç eksenden türetilen 0-100 genel puan (FR-026), isteğe bağlı ek değerlendirme notları, üretilme zamanı.
- **Soru (Question)** alanlarına ek olarak: `tip` (isteğe bağlı, kısa rehberlik metni) ve `rationale` (isteğe bağlı, soru-ilan gerekçesi) — FR-031, `data-model.md`.

## Başarı Kriterleri *(zorunlu)*

### Ölçülebilir Sonuçlar

- **SC-001**: Bir kullanıcı, geçerli bir iş ilanı girdikten sonra soru üretiminin tamamlanmasını 30 saniyenin altında bekler (LLM yanıt süresine bağlı olarak). Bu üst sınır, sistemin sabit `LLM_REQUEST_TIMEOUT_MS` (30 sn, `docs/API_CONVENTIONS.md` §3.2) değeriyle **birebir aynıdır** — çağrı bu süreyi aşarsa `LlmTimeoutError` → `504` döner ve istek SC-001 kapsamı **dışında** sayılır (başarısız istek, başarılı-ama-yavaş istek değil); ayrıca 30 sn'ye çok yakın süren başarılı çağrılar da bu ölçütü marjinal karşılar. Sınır kasıtlı olarak eşittir, ayrı bir tolerans payı eklenmez.
- **SC-002**: Üretilen soru sayısı, kullanıcının seçtiği N değeriyle vakaların %100'ünde birebir eşleşir.
- **SC-003**: Soru `i` cevaplanmadan soru `i+1`'in gösterildiği veya sunucu tarafından kabul edildiği hiçbir durum (%0) gerçekleşmez.
- **SC-004**: Yarıda bırakılan bir görüşmeye geri dönüldüğünde kullanıcıların %100'ü, önceki cevap kaybı olmadan tam olarak kaldığı sorudan devam eder.
- **SC-005**: Tüm sorular cevaplandıktan sonra değerlendirme raporu vakaların en az %95'inde 60 saniyenin altında üretilir ve kullanıcıya sunulur.
- **SC-006**: Bir kullanıcının başka bir kullanıcıya ait görüşme/soru/cevap/rapor verisine yetkisiz erişim denemelerinin %100'ü sunucu tarafında reddedilir.
- **SC-007**: Daha önce üretilmiş bir rapor, Interview History üzerinden tekrar açıldığında ek bir LLM çağrısı yapılmadan aynı içerikle görüntülenir (vakaların %100'ünde).
- **SC-008**: LLM hatası/zaman aşımı senaryolarında (soru üretimi veya rapor üretimi) kullanıcıya sunulan hata mesajlarının %100'ü, mevcut cevaplanmış soru/cevap verisini kaybetmeden yeniden deneme imkânı sunar.
- **SC-009**: `Accept-Language: tr*` ile başlatılan görüşmelerin %100'ünde sorular ve rapor Türkçe; diğer tüm değerlerde İngilizce üretilir. Görüşme sonradan farklı bir dil başlığıyla açıldığında içerik dili **değişmez** (FR-020).
- **SC-010**: Saatlik LLM çağrı sınırını aşan isteklerin %100'ü sunucu tarafında reddedilir ve yanıt, kullanıcıya ne zaman tekrar deneyebileceğini bildirir (FR-022).
- **SC-011**: Pozisyon adı içeren iş ilanlarının en az %90'ında pozisyon alanı doldurulur; doldurulamadığı vakaların %100'ünde görüşme yine de başarıyla oluşturulur (FR-023).
- **SC-012**: Tamamlanan görüşmelerin %100'ünde tamamlanma zamanı kaydedilir; görüşme süresi hesaplanabilir (FR-024).
- **SC-013**: Aktif ön değerlendirmesi **olmayan** kullanıcıların görüşme başlatma denemelerinin %100'ü başarılı olur — ön değerlendirme zorunlu bağımlılık değildir (FR-021).
- **SC-014**: Üretilen raporların %100'ünde genel puan, üç eksen skorunun yuvarlanmış ortalamasına eşittir ve rapor tekrar açıldığında aynı değeri gösterir (FR-026).
- **SC-015**: Süresi dolan soruların %100'ünde akış kesintisiz sıradaki soruya geçer; hiçbir cevap kaybolmaz ve görüşme "devam ediyor" durumunda kalmaz (FR-027).
- **SC-016**: İş ilanı olmayan metinlerle yapılan görüşme başlatma denemelerinin %100'ünde hiç soru üretilmez ve görüşme kaydı oluşturulmaz; buna karşılık gerçek iş ilanlarının en az %95'i reddedilmeden soru üretimine geçer (yanlış ret üst sınırı — FR-028).
- **SC-017**: İpucu & Rehberlik paneli olan bir soru ekranı ilk gösterildiğinde vakaların %100'ünde panel **kapalı** gelir; ek bir LLM çağrısı yapılmadan panel açılabilir (FR-031, FR-032).
- **SC-018**: Panel açma olaylarının %100'ü sunucu tarafında loglanır; bu logların hiçbiri değerlendirme raporunun veya admin görüşme verisinin bir parçası olarak dönmez (FR-034).

## Varsayımlar

- Bu dilim, 001-auth-rol dilimindeki Kullanıcı (`id`, `email`, `role`) ve yetkilendirme temelinin (oturum açma, sahiplik kontrolü) hazır ve kullanılabilir olduğunu varsayar; kimlik doğrulama akışları bu dilimde yeniden ele alınmaz.
- Soru sayısı (N) için izin verilen aralık 5-20 olarak netleştirilmiştir (bkz. Netleştirmeler); bu aralık dışındaki değerler doğrulama hatası olarak reddedilir.
- Sözlü mod, gerçek zamanlı sesli AI asistan aracılığıyla çalışır: soru metni ekranda klasik biçimde gösterilir ve aynı zamanda sesli asistan tarafından sesli olarak okunur; kullanıcı cevabını sesli olarak verir ve sistem konuşmayı metne dönüştürüp aynı soru-cevap veri modelini (Question/Answer) kullanır. Sözlü modda yalnızca açık uçlu sorular üretilir (çoktan seçmeli soru üretilmez); ses işleme teknolojisi seçimi bu spec'in kapsamı dışındadır (teknoloji-bağımsız).
- Adaptif soru akışı bir "bonus" özelliktir ve görüşme başlatılırken isteğe bağlı olarak etkinleştirilir/etkinleştirilmez; devre dışı bırakıldığında sorular, üretim anında belirlenen sabit sırayla değişmeden sunulur.
- Rapor üretimi, tüm sorular cevaplandıktan hemen sonra otomatik olarak (kullanıcıdan ek bir eylem beklemeden) tetiklenir.
- Token/maliyet verisinin nasıl görselleştirileceği (admin istatistik ekranları) ayrı bir dilimde ele alınacaktır; bu dilim yalnızca verinin üretilip paylaşılan `TokenUsage` kaydına yazılmasından ve admin'in ihtiyaç duyduğu alanların (pozisyon, tamamlanma zamanı) doldurulmasından sorumludur.
- "Devam ediyor" durumundaki görüşmeler için süre aşımına bağlı otomatik iptal/temizlik bu dilimde uygulanmaz; kullanıcı istediği zaman kaldığı yerden devam edebilir.
- Kullanıcı arayüzü teknoloji yığını anayasa gereği sabittir (React 19 + Vite + TypeScript + Tailwind + shadcn/ui); ancak bu spec teknoloji-bağımsızdır ve yalnızca davranışı tanımlar. **Karara bağlanan teknolojiler:** LLM sağlayıcı **ADR-0007** (Groq birincil + DeepSeek yedek), sözlü mod **ADR-0010** (tarayıcı Web Speech API — istemci tarafı STT/TTS, sunucuda ses işleme yok). **Kalan:** PDF metin çıkarım kütüphanesi (ADR-0009, bloklamaz), grafik kütüphanesi (ADR-0011 — **rapor UI'ından önce gerekli**).
- Token/maliyet kaydı için **tek** paylaşılan tablo kullanılır (`TokenUsage`); bu dilim kendi maliyet tablosunu açmaz. Görüşme başına toplam, kayıtlar üzerinden hesaplanır — görüşme kaydında denormalize toplam alanı tutulmaz (`docs/API_CONVENTIONS.md` §4.1).
- Bu dilim, ön değerlendirme (`003-pre-assessment`) kayıtlarına **okuma** erişimini yalnızca seviye ön-doldurma için varsayar (FR-021) ve o dilim henüz uygulanmamışsa alan boş/ön-doldurmasız çalışır.

## Netleştirmeler (Clarifications)

### Oturum 2026-07-30

- **S:** Görüşme başlatırken izin verilen soru sayısı (N) için kesin minimum ve maksimum değerler ne olmalı (FR-003)? → **K:** 5-20 aralığı (en az 5 değerlendirme kriteri için).
- **S:** Değerlendirme raporundaki Teknik/Davranışsal/Genel eksen skorları hangi ölçekte olmalı (FR-013)? → **K:** 0-100 aralığında yüzdesel skor.
- **S:** Adaptif soru akışı, kullanıcı her yeni görüşme başlatırken ayrı ayrı mı seçiyor, yoksa hesap genelinde sabit bir ayar mı (FR-010)? → **K:** Her görüşme başlatılırken ayrı seçilir (görüşme bazlı ayar; hesap genelinde sabit bir ayar değildir).
- **S:** Sözlü modda çoktan seçmeli bir soru sunulduğunda kullanıcı seçenekleri nasıl görür ve cevaplar (Hikâye 1 & 2, sözlü mod etkileşimi)? → **K:** Sözlü modda çoktan seçmeli soru üretilmez; yalnızca açık uçlu sorular üretilir. Soru metni ekranda klasik biçimde gösterilir ve sesli asistan tarafından da sesli olarak okunur; kullanıcı cevabını sesli olarak verir.
- **S:** İş ilanı için yüklenen PDF dosyasında izin verilen maksimum dosya boyutu ne olmalı (FR-002)? → **K:** 10 MB.

### Oturum 2026-08-01

- **S:** Rapor 3 eksen skoru dışında tek bir genel puan içermeli mi (FR-013)? → **K:** Evet, 0-100 aralığında genel puan sunulur. LLM'den ayrı bir alan olarak İSTENMEZ; üç eksenin yuvarlanmış ortalamasıdır (FR-026). Böylece LLM'in kendi içinde çelişen bir genel puan üretme riski ortadan kalkar ve şema doğrulaması büyümez.
- **S:** Soru başına süre sınırı var mı, kaç dakika (FR-027)? → **K:** Var, **90 saniye (1,5 dakika)**, tüm soru tipleri için aynı. Değer başlangıç ayarıdır; tek bir sabitten okunur ve ölçüm sonrası değiştirilebilir. Süre dolduğunda soru boş cevapla kapanır — görüşme kilitlenmez.

### Oturum 2026-08-04 (adaptif ilişkilendirme + ön değerlendirme bağlamı + meslek-bağımsızlık)

- **S:** Adaptif uyarlama yalnızca zorluk mu ayarlamalı, yoksa sonraki soru adayın cevabındaki somut içeriğe de bağlanmalı mı (FR-010)? → **K:** İkisi de. Aday cevabında somut bir şeyden (proje, araç, olay, deneyim) bahsettiyse sonraki soru o noktaya atıfla kurulur; bahsetmediyse yalnızca zorluk ayarlanır. Adaptif çağrı iş ilanının tamamını tekrar almaz — mevcut veri (sorulan soru + cevap + taslak sonraki soru) yeterli kabul edildi; konu çeşitliliği zaten baseline soru üretiminde (FR-029) sağlanıyor, adaptif katmanın işi konuyu değiştirmek değil cevaba bağlamaktır.
- **S:** Sınırlı N soru içinde ilandaki farklı beceri/teknoloji başlıkları ve soft skiller nasıl kapsanır? → **K:** Baseline soru üretimi (FR-029), ilandan ayırt edilebilen farklı beceri/konu başlıklarını (hard + soft) N soru arasında dağıtmaya çalışır — sunucu tarafında doğrulanan sert bir kural değil, LLM'e verilen açık bir talimat.
- **S:** Soru üretimi/adaptif uyarlama yalnızca yazılım/teknoloji mesleklerini mi varsaymalı? → **K:** Hayır — ilan hangi meslekten olursa olsun (inşaat, sağlık, üretim, satış, lojistik, bilişim...) sorular o mesleğin diliyle kurulur; teknoloji terminolojisi ilan içermiyorsa varsayılmaz (FR-029; `003-pre-assessment`'taki meslek-bağımsızlık kararıyla tutarlı).
- **S:** `003-pre-assessment`'ın ürettiği CompetencyReport, görüşme soru üretimine nasıl aktarılır (FR-016 karşılığı)? → **K:** Aktif+tamamlanmış kayıt varsa tam rapor içeriği + öz-değerlendirme + yetenek etiketleri, iş ilanından ayrı, izole bir veri bloğu olarak prompt'a eklenir (FR-030). Bu, `docs/PLAN.md` Fonksiyon Backlog'da 2026-08-04'te Bonus'tan MVP'ye yükseltildi.

### Oturum 2026-08-12 (adaptif uyarlamaya ön değerlendirme bağlamının genişletilmesi)

- **S:** FR-030 yalnızca baseline soru üretimini mi kapsıyor, yoksa adaptif uyarlama (FR-010/FR-011) da aktif ön değerlendirme bağlamından yararlanmalı mı? → **K:** Genişletildi (ADR-bkz. `docs/DECISIONS.md`). 2026-08-04 kararında adaptif çağrının iş ilanının tamamını tekrar almaması (mevcut veri yeterli) ile bu genişletme ÇELİŞMEZ: adaptif katman hâlâ iş ilanının tamamını almaz, yalnızca `create()` ile AYNI kaynaktan (kullanıcının aktif+tamamlanmış ön değerlendirme kaydı) okunan CompetencyReport bloğu, baseline soru üretimindeki İZİNLİ AYNI disiplinle (izole veri bloğu, sistem talimatına yalnızca var/yok bilgisi) adaptif prompt'a da eklenir. Özellikle "deneyimim yok" cevabında sıradaki sorunun hangi temel/alternatif konuya kayacağına karar verirken faydalıdır. Kayıt yoksa veya `hasPreAssessmentContext=false` ise adaptif akış öncekiyle bire bir aynı çalışır — davranış değişmez, yalnızca ek bir opsiyonel bağlam kaynağı eklenmiştir. Uygulama: `backend/src/interview/interview.service.ts` (`getActivePreAssessmentContextBlock` — hem `create()` hem `adaptNextQuestion()` tarafından çağrılır), `backend/src/interview/llm/adaptive.ts`.

### Oturum 2026-08-05 (GitHub issue #48 — İpucu & Rehberlik Paneli)

- **S:** Panel soru gelir gelmez otomatik mi açılır, yoksa kullanıcı mı açar? → **K:** Varsayılan kapalı; kullanıcı ikon/buton ile kendisi açar — adil değerlendirmeyi bozmamak için otomatik açılmaz (Hikâye 6 kriter 1).
- **S:** "İpucu" ve "Neden bu soru?" tek bir metin bloğunda mı, yoksa ayrı mı sunulur? → **K:** Aynı panelde ama ayrı sekme/bölüm; karıştırılmaz (Hikâye 6 kriter 2, FR-032).
- **S:** İçerikler nasıl üretilir — panel açıldığında ayrı bir LLM çağrısı mı yapılır? → **K:** Hayır; `tip`/`rationale`, soru üretimiyle **aynı LLM çağrısında** `Question` şemasına eklenen alanlardır (FR-031); panel açma ek maliyet/gecikme üretmez.
- **S:** `tip`/`rationale` zorunlu alanlar mı? → **K:** Hayır; LLM üretemezse `null` kalır, soru yine geçerlidir (FR-031).
- **S:** Panel kullanımı (hangi sekme açıldı) izleniyor mu, rapora yansır mı? → **K:** Sunucu tarafında iç telemetri olarak loglanır (gözlemlenebilirlik amaçlı); değerlendirme raporunu veya admin'e gösterilen veriyi etkilemez, adaya/admin'e yansıtılmaz (FR-034, Kapsam Dışı).
- **S:** Panel hangi modlarda (yazılı/sözlü) gösterilir? → **K:** Her ikisinde de; sözlü modda yardımcı görsel öğe olarak (Hikâye 6 kriter 5).
- **S:** Bu özellik `002-interview` spec'ine mi ekleniyor, ayrı bir mini-spec olarak mı? → **K:** Bu dilime ek FR/Hikâye olarak eklendi (002-interview zaten uygulanmış altyapıyı — Question şeması, LLM prompt'u, soru ekranı — devraldığı için ayrı bir spec dilimi açmak yerine mevcut sözleşmeye eklendi).
