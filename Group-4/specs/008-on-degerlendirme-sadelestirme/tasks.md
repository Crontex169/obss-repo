# Tasks: Ön değerlendirme sadeleştirme + kademeli form (#69, #49)

**Kapsam**: `learningStyle`, `selfRatings`, `educationLevel` alanları formdan kaldırılır. Kalan 5 zorunlu alan üç gruba bölünür, üstte tek ilerleme göstergesi olur.

**Neden bu dosya var**: Bu iş bir kez spec'siz denendi (dangling commit `66b8c90`), sadece frontend formu değişti, geri kalan 5 katman güncellenmedi — derlenmedi ve 400 döndü. Aşağıdaki senkronizasyon listesi tam da bunun için var.

Satır numaraları `17bab43` (main merge sonrası) itibarıyladır.

---

## Kararlar

| # | Karar | Gerekçe |
|---|---|---|
| **K1** | Sütunlar **düşürülmez**, nullable yapılır. Veri silinmez. | Mevcut kayıtlar bu verilerden üretilmiş raporlara sahip; sütun düşürmek denetim izini yok eder. Repo bu duruşu başka yerde de tutuyor (`schema.prisma:332-333` `SetNull` yorumu). Geri alma da ucuzlar. |
| **K2** | Prompt'lar alan yoksa **satırı hiç yazmaz** (boş/varsayılan değer uydurmaz). | Desen zaten kodda: `competency-report.prompt.ts:86-88` `educationLevel` için bunu yapıyor. Yeni yardımcı yazılmaz. |
| **K3** | 3. grup tamamlanma **rozetine** girmez ama ilerleme **göstergesine girer**. | ~~Grup ilerleme göstergesine de girmez~~ *(2026-08-07'de değişti)*: yalnızca zorunluları sayan gösterge, ilk iki grup bitince %100 gösterip "form bitti" yalanı söylüyordu. Gösterge artık **soru başına** ilerliyor — 5 zorunlu + yetenek etiketleri + 3 açık uçlu = 9; %100 ancak hepsi dolunca çıkıyor. Rozet dışarıda kalmaya devam ediyor: grupta zorunlu alan yok, "tamamlandı" demenin ölçüsü yok. **Gönder düğmesi göstergeden bağımsız** — yalnızca 5 zorunlu alana bakar. |
| **K4** | Yeni form eski `assessment-form.tsx`'in **yerini alır**, yanına eklenmez. Eski bileşen ve testi aynı değişiklikte silinir. | İki form paralel yaşarsa alan kümeleri ayrışır — ilk denemede tam olarak bu oldu. |

---

## Senkronizasyon listesi — 6 katman

Sıra önemli: veri tabanı önce, arayüz sonra.

### 1. Veri tabanı — `backend/prisma/schema.prisma`

- [ ] `:357` `learningStyle   LearningStyle` → `LearningStyle?`
- [ ] `:359` `selfRatings     Json` → `Json?`
- [ ] Migration (`NOT NULL` → nullable). **`DROP COLUMN` yazılmaz** (K1).

### 2. İstek doğrulama — `backend/src/pre-assessment/dto/create-pre-assessment.dto.ts`

- [ ] `:96` `learningStyle` enum → şemadan çıkar
- [ ] `:112` `selfRatings` → şemadan çıkar
- [ ] `:115` `educationLevel` → şemadan çıkar
- [ ] `:23-31` `selfRatingsShape` / `selfRatingsSchema` → başka kullanıcısı kalmıyorsa silinir

**Geriye dönük uyumluluk zaten çalışıyor — bozma.** Ana şema bilinçli olarak `.strict()` kullanmıyor (`:129-131` yorumu gerekçeyi açıklıyor); Zod'un "strip" davranışı, kaldırılan alanları hâlâ gönderen eski bir sekmenin isteğini reddetmek yerine yok sayar. Şemaya `.strict()` eklenirse bu sessizce kırılır. (`selfRatingsSchema:31` ve `openAnswersSchema:63` iç içe şemalardır, `.strict()` kullanmaları ana davranışı değiştirmez.)

### 3. Kalıcılaştırma — `backend/src/pre-assessment/pre-assessment.service.ts`

- [ ] `:59`, `:62`, `:64` — `create` çağrısındaki üç atama kaldırılır
- [ ] `:82`, `:85`, `:87` — rapor istemine geçirilen aynı üç argüman kaldırılır

### 4. LLM istemleri — **iki ayrı dilim** (kaçırılması en kolay katman)

Bu alanlar yalnızca ön değerlendirmede değil, **görüşme sorusu üretiminde de** kullanılıyor.

**a) Yetkinlik raporu** — `backend/src/pre-assessment/llm/competency-report.prompt.ts`
- [ ] `:54` `learningStyle: string` → opsiyonel
- [ ] `:56` `selfRatings` → opsiyonel
- [ ] `:93` `ogrenme_tarzi` satırı → koşullu
- [ ] `:99-101` `oz_degerlendirme` bloğu → koşullu

