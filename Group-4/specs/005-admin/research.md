# Phase 0 Araştırma: Admin Paneli (Görüşme İzleme & İstatistikler)

**Dilim**: `005-admin` | **Plan**: [plan.md](./plan.md)

Bu dilimin Teknik Bağlam bölümünde `[NEEDS CLARIFICATION]` kalmadı (4 belirsizlik
`/speckit-clarify` oturumunda çözüldü, bkz. `spec.md` `## Clarifications`). Aşağıdaki
kararlar, spec'te netleşmiş gereksinimlerin **nasıl** uygulanacağına dair
uygulama-yaklaşımı (implementation-approach) kararlarıdır; teknoloji seçimi değildir
(mevcut kilitli ADR'lerle çelişmez).

## 1. Admin uç noktaları ayrı bir modülde mi, yoksa `InterviewModule` genişletilerek mi?

**Karar**: Ayrı, bağımsız bir `AdminModule` (`backend/src/admin/`).

**Gerekçe**: `002-interview/contracts/interview-api.md` §2, meslek filtresi ve
sayfalama parametrelerini **kasıtlı olarak** kapsam dışı bırakmıştı ("bu dilim yalnızca
yukarıdaki görünürlük kuralını uygular... meslek filtresi parametreleri kapsam
dışıdır"). `GET /api/interviews`'i admin'e özel query parametreleriyle genişletmek,
tek bir uç noktanın iki farklı tüketici (kullanıcı: kendi kayıtları, sayfalanmamış özet
liste; admin: herkesin kayıtları, filtrelenmiş+sayfalanmış+istatistik gerektiren liste)
için gittikçe şişen, koşullu dallara ayrılan bir sözleşmeye dönüşmesine yol açardı — bu
da `002-interview`'in kilitli sözleşme dosyasının (görev kısıtı gereği "değiştirilmez")
ihlali anlamına gelirdi. Ayrı modül, iki tüketiciyi net ayırır ve `002-interview`'in
sözleşmesine hiç dokunmaz.

**Değerlendirilen alternatifler**:
- `GET /api/interviews`'e `?position=&page=&pageSize=` eklemek → Reddedildi:
  `interview-api.md`'yi değiştirmeyi gerektirir (görev kısıtı ihlali), kullanıcı/admin
  yetki dallanması tek controller'da karmaşıklaşır.
- Admin mantığını mevcut `InterviewService`'e metod olarak eklemek → Reddedildi: aynı
  servis içinde "kullanıcı sahiplik filtreli" ve "admin filtre yok + agregasyon" mantığı
  karışır; test edilebilirlik ve okunabilirlik düşer. Ayrı `AdminService` + doğrudan
  `PrismaService` enjeksiyonu daha temiz bir sınır çizer.

## 2. İstatistik sorguları: Prisma `groupBy`/`aggregate` mi, ham SQL mi?

**Karar**: Prisma'nın yerleşik `groupBy` ve `aggregate` API'leri (meslek bazlı sayı,
ortalama süre, tamamlanma oranı) + `TokenUsage` için `groupBy` ile günlük toplama.

**Gerekçe**: Proje ölçeği (staj/vaka çalışması) düşük veri hacmi öngörüyor; Prisma'nın
tip güvenli `groupBy`/`aggregate`'i (`_count`, `_avg`, `_sum`) tüm gerekli metrikleri
(FR-009 sayı, FR-010 ortalama süre, FR-011 oran, FR-012 token toplamı) ham SQL veya
`$queryRaw` olmadan karşılar. `docs/TECH_STACK.md` zaten Prisma'yı ORM olarak kilitlemiş
(ADR-0005); `$queryRaw` yalnızca Prisma'nın karşılayamadığı bir ihtiyaç ortaya çıkarsa
gerekçelendirilip eklenecek (şu an gerek yok).

**Ortalama süre hesabı**: `Interview.completedAt IS NOT NULL` olan kayıtlarda
`AVG(completedAt - createdAt)` — bu, `002-interview/data-model.md`'de zaten tanımlı
kuralın (`completedAt - createdAt`) admin tarafındaki tek tüketicisidir; Prisma'da
`findMany` ile çekilip uygulama katmanında ortalaması alınır (Prisma `aggregate` tarih
farkını doğrudan desteklemiyor) — veri hacmi düşük olduğundan performans riski yok.

**Değerlendirilen alternatifler**:
- Ham `$queryRaw` ile tek sorguda tüm istatistikler → Reddedildi: erken optimizasyon;
  düşük veri hacminde Prisma'nın birden fazla küçük sorgusu yeterince hızlı, tip
  güvenliği ve okunabilirlik daha değerli.

## 3. Meslek/pozisyon "Belirsiz" kovası normalizasyonu

**Karar**: `Interview.position IS NULL` olan kayıtlar, hem liste filtresinde hem
istatistik gruplamasında sabit bir `null` → `"Belirsiz"` etiketiyle **ayrı bir kova**
olarak ele alınır (filtre `Select` seçeneklerinden biri "Belirsiz" olur).

**Gerekçe**: Spec FR-003 ve Edge Cases bunu açıkça istiyor ("`position` boş/`null` ise
... 'Belirsiz' adlı ayrı bir kova altında gösterilir; sessizce göz ardı edilmez").
Backend, `groupBy` sonucunda `position: null` gelen grubu API yanıtında `"Belirsiz"`
etiketiyle **birlikte** ama ayrı bir alanda (`position: null, label: "Belirsiz"`) döner;
normalizasyon istemci tarafında **tekrarlanmaz** (tek kaynak sunucuda).

## 4. Günlük token zaman serisi sorgu yaklaşımı

**Karar**: `TokenUsage.createdAt`'i günlük olarak `DATE_TRUNC('day', ...)` ile gruplayan
bir Prisma `groupBy` (veya gerekirse `$queryRaw` — düşük risk, yalnızca `GROUP BY` içerir,
kullanıcı girdisi taşımaz) + son 30 günü kapsayan `WHERE createdAt >= now() - 30 days`
filtresi. Veri olmayan günler API yanıtında **0 değeriyle doldurulur** (grafik
kütüphanesinin boşluk bırakmaması için) — bu doldurma işlemi backend'de yapılır.

**Gerekçe**: Clarifications Q3 (günlük, son 30 gün) zaten kilitlendi; bu, sadece
uygulama detayı. Sıfır doldurma, Recharts `LineChart`'ın günler arası boşluk
bırakmadan sürekli bir çizgi çizmesini sağlar (FR-013, "veri yok" durumunun zarif
gösterimiyle tutarlı).

**Değerlendirilen alternatifler**:
- Sıfır doldurmayı frontend'e bırakmak → Reddedildi: aynı doldurma mantığının birden
  fazla istemcide (varsa mobil/farklı admin görünümü) tekrarlanması riski; tek kaynak
  ilkesiyle backend'de tutmak daha güvenli.

## 5. Sayfalama parametresi tasarımı

**Karar**: `GET /api/admin/interviews?page=1&pageSize=20&position=...` — `page` 1-index,
`pageSize` varsayılan ve üst sınır **20** (Clarifications Q4); yanıt gövdesi
`{ items: [...], total: number, page: number, pageSize: number }` şeklinde sarmalanır
(toplam sayfa sayısını istemcinin hesaplayabilmesi için `total` döner).

**Gerekçe**: Basit, yaygın "offset pagination" deseni; `004-history` ve `002-interview`
sözleşmelerinde sayfalama emsali yoktu (ilk kez bu dilimde ihtiyaç doğdu), bu yüzden
proje genelinde başka bir dilimle çelişme riski yok. `total` alanı FR-014'ün
("performans kaybı yaşamadan gezinme") istemci tarafı sayfa numaralandırmasını
mümkün kılar.

## Sonuç

Tüm uygulama-yaklaşımı kararları netleşti; hiçbiri kilitli ADR'lerle (`docs/DECISIONS.md`)
çelişmiyor ve hiçbiri yeni bir ADR gerektirmiyor (Prisma, Recharts, NestJS zaten
kilitli teknolojiler). Phase 1 tasarımına geçilebilir.
