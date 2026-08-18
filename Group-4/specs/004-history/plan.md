# Uygulama Planı: Interview History (Görüşme Geçmişi)

**Dal (Branch)**: `004-history` | **Tarih**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Girdi**: `specs/004-history/spec.md` özellik spesifikasyonu

**Not**: Bu plan `speckit.plan` iş akışıyla üretilmiştir. Teknoloji yığını ADR-0001…0011
(bkz. `docs/DECISIONS.md`, `docs/TECH_STACK.md`) ile kilitlenmiştir ve burada yeniden
tartışılmaz; bu dilim **yeni bir ADR açmaz**. Bu dilim, **002-interview** dilimindeki
Görüşme (Interview) veri modeline ve HTTP sözleşmesine **bağımlıdır** ve onu yeniden
üretmez; `002-interview`'in **spec/data-model/contract** dosyaları (`spec.md`,
`data-model.md`, `contracts/*`) bu görev kapsamında **değiştirilmez** (o dilimin şema/
sözleşme sahipliği sürer).

**2026-08-03 revizyonu (çakışma önleme)**: İlk yazımdan (2026-07-31) sonra `002-interview`
main'e merge edildi (`005-interview-dikeyi-implementasyon`). Merge edilen frontend kodu,
bu planın ilk sürümünün sıfırdan kurmayı öngördüğü işlevin büyük kısmını **zaten**
içeriyor: `/interviews` rotası (`frontend/src/pages/interview/list.tsx`), kart bileşeni
(`frontend/src/components/interview/interview-card.tsx`), oturum/resume sayfası
(`frontend/src/pages/interview/session.tsx`, `status="completed"` durumunda zaten rapora
yönlendiriyor), rapor sayfası (`frontend/src/pages/interview/report.tsx`) ve ortak API
istemcisi (`frontend/src/lib/interview-client.ts`: `listInterviews`, `getInterview`,
`getReport`). Ayrıca backend'de soft-delete liste filtresi (`interview.service.ts:475`,
`deletedAt: null`) **zaten** owner için uygulanıyor. `list.tsx`'in kendi kod yorumu bunu
zaten öngörmüştü: *"Bu ekran 004-history diliminin veri temelini kullanir"* — yani bu
dosyaların 004-history tarafından **genişletilmesi**, `002-interview`'in sahiplik
sınırının ihlali değil, planlanmış devir noktasıdır.

**Karar**: Bu dilim artık paralel bir `/history` sayfa ağacı **kurmaz**; yukarıdaki
mevcut frontend dosyalarını **genişletir** (bkz. güncellenmiş "Proje Yapısı"). Bu, hem
iki paralel "geçmiş görüşmeler" arayüzünün (route/bileşen/servis çakışması) önüne geçer
hem de gereksiz yeniden inşa işini ortadan kaldırır. Aşağıdaki "Kaynak Kod" ağacı bu
kararı yansıtacak şekilde güncellenmiştir; ilk sürümdeki `frontend/src/pages/history/**`
ve `frontend/src/components/history/**` planı **terk edilmiştir**.

## Özet

Bu dilim, Dashboard'daki **"Interview History"** sekmesini (geçmiş görüşmelerin kart
görünümünde listelenmesi) ve **Görüşme Detayı** ekranını (soru/cevap/rapor tam görünümü)
kapsar. Ayrıca kullanıcının bir görüşmeyi kendi listesinden **soft-delete** ile
kaldırmasını sağlayan silme davranışını (uç noktası dahil) **inşa eder** — bu, spec ve
`docs/API_CONVENTIONS.md` §4.3'ün `002-interview` kapsamı dışına açıkça bıraktığı tek
sorumluluktur.

