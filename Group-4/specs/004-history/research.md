# Phase 0 Araştırma: Interview History (Görüşme Geçmişi)

**Dilim**: `004-history` | **Spec**: [spec.md](./spec.md)

Spec'te `[NEEDS CLARIFICATION]` işaretlenmiş bir madde yoktur (bkz.
`checklists/requirements.md`). Bu belge yine de Teknik Bağlam'da karar gerektiren
noktaları (teknoloji seçimi değil, **uygulama yaklaşımı** kararları) belgeler; hiçbiri
kilitli ADR'lerle (`docs/TECH_STACK.md`, `docs/DECISIONS.md`) çelişmez ve bu dilim
**yeni bir ADR açmaz**.

## 1. Bu dilim şema sahibi değildir — veri kaynağı doğrulaması

**Karar**: `004-history`, `specs/002-interview/data-model.md`'de tanımlı `Interview` /
`Question` / `Answer` / `Report` tablolarını **olduğu gibi** tüketir. Yeni tablo, yeni
Prisma modeli veya mevcut alanların yeniden tanımlanması **yapılmaz**.

**Gerekçe**: 002-interview data-model.md şu alanları zaten hazırlamıştır ve bu dilimin
ihtiyaç duyduğu her şeyi karşılar:
- `Interview.status` (`in_progress` \| `completed`) — kart rozeti ve "Devam Et" /
  "Detay" aksiyon seçimi (FR-005, FR-006).
- `Interview.deletedAt` (`DateTime?`) — soft-delete işareti ve liste görünürlük filtresi
  (FR-001, FR-011, FR-012); alan **zaten var**, yalnızca **silme uç noktası** eksikti
  (bkz. §2).
- `Interview.currentQuestionOrder` — resume'da kaldığı sorudan devam ettirme temeli
  (FR-005).
- `Interview.reportStatus` (`not_applicable` \| `pending` \| `ready` \| `failed`) — detay
  ekranında rapor bölümünün başarı/hata durumunu göstermek için (FR-008).
- `Interview.position`, `Interview.createdAt` — kart başlığı ve sıralama (FR-002, FR-003).