**b) Görüşme sorusu üretimi** — `002-interview` dilimi
- [ ] `interview.service.ts:86` — `selfRatings: true` seçimi
- [ ] `interview.service.ts:102` — isteme geçirilen argüman
- [ ] `question-generation.ts:182` — tip alanı opsiyonel
- [ ] `question-generation.ts:195` — `oz_degerlendirme` satırı koşullu

> `selfRatings` opsiyonel olur olmaz `:102` bir `null` geçirebilir; `:195` bunu ele almazsa isteme `oz_degerlendirme: null` yazılır ve modele anlamsız girdi gider.

### 5. İstemci tipleri — `frontend/src/lib/pre-assessment-client.ts`

**İstek ve yanıt tipleri aynı yönde değişmez** — karıştırılırsa eski kayıtların görüntülenmesi kırılır.

- [ ] `:40`, `:42`, `:43` — **istek** tipi (`CreatePreAssessmentInput`): üç alan kaldırılır
- [ ] `:79`, `:82`, `:84` — **yanıt** tipi (kayıt detayı): alanlar **kalır**, nullable olur (eski kayıtlar bu veriyi taşıyor)

### 6. Arayüz + çeviriler

- [ ] `frontend/src/components/pre-assessment/assessment-form.tsx` → tümüyle kaldırılır, yerini yeni gruplu form alır (K4)
- [ ] `frontend/src/lib/pre-assessment-options.ts:50-56` (`educationLevel`) ve `:88-92` (`learningStyle`) → başka kullanıcısı kalmıyorsa silinir
- [ ] `frontend/src/lib/i18n` **tr + en**: `form.educationLevelLabel`, `form.learningStyleLegend`, öz-puanlama madde etiketleri, `options.educationLevel.*`, `options.learningStyle.*`

---

## Kademeli form davranışı (#49)