**Teknik yaklaşım**: Bu dilim yeni bir backend modülü **açmaz**; mevcut `002-interview`
`InterviewModule`'üne tek bir yeni uç nokta (`DELETE /api/interviews/:id`) ekler ve
mevcut iki uç noktayı (`GET /api/interviews`, `GET /api/interviews/:id`) **sözleşme
değişikliği olmadan** tüketir. Veri modeli düzeyinde bu dilim şema sahibi **değildir** —
`Interview` tablosunun `status`, `deletedAt`, `currentQuestionOrder`, `reportStatus`
alanları zaten `002-interview/data-model.md`'de tanımlıdır; bu dilim yalnızca `deletedAt`
alanını **dolduran** (yazma) tek uç noktayı ekler.

Frontend'de de bu dilim yeni bir sayfa ağacı **açmaz**: React 19 + Vite + TypeScript +
Tailwind + shadcn/ui ile mevcut `/interviews` kart listesini (`docs/APP_FLOW.md` #4/#6
kilitli UI kararı: kart görünümü — chat tarzı **değil**), mevcut oturum/rapor sayfalarını
ve ortak API istemcisini **genişletir**: eksik `level` rozeti, "Sil" aksiyonu + onay
(`AlertDialog`), tamamlanmış görüşme için soru/cevap+rapor birleşik görünümü (bkz.
"Kaynak Kod"), PDF dışa aktarım ve skor trendi eklenir. Yeni oluşturulan tek şey,
mevcut desenlerle tutarlı küçük bileşenlerdir (`DeleteConfirmDialog`,
`ScoreTrendChart`, `PdfExportButton`); yeni route şeması veya paralel servis katmanı
**yoktur**.

**Kapsam dışı (bilinçli)**: Görüşme oluşturma, soru üretimi, soru-cevap akışı, cevap
kaydı, rapor üretimi — tümü `002-interview`'a aittir ve bu dilimde yeniden
uygulanmaz/değiştirilmez. Meslek/pozisyon filtresi ve admin'e özgü görünümler
(`005-admin`'e aittir).

## Teknik Bağlam

**Dil/Sürüm**: TypeScript 5.x (Node.js 20 LTS backend); React 19 (frontend) — mevcut
proje yığınıyla aynı, yeni bir dil/sürüm kararı yok.

**Birincil Bağımlılıklar**:
- Backend: NestJS, Prisma (`docs/TECH_STACK.md` kilitli sürümler) — mevcut
  `InterviewModule`'e eklenen tek yeni controller metodu (`DELETE`); yeni npm bağımlılığı
  **yok**.
- 001-auth-rol'den `SessionGuard`, 002-interview'den `InterviewOwnershipGuard`
  (**yeniden kullanılır** — yeni bir guard yazılmaz).
- Frontend: React 19, Vite 6, Tailwind CSS 4, shadcn/ui (`Card`, `Badge`, `AlertDialog`,
  `Button`) — kilitli bileşen kütüphanesinden; yeni veri getirme kütüphanesi (React
  Query/SWR) **eklenmez** (research.md §4, gerekçeli karar). S5 (MVP) için
  Recharts (zaten kilitli, ADR-0011) skor trendinde kullanılabilir; PDF dışa aktarım
  kütüphanesi MVP sonrasına ertelenir (research.md §6).

**Depolama**: PostgreSQL 16 — **aynı** veritabanı, **aynı** şema; bu dilim yeni tablo/
alan **açmaz** (bkz. data-model.md "Bu dilim şema sahibi DEĞİLDİR"). Tek veri katmanı
etkisi: mevcut `Interview.deletedAt` alanına yazan yeni bir uç nokta.

**Test**: Jest + Supertest (backend — yeni `DELETE` uç noktası için entegrasyon testi,
sahiplik/404/idempotency dahil), Vitest + React Testing Library (kart listesi, detay
sayfası, silme onay diyaloğu bileşen testleri), Playwright (S1-S4 uçtan uca akışları,
bkz. quickstart.md). LLM'e bağlı hiçbir yeni test **yoktur** (bu dilim LLM çağrısı
yapmaz, yalnızca mevcut LLM çıktısını — raporu — görüntüler).

**Hedef Platform**: Modern web tarayıcıları (SPA); backend Linux sunucu/container —
002-interview ile aynı.