**Değerlendirilen alternatifler**: Ayrı bir `InterviewHistoryView`/materialized-view
tablosu açmak — reddedildi; bu ölçekte (`GET /api/interviews` zaten özet döndürüyor)
gereksiz veri çoğaltması ve senkron tutma yükü getirirdi (Anayasa "gerekçesiz karmaşıklık
reddedilir").

## 2. Silme uç noktasının sahipliği

**Karar**: `DELETE /api/interviews/:id` bu dilimde (`004-history`) **inşa edilir**.
`specs/002-interview/contracts/interview-api.md` §2 ve `docs/API_CONVENTIONS.md` §4.3
açıkça bu uç noktayı `002-interview` kapsamı dışında bırakıp `004-history`
diliminin sorumluluğuna atamıştır (bkz. spec "Bağımlılıklar / Entegrasyon Noktaları").

**Gerekçe**: Sorumluluk zaten cross-cutting sözleşmede net biçimde bu dilime
atanmıştır; başka bir yerde ikinci bir silme uç noktası tanımlamak sözleşme
çatışması yaratır.

**Değerlendirilen alternatifler**: Silme davranışını `002-interview`'e geri eklemek —
reddedildi, o dilim şu an aktif implementasyonda ve dosyalarına dokunulmaması bu görevin
kısıtıdır. `PATCH /api/interviews/:id` ile genel bir "alan güncelle" uç noktası —
reddedildi; tek amaçlı, niyet açık bir `DELETE` uç noktası REST sözleşmesiyle daha
tutarlı ve `docs/API_CONVENTIONS.md` §1 (404 kuralı) ile doğrudan uyumlu.

## 3. "Devam Et" yönlendirme / yarış durumu (FR-014)

**Karar**: Frontend, kart üzerindeki "Devam Et" aksiyonunu tetiklediğinde
`GET /api/interviews/:id` çağrısının döndürdüğü **güncel** `status` alanına bakar.
Yanıt `status="completed"` ise (görüşme başka bir sekme/cihazda tamamlanmış), kullanıcı
soru-cevap ekranına değil doğrudan Görüşme Detayı ekranına yönlendirilir. Ayrı bir
"resume" uç noktası **açılmaz**; mevcut detay uç noktası zaten moda göre farklı içerik
döndürüyor (bkz. `interview-api.md` §3).

**Gerekçe**: Sunucu tarafında zaten tek doğruluk kaynağı (`status`) var; istemci ek bir
state makinesi kurmadan bu alana göre dallanabilir. İkinci bir round-trip veya ayrı
"nereye git" uç noktası gereksiz karmaşıklık olurdu.

**Değerlendirilen alternatifler**: Backend'de `/resume` adında ayrı bir yönlendirme
uç noktası — reddedildi, mevcut detay uç noktasının yanıtı zaten yeterli bilgiyi taşıyor.

## 4. Frontend veri getirme yaklaşımı

**Karar**: Liste ve detay ekranları, projede zaten kullanılan basit `fetch` tabanlı
servis katmanı (`frontend/src/services/`) ile veri çeker; ek bir veri getirme
kütüphanesi (React Query, SWR vb.) **eklenmez**.

**Gerekçe**: `docs/TECH_STACK.md` bu kategoriyi kilitlememiştir ve mevcut dilimler
(`002-interview`, `003-pre-assessment`) böyle bir kütüphane tanımlamamıştır; bu dilim
kapsamında (liste + detay, iki basit GET + bir DELETE) manuel `useEffect`/`useState`
veya ince bir `useFetch` yardımcı fonksiyonu yeterlidir. Yeni bağımlılık eklemek,
"gerekçesiz karmaşıklık reddedilir" ilkesine aykırı olurdu.

**Değerlendirilen alternatifler**: TanStack Query eklemek — reddedildi (bu dilimin
kapsamı için aşırı mühendislik; ileride tüm frontend için ayrı bir ADR gerektirebilir,
bu dilim tek başına o kararı almaz).

## 5. Silme onayı ve boş durum bileşenleri

**Karar**: Onay adımı (FR-010) shadcn/ui `AlertDialog` bileşeniyle; boş durum
(FR-004) mevcut kart düzeni içinde basit bir mesaj + "Yeni Görüşme Başlat" CTA
butonuyla (Interview sekmesine yönlendirir) uygulanır. İkisi de zaten kilitli
shadcn/ui kütüphanesinin parçasıdır, yeni bağımlılık gerekmez.

**Gerekçe**: `docs/TECH_STACK.md` shadcn/ui'yi UI bileşen kütüphanesi olarak
kilitlemiştir; `AlertDialog` bu kütüphanenin standart bir parçasıdır.

## 6. MVP kapsam: PDF dışa aktarım ve skor trendi (FR-016, FR-017)

**Karar**: `docs/PLAN.md` fonksiyon backlog tablosunda bu iki fonksiyon **2026-07-31
tarihinde Bonus'tan MVP'ye yükseltildi** (düşük efor, yüksek kullanıcı değeri). Buna
rağmen **kesin kütüphane kararı bu planda verilmez**; somut seçim `speckit.tasks` /
implement fazında ayrı bir görev olarak ele alınır ve gerekirse `docs/DECISIONS.md`'ye
ADR eklenir (İlke VII) — bu, plan/tasarım aşamasını bloklamaz çünkü mimari etkisi yoktur
(yeni backend uç noktası veya tablo gerektirmez). Ön değerlendirme:
- **PDF dışa aktarım**: Rapor içeriği zaten `GET /api/interviews/:id` yanıtında
  mevcut; istemci tarafında (yeni backend uç noktası gerektirmeden) üretilebilir.
  Somut kütüphane seçimi (`jspdf`, `react-to-print` vb.) tasks fazında netleştirilir.
- **Skor trendi**: `docs/TECH_STACK.md`'de zaten kilitli **Recharts** (ADR-0011)
  kullanılır — yeni bir grafik kütüphanesi **eklenmez**. Veri kaynağı, kullanıcının
  `GET /api/interviews` listesindeki aynı `position` değerine sahip tamamlanmış ve
  raporlu kayıtların skorlarıdır; ayrı bir backend agregasyon uç noktası bu MVP'de
  açılmaz (istemci tarafında filtrelenip çizilir).

**Değerlendirilen alternatifler**: PDF kütüphane seçimini bu plan aşamasında kesinleştirmek
— reddedildi; mimariyi etkilemeyen, saf implementasyon detayı olan bir kararı erkenden
kilitlemek gerekçesiz karmaşıklık sayılır (İlke VII); tasks fazında küçük bir araştırma
görevi olarak ele alınması yeterlidir.

## Özet

Tüm noktalar netleştirildi; `[NEEDS CLARIFICATION]` kalmadı. Phase 1 tasarımına
geçilebilir.