- [ ] Üç grup: temel bilgiler (deneyim yılı, çalışma durumu) / çalışma tarzı (iş tercihi, ekip tercihi, problem yaklaşımı) / öz değerlendirme (yetenekler + açık uçlu, hepsi opsiyonel)
- [ ] İlk açılışta yalnızca 1. grup açık, gösterge %0
- [ ] Bir grubun zorunlu alanları bitince: tamamlandı işareti + sonraki grup otomatik açılır
- [x] Üstte **tek** genel ilerleme göstergesi (grup başına ayrı gösterge yok); cevaplanan soru / toplam 9 oranını yansıtır — her soruda artar, %100 ancak hepsi dolunca çıkar
- [x] Her grup başlığında **aşağı ok ikonu** — açılır olduğu tek bakışta belli olsun; grup açıkken 180° dönüyor
- [ ] Gönder düğmesi yalnızca 5 zorunlu alan doluyken etkin
- [ ] Tamamlanmış grup elle tekrar açılıp kapanabilir; cevap değişirse gösterge geriye doğru da güncellenir
- [x] **Gruplar kilitli DEĞİL** — kullanıcı istediği grubu istediği an açabilir. Otomatik açılma yalnızca bir kolaylık, bir kapı değil. *(2026-08-07 kararı: ilk uygulama grupları `disabled` yapmıştı; kilit, formu doldurma sırasını kullanıcıya dayatıyordu ve sebebi görünmüyordu.)*
- [x] **Form mevcut cevaplarla dolu açılır** — aktif kayıt varsa cevapları yüklenir, kullanıcı raporunu değiştirmek için 5 soruyu baştan cevaplamaz. Backend zaten tek aktif kayıt tutuyor ve yeni gönderim eskisini arşivliyor (`pre-assessment.service.ts:104-107`, FR-009a); eksik olan yalnızca formun boş açılmasıydı.
  - `AssessmentForm` başlangıç değerlerini **yalnızca ilk render'da** okur → sayfa, aktif kayıt yüklenene kadar formu render etmez (iskelet gösterir). Bu sıra bozulursa geç gelen cevaplar forma işlemez.
- [ ] **Erişilebilirlik (atlanamaz)**: otomatik açılan grup ekran okuyucuya duyurulur, odak kaybolmaz, başlıklar gerçek `<button>` ve klavye ile erişilebilir

---

## Testler

Bu 8 dosya bu değişiklikle birlikte güncellenir — kırmızı kalırsa iş bitmemiştir:

| Dosya | Neden |
|---|---|
| `backend/test/integration/pa-schema-constraints.spec.ts` | NOT NULL kısıtı artık yok |
| `backend/test/integration/pa-us1-validation.spec.ts` | Zorunlu alan beklentileri |
| `backend/test/integration/pa-us1-enum-guard.spec.ts` | `learningStyle` enum koruması |
| `backend/test/integration/helpers/fake-competency-report.ts` | Fixture alanları taşıyor |
| `backend/test/unit/pa-us2-conflict-mapping.spec.ts` | Girdi kümesi |
| `backend/test/unit/pa-us3-timeout.spec.ts` | Girdi kümesi |
| `backend/test/unit/prompt-isolation.spec.ts` | İstem çıktısı satır satır doğrulanıyor |
| `frontend/test/assessment-form.spec.tsx` | Eski bileşenle birlikte silinir (K4) |

Eklenecek:
- [ ] **Her iki istem üreticisi** için: alanları dolu eski kayıt → satırlar var; alanları boş yeni kayıt → satırlar hiç yok
- [ ] Yeni form: grup açılma sırası, ilerleme yüzdesi, gönder düğmesi etkinliği

> Testler `MAIL_TRANSPORT=console` ile koşulur — `.env`'deki gerçek mail sağlayıcısı entegrasyon testlerini FK hatasıyla kırar.

---

## Açık soru — kod okunarak kapatılacak

`PreAssessment.experienceLevel` **türetilmiş** alandır (`schema.prisma:368`) ve `002-interview` FR-021 tarafından okunur. Türetim mantığı kaldırılan üç alandan birine bağımlıysa bu iş, türetim yeniden tanımlanmadan yapılamaz. **İlk adım bunu doğrulamak.**

---

## Bitti sayma ölçütü

- [ ] 6 katmanın tamamı güncellendi
- [ ] Alanları dolu **eski** kayıt raporuyla birlikte açılıyor
- [ ] Alanları boş **yeni** kayıt ile rapor üretiliyor ve şema doğrulamasını geçiyor
- [ ] `npm test` (backend + frontend) yeşil, `npm run build` (frontend, `tsc -b` dahil) hatasız — çıktılar gösterilir

Rapor bölümlerinden biri girdi yetersizliği yüzünden tutarlı biçimde boş kalırsa: K1 sayesinde alanlar geri açılabilir. Geri alma yolu budur.