**Proje Türü**: Web uygulaması (mevcut `backend/` + `frontend/` — 002-interview ile
**aynı** proje köküne eklenen dikey dilim; backend tarafında **yeni modül değil, mevcut
modüle eklenen uç nokta**).

**Performans Hedefleri**: Liste görüntüleme < 2 sn (SC-001); detay erişimi ≤ 3
etkileşim (SC-003). Bu dilim LLM'e bağımlı olmadığından (yalnızca kayıtlı veriyi okur),
performans riski düşüktür.

**Kısıtlar**:
- Sahiplik ve soft-delete görünürlük kontrolleri **sunucu tarafında** uygulanır (FR-001,
  FR-009, İlke V); istemci kontrolüne güvenilmez.
- Yabancı/olmayan kayıt **daima `404`** — varlık gizliliği (`API_CONVENTIONS.md` §1,
  FR-009).
- Silme **fiziksel değil, soft-delete**'tir (İlke VI, FR-011, FR-012); admin
  görünürlüğü bu dilimde **bozulmaz** (ileride `005-admin` tarafından tüketilir).
- Rapor üretimi başarısız durumunda sessiz başarısızlık yasak — detay ekranı açık hata
  bilgisi gösterir (FR-008, İlke VI/VII).
- `002-interview`'in **spec/data-model/contract** dosyaları ve `003-pre-assessment`
  dosyaları bu görev kapsamında **değiştirilmez** (şema/sözleşme sahipliği onlarda
  kalır). `002-interview`'in **frontend kod** dosyaları (`list.tsx`, `interview-card.tsx`,
  `session.tsx`, `report.tsx`, `interview-client.ts`) planlanmış devir noktası olarak bu
  dilimde **genişletilir** (bkz. 2026-08-03 revizyonu, üstte).

**Ölçek/Kapsam**: Staj/vaka çalışması ölçeği. 5 kullanıcı hikâyesi (tamamı MVP —
2026-07-31 kararıyla Story 5/FR-016/FR-017 Bonus'tan MVP'ye yükseltildi), 17
fonksiyonel gereksinim (tamamı MVP), backend tarafında **tek yeni uç nokta**
(`DELETE`), frontend tarafında iki yeni ekran (liste, detay) + bir onay diyaloğu.

## Anayasa Kontrolü (Constitution Check)

*KAPI: Phase 0 araştırmasından önce geçilmeli; Phase 1 tasarımdan sonra yeniden kontrol edilir.*

Anayasa `v1.0.0` ilkelerine göre değerlendirme:

| İlke | Durum | Bu dilimde nasıl karşılanıyor |
|------|-------|-------------------------------|
| **I. AI-Native & Devlog** | ✅ Uyumlu | Oturum sonunda `AI-DEVLOG.md` güncellenecek (bu oturumun ve sonraki tasks/implement fazlarının çıktısı). |
| **II. Spec-Öncelikli** | ✅ Uyumlu | `spec.md` mevcut ve tek geçişte doğrulandı (`checklists/requirements.md`); Türkçe Gherkin kabul kriterleri (5 hikâye) mutlu yol + edge + error kapsıyor. |
| **III. Test-Öncelikli / ATDD** | ✅ Uyumlu (kapı: tasks) | Kabul kriterleri quickstart.md S1-S5 senaryolarına eşlendi; `DELETE` uç noktası ve detay/liste görüntüleme kritik akış, test kapsamı olmadan merge edilmez. |
| **IV. Dikey Dilim & Düzen** | ✅ Uyumlu | Tek dikey değer (History listeleme + detay + silme) uçtan uca (UI → mevcut NestJS controller'a eklenen uç nokta → Postgres); 002-interview'in guard ve veri modeli **yeniden yazılmadan** kullanılır. Kökteki teslim dosyaları (`SETUP.md`, `AI-DEVLOG.md`, `DECISIONS.md`) zorunlu, dokunulmaz. |
| **V. Güvenlik & Injection Savunması** | ✅ Uyumlu | Sahiplik (`InterviewOwnershipGuard` yeniden kullanımı) ve soft-delete filtresi **sunucu tarafında** (FR-001, FR-009, FR-011); bu dilim LLM'e kullanıcı verisi göndermez (yalnızca mevcut kayıtlı raporu görüntüler) — prompt injection yüzeyi **genişletilmez**. |
| **VI. LLM Sözleşmesi & Gözlemlenebilirlik** | ✅ Uyumlu | Bu dilim yeni bir LLM çağrısı **yapmaz**; mevcut `reportStatus`/`Report` verisini olduğu gibi gösterir, `reportStatus="failed"` için sessiz başarısızlık göstermez (FR-008). Soft-delete: kullanıcı silse dahi admin'de "silindi" rozetiyle görünmeye devam eder (FR-012) — bu dilimin **tam olarak uyguladığı** ilke maddesi. |
| **VII. Kararların Gerekçelendirilmesi & UX** | ✅ Uyumlu | Yeni teknoloji kararı **yok**; research.md'deki uygulama-yaklaşımı kararları (silme sahipliği, resume yönlendirme mantığı, veri getirme yaklaşımı) gerekçeleriyle belgelendi, hiçbiri kilitli ADR ile çelişmiyor. UX: silme öncesi onay adımı (FR-010), hata durumlarında zarif toparlanma + tekrar deneme (FR-008, FR-015), sessiz başarısızlık yok. |

**Karmaşıklık kapıları**: İlave karmaşıklık yok. Yeni backend modülü/servis/tablo
açılmaz; mevcut `InterviewModule`'e tek bir uç nokta eklenir. Yeni frontend veri getirme
kütüphanesi eklenmez (research.md §4, gerekçeli reddedilen alternatif — TanStack Query).
S5 (PDF dışa aktarım/trend, MVP) somut PDF kütüphane seçimi tasks/implement fazına
bırakıldı (research.md §6, gerekçeli — istemci tarafı üretim, yeni backend uç noktası
gerektirmez); skor trendi zaten kilitli Recharts (ADR-0011) ile karşılanır, yeni kararı
beklemez. **Sonuç: GEÇTİ (PASS)** — gerekçesiz ihlal yok.

**Post-Design yeniden değerlendirme (Phase 1 sonrası)**: Tasarım çıktıları
(`data-model.md`, `contracts/history-api.md`, `quickstart.md`) `002-interview`'in
şemasını ve mevcut iki uç noktasını **değiştirmeden** referans verdi; tek yeni sözleşme
(`DELETE /api/interviews/:id`) `API_CONVENTIONS.md` §1/§2/§4.3 ile tam uyumlu tasarlandı.
Anayasa kontrolü **hâlâ GEÇİYOR**.

## Proje Yapısı

### Dokümantasyon (bu özellik)

```text
specs/004-history/
├── plan.md              # Bu dosya (speckit.plan çıktısı)
├── research.md          # Phase 0 çıktısı
├── data-model.md         # Phase 1 çıktısı (şema sahibi DEĞİL — 002-interview'i tüketir)
├── quickstart.md        # Phase 1 çıktısı
├── contracts/           # Phase 1 çıktısı
│   └── history-api.md   # Yalnızca YENİ uç nokta (DELETE) + referans notları
├── checklists/
│   └── requirements.md  # (mevcut)
└── tasks.md             # Phase 2 çıktısı (speckit.tasks — ÜRETİLDİ, 2026-07-31)
```

### Kaynak Kod (repo kökü)

Web uygulaması yapısı (frontend + backend — 002-interview ile **aynı** proje köküne
eklenen dikey dilim). Backend tarafında **yeni modül yok**; yalnızca mevcut
`InterviewModule`'e eklenecek uç nokta işaretlenmiştir (implementasyon `002-interview`
ekibiyle koordine edilerek, `speckit.tasks`/`speckit.implement` fazında, ayrı bir PR'da
yapılacaktır — bu plan kodu değiştirmez). Frontend tarafında (2026-08-03 revizyonu)
**yeni bir sayfa/route ağacı yok** — `002-interview`'in zaten merge olmuş, bu dilim için
hazırlanmış dosyaları genişletilir:

```text
backend/
├── src/
│   ├── auth/                  # (001-auth-rol — değiştirilmez)
│   ├── llm/                   # (002-interview — değiştirilmez, bu dilim kullanmaz)
│   └── interview/              # (002-interview'in InterviewModule'ü — buraya EK yapılır)
│       ├── interview.controller.ts    # (+) DELETE /api/interviews/:id (bu dilim ekler)
│       ├── interview.service.ts       # (+) softDelete(interviewId, userId) metodu
│       └── ownership/
│           └── interview-ownership.guard.ts  # (mevcut — yeniden kullanılır, değişmez)
└── test/
    └── integration/
        └── history-delete.spec.ts     # (+) bu dilimin YENİ entegrasyon testi

frontend/
├── src/
│   ├── pages/
│   │   └── interview/
│   │       ├── list.tsx             # (~) MEVCUT — "Interview History" listesi; (+) level rozeti, (+) Sil aksiyonu
│   │       ├── session.tsx          # (~) MEVCUT — resume akışı; (+) FR-014 otomatik yönlendirme netleştirmesi
│   │       └── report.tsx           # (~) MEVCUT — rapor görünümü; (+) soru/cevap listesi eklenerek Görüşme Detayı'na (US3) genişletilir
│   ├── components/
│   │   └── interview/
│   │       ├── interview-card.tsx   # (~) MEVCUT — (+) level rozeti, (+) Sil aksiyonu (DeleteConfirmDialog tetikler)
│   │       ├── delete-confirm-dialog.tsx  # (+) YENİ — shadcn/ui AlertDialog, geri dönüşü olmayan işlem onayı (FR-010)
│   │       ├── question-answer-list.tsx   # (+) YENİ — report.tsx'e eklenecek soru/cevap render bileşeni (US3)
│   │       ├── pdf-export-button.tsx      # (+) YENİ — US5, istemci tarafı PDF üretimi
│   │       └── score-trend-chart.tsx      # (+) YENİ — US5, Recharts (ADR-0011, ek bağımlılık yok)
│   └── lib/
│       └── interview-client.ts      # (~) MEVCUT — (+) deleteInterview(id) fetch sarmalayıcısı eklenir; yeni paralel servis dosyası AÇILMAZ
└── test/
    ├── interview-list.test.tsx      # (+) genişletilmiş liste testleri (level rozeti, silme)
    ├── delete-confirm-dialog.test.tsx  # (+)
    └── interview-detail.test.tsx    # (+) soru/cevap+rapor birleşik görünüm testi
```

`(~)` = mevcut dosyaya ek/değişiklik, `(+)` = yeni dosya.

**Yapı Kararı**: Mevcut web uygulaması yapısı (`backend/` + `frontend/`) korunur; bu
dilim yeni bir proje/servis/modül **veya route şeması** açmaz. Backend'de
`002-interview`'in `InterviewModule`'üne tek bir uç nokta (`DELETE`) eklenir; bu ekleme,
o dilimi implemente eden ekiple **koordine edilerek** ayrı, küçük bir PR olarak
yapılacaktır. Frontend'de `002-interview`'in zaten ürettiği `/interviews`,
`/interview/:id`, `/interview/:id/report` sayfaları **korunur ve genişletilir**; bu,
002-interview'in kendi kod yorumunda öngördüğü devir noktasıdır (bkz. 2026-08-03
revizyonu). Bu tercih, aynı işlevi yapan ikinci bir paralel sayfa/servis ağacının
doğmasını (route çakışması, `interview-client.ts` ile fonksiyonel olarak çakışan yeni
bir servis dosyası) önler.

## Karmaşıklık Takibi

> Anayasa kontrolünde gerekçelendirilmesi gereken ihlal bulunmadığından bu tablo boştur.

İhlal yok — yeni backend modülü/tablo açılmadı (mevcut `InterviewModule`'e tek uç nokta
eklendi); yeni frontend veri getirme kütüphanesi eklenmedi (research.md §4); S5 (PDF/trend,
MVP) somut PDF kütüphane seçimi tasks/implement fazına bırakıldı, plan/tasarım aşamasını
bloklamıyor; skor trendi zaten kilitli Recharts (ADR-0011) ile karşılanıyor (research.md §6).

## Phase 0: Araştırma

Ayrıntılar için bkz. [research.md](./research.md). Çözülen uygulama-yaklaşımı kararları:
bu dilimin şema sahibi olmadığının doğrulanması, silme uç noktasının sahipliği
(`004-history`), "Devam Et" yönlendirme/yarış durumu mantığı, frontend veri getirme
yaklaşımı (ek kütüphane yok), silme onayı/boş durum bileşenleri (shadcn/ui), S5 (PDF/trend,
MVP) için kütüphane seçiminin tasks/implement fazına bırakılma gerekçesi.

`[NEEDS CLARIFICATION]` kalmadı; hiçbir nokta kilitli ADR'lerle çelişmiyor.

## Phase 1: Tasarım & Sözleşmeler

- **Veri modeli**: [data-model.md](./data-model.md) — bu dilimin **şema sahibi
  olmadığını** açıkça belgeler; `002-interview/data-model.md`'deki `Interview` alanlarının
  (özellikle `status`, `deletedAt`, `currentQuestionOrder`, `reportStatus`) bu dilim için
  kullanımını ve tek yeni veri geçişini (`deletedAt: null → now()`) izlenebilir kılar.
- **Cross-cutting sözleşme**: [`docs/API_CONVENTIONS.md`](../../docs/API_CONVENTIONS.md) —
  hata zarfı, `404` kuralı, soft-delete görünürlüğü (§4.3). Bu dilimin sözleşmesi bunu
  **yeniden tanımlamaz**.
- **Sözleşmeler**: [contracts/history-api.md](./contracts/history-api.md) — yalnızca
  **yeni** `DELETE /api/interviews/:id` uç noktasını tanımlar; mevcut `GET` uç
  noktalarını (`002-interview/contracts/interview-api.md`, değiştirilmedi) referans verir.
- **Doğrulama kılavuzu**: [quickstart.md](./quickstart.md) — kurulum + kabul
  senaryolarının (S1-S5) uçtan uca doğrulanması ve başarı kriteri eşlemesi.

## Tamamlanma Raporu

Bu komut Phase 1 tasarımından sonra sonlanır. Üretilen çıktılar Tamamlanma bölümünde özetlenir.

**Phase 2 güncellemesi (speckit.tasks, 2026-07-31)**: [tasks.md](./tasks.md) üretildi —
5 kullanıcı hikâyesi (tümü MVP) + Kurulum + Foundational + Cilalama fazlarına ayrılmış
57 görev; devralma doğrulaması (T001-T002) Faz 1'de; backend `DELETE` uç noktası eklemesi
(T038-T039) `002-interview` ekibiyle koordineli ayrı bir PR olarak işaretlendi (T057).

**⚠️ 2026-08-03 revizyonu — tasks.md senkronizasyonu bekliyor**: Üstteki "Proje Yapısı"
bölümü, `002-interview`'in merge olmuş frontend koduyla çakışmayı önlemek için
`frontend/src/pages/history/**` / `frontend/src/components/history/**` yaklaşımından
**mevcut `frontend/src/pages/interview/**`'i genişletme** yaklaşımına revize edildi.
`tasks.md`'deki Faz 2-7 görevleri (T006-T052) hâlâ eski (paralel dosya ağacı) planına
göre yazılmıştır ve bu revizyonla **tutarsızdır** — implementasyona başlamadan önce
`/speckit-tasks` ile yeniden üretilmeli veya elle bu plana göre güncellenmelidir.
Implementasyon `speckit.implement` fazında yapılacaktır; bu plan/tasks dosyaları kod
içermez.
