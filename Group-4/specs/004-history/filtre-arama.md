# 004-history Uzantısı: Görüşmelerim — Filtreleme ve Arama

**Feature Branch**: `feat/interview-history-filtre-arama`

**Created**: 2026-08-05

**Status**: Onaylı (tasarım kullanıcı tarafından onaylandı)

**Input**: GitHub issue [#42](https://github.com/OBSS-AI-Summer-Internship-2026/Group-4/issues/42) —
"feat: Gorusmelerim kismina filtreleme ve arama eklensin".

## Kapsam Notu

Bu doküman **yeni bir dikey değildir**. `004-history` diliminin User Story 1'ini
(geçmiş görüşmeleri kart görünümünde listeleme) genişletir: `/interview` ekranındaki
liste, istemci tarafında filtrelenebilir ve aranabilir hâle gelir.

Kapsam **yalnızca frontend**'dir. Veri modeli, API sözleşmesi ve backend davranışı
değişmez; `GET /api/interviews` bugünkü hâliyle kullanıcının tüm (silinmemiş)
görüşmelerini tek istekte döndürür ve filtreleme bu yanıt üzerinde bellekte yapılır.

## Issue ile Terim Farkı (karar)

Issue'da filtre seti "Tümü / Tamamlandı / **Planlandı**" olarak yazılmıştır. Veri
modelinde `Interview.status` yalnızca `in_progress` ve `completed` değerlerini alır
(`specs/004-history/data-model.md`); "planlanmış" bir görüşme durumu yoktur ve
görüşmeler anında başlatılır. Bu nedenle üçüncü seçenek, mevcut kart rozetiyle
tutarlı olacak şekilde **"Yarım Kaldı"** (`in_progress`) olarak adlandırılır.
Issue'nun niyeti (durum bazlı üçlü filtre) korunmuştur.

## User Scenarios & Testing

### User Story 1 - Duruma göre filtreleme (Priority: P1)

Kullanıcı "Görüşmelerim" ekranında durum çipleriyle listeyi daraltır: Tümü,
Tamamlandı, Yarım Kaldı. Her çip, o duruma düşen kayıt sayısını rozet olarak gösterir.

**Why this priority**: Issue'nun birincil talebi ve en sık ihtiyaç: "yarım kalanları
göster, devam edeyim".

**Independent Test**: Karışık durumlu görüşmeleri olan bir kullanıcıda her çipe
tıklanıp yalnızca ilgili kartların kaldığı doğrulanarak bağımsız test edilir.

**Acceptance Scenarios**:

1. **Diyelim ki** kullanıcının 2 tamamlanmış, 1 yarım kalmış görüşmesi var, **Olduğunda**
   "Tamamlandı" çipine tıklar, **O zaman** yalnızca 2 kart görünür ve çip seçili
   görünüme geçer.
2. **Diyelim ki** "Tamamlandı" filtresi aktif, **Olduğunda** kullanıcı "Tümü" çipine
   tıklar, **O zaman** 3 kart yeniden görünür.
3. **Diyelim ki** kullanıcının hiç yarım kalmış görüşmesi yok, **Olduğunda** liste
   görüntülenir, **O zaman** "Yarım Kaldı" çipi `0` rozetiyle **pasif** (tıklanamaz)
   gösterilir.

---

### User Story 2 - Arama kutusu (Priority: P1)

Kullanıcı arama kutusuna yazdıkça liste anında daralır. Arama; pozisyon adında ve
kart rozeti metinlerinde (durum, seviye, mod) eşleşme arar — "senior", "sözlü" veya
"tamamlandı" yazmak da sonuç verir.

**Why this priority**: Issue'nun ikinci talebi; çok sayıda görüşmesi olan kullanıcı
için tek adımda erişim sağlar.

**Independent Test**: Bilinen pozisyon adlarına sahip görüşmelerle, kutuya yazılan
metnin listeyi doğru daralttığı doğrulanarak bağımsız test edilir.

**Acceptance Scenarios**:

1. **Diyelim ki** "Backend Developer" ve "Data Analyst" görüşmeleri var, **Olduğunda**
   kullanıcı "back" yazar, **O zaman** yalnızca "Backend Developer" kartı kalır.
2. **Diyelim ki** aynı liste, **Olduğunda** kullanıcı "BACK" yazar, **O zaman** sonuç
   aynıdır (büyük/küçük harf duyarsız).
3. **Diyelim ki** kullanıcı "senior" yazar, **O zaman** seviyesi Senior olan tüm
   görüşmeler kalır (rozet metni üzerinden eşleşme).
4. **Diyelim ki** hiçbir kayıt eşleşmiyor, **O zaman** "Seçtiğin filtrelerle eşleşen görüşme yok"
   boş durumu ve "Filtreleri temizle" aksiyonu gösterilir.
5. **Diyelim ki** pozisyonu çıkarılamamış (`position = null`) bir görüşme var,
   **Olduğunda** kullanıcı "belirsiz" yazar, **O zaman** o kart eşleşir (kartta
   görünen "Belirsiz pozisyon" metni üzerinden).

---

### User Story 3 - Seviye ve mod filtreleri (Priority: P2)

Kullanıcı "Filtreler" düğmesiyle açılan panelde Seviye (Stajyer / Junior / Senior) ve
Mod (Sözlü / Yazılı) çiplerinden **birden fazlasını** seçebilir.

**Why this priority**: Durum + arama olmadan da değerlidir ama ikincil; issue'da
doğrudan istenmemiş, kullanıcı onayıyla kapsama alınmıştır.

**Independent Test**: Farklı seviye/mod kombinasyonlarına sahip görüşmelerde çoklu
seçimin birleşim (OR) mantığıyla çalıştığı doğrulanarak bağımsız test edilir.

**Acceptance Scenarios**:

1. **Diyelim ki** Junior ve Senior görüşmeler var, **Olduğunda** kullanıcı hem "Junior"
   hem "Senior" çipini seçer, **O zaman** her iki seviyedeki kartlar görünür (OR).
2. **Diyelim ki** "Senior" seçili, **Olduğunda** kullanıcı ayrıca "Sözlü" moda tıklar,
   **O zaman** yalnızca Senior **ve** Sözlü görüşmeler kalır (setler arası AND).
3. **Diyelim ki** panel kapalı ve 2 filtre aktif, **O zaman** "Filtreler" düğmesi `2`
   rozetiyle aktif filtre sayısını gösterir.

---

## Requirements *(mandatory)*

Numaralandırma `004-history/spec.md`'nin devamıdır (son madde FR-017).

- **FR-018**: Sistem, "Görüşmelerim" listesinde durum bazlı **tek seçimli** bir filtre
  seti sunmalıdır: Tümü (varsayılan) / Tamamlandı / Yarım Kaldı.
- **FR-019**: Sistem, pozisyon adı ve kartta **görünen tüm rozet metinleri** (durum,
  rapor durumu, seviye, mod) üzerinde büyük/küçük harf duyarsız alt dize araması yapan
  bir arama kutusu sunmalıdır. Pozisyonu `null` olan kayıt, kartta gösterilen
  "Belirsiz pozisyon" metniyle eşleşir.
- **FR-019a**: Karşılaştırma öncesi hem sorgu hem hedef metin normalize edilir:
  `toLocaleLowerCase('tr')` ve ardından Türkçe harflerin ASCII karşılığına katlanması
  (`ı→i`, `ş→s`, `ğ→g`, `ü→u`, `ö→o`, `ç→c`). Katlama zorunludur: Türkçe yerel ayarda
  `'ANALIST' → 'analıst'` olur ve katlama olmadan "Analist" ile eşleşmez; ayrıca
  kullanıcı sıklıkla diakritiksiz yazar ("sozlu" yazınca "Sözlü" bulunmalıdır).
- **FR-020**: Sistem, Seviye ve Mod için **çok seçimli** filtre setleri sunmalıdır. Bir
  set içindeki seçimler OR, setler arası kısıtlar AND ile birleşir. Boş set = kısıt yok.
- **FR-021**: Her filtre çipi, o çip seçilirse ortaya çıkacak sonuç sayısını rozet
  olarak göstermelidir (canlı sayaç). Hesap, **kendi seti hariç** tüm aktif kısıtlar
  (arama + diğer iki set) uygulandıktan sonra yapılır; böylece bir set içindeki
  çipler birbirinin sayacını sıfırlamaz.
- **FR-021a**: Sayacı 0 olan çip pasifleştirilmeli ve seçilememelidir. **Seçili bir
  çip hiçbir koşulda pasifleştirilmez** — aksi hâlde kullanıcı kendi seçimini geri
  alamaz hâle gelir.
- **FR-022**: Sistem, liste üstünde "N görüşmeden M'si gösteriliyor" biçiminde bir
  sonuç sayacı ve en az bir filtre aktifken "Filtreleri temizle" aksiyonu göstermelidir.
- **FR-023**: Filtre sonucu boşsa sistem, mevcut "hiç görüşme yok" boş durumundan
  **ayırt edilebilir** bir boş durum göstermelidir ("Seçtiğin filtrelerle eşleşen görüşme yok").
- **FR-024**: Kullanıcının hiç görüşmesi yoksa (ham liste boş) filtre çubuğu hiç
  render edilmemelidir.
- **FR-025**: Filtreleme ve arama tamamen istemci tarafında, mevcut
  `GET /api/interviews` yanıtı üzerinde yapılmalıdır; yeni istek atılmamalıdır.
- **FR-026**: Filtre durumu bileşen state'inde tutulur; sayfadan ayrılıp dönüldüğünde
  sıfırlanır (URL senkronizasyonu bu kapsamda **yoktur**).

### Erişilebilirlik Gereksinimleri

- **FR-027**: Her çip satırı `role="group"` ve açıklayıcı `aria-label` taşımalı; çipler
  seçili durumlarını `aria-pressed` ile bildirmelidir.
- **FR-028**: Sonuç sayacı `aria-live="polite"` olmalı, arama kutusu erişilebilir bir
  etikete sahip olmalıdır.

## Kapsam Dışı (Out of Scope)

Bilinçli olarak dışarıda bırakılanlar — gerekirse ayrı issue:

- Backend sorgu parametresi (`?status=&q=`) ve sunucu tarafı arama.
- Soru/cevap içeriğinde tam metin arama.
- Bulanık (fuzzy) arama, yazım hatası toleransı, kelime kökü eşleştirme. Eşleşme
  daima birebir alt dizedir (normalize edildikten sonra).
- URL query senkronizasyonu (`?q=&status=`), paylaşılabilir filtre bağlantısı.
- Klavye kısayolları (`/` ile odaklan, `Esc` ile temizle).
- Sıralama seçici ve tarih aralığı filtresi (liste her zaman `createdAt` DESC).
- Filtre state'inin kalıcılığı (localStorage / oturum).

## Tasarım Kararları

### Neden istemci tarafı?

`GET /api/interviews` kullanıcının tüm görüşmelerini zaten tek istekte döndürür ve
kayıt sayısı kullanıcı başına düşüktür (onlarca mertebesi). Bellekte filtreleme;
sıfır backend değişikliği, sıfır ağ gecikmesi ve debounce ihtiyacı olmaması demektir.
Liste hacmi büyürse doğru yükseltme yolu FR-025'i backend sorgu parametreleriyle
değiştirmektir — bu durumda `contracts/history-api.md` §1 güncellenmelidir.

### Yerleşim

```
┌───────────────────────────────────────────────────────────┐
│ Görüşmelerim                              [ Yeni görüşme ]│
├───────────────────────────────────────────────────────────┤
│ [ Pozisyon veya etiket ara…          x ]  [ Filtreler (2)]│
│ ( Tümü 12 ) ( Tamamlandı 8 ) ( Yarım Kaldı 4 )            │
│ ── açılır panel ──────────────────────────────────────────│
│ Seviye  ( Stajyer 2 )( Junior 7 )( Senior 3 )             │
│ Mod     ( Sözlü 5 )( Yazılı 7 )                           │
├───────────────────────────────────────────────────────────┤
│ 12 görüşmeden 3'ü gösteriliyor          Filtreleri temizle│
│ [kartlar…]                                                │
└───────────────────────────────────────────────────────────┘
```

Arama kutusu ve durum çipleri her zaman görünür (en sık kullanılan iki kontrol);
seviye/mod paneli katlanır durumda başlar ve ekran alanını kart listesine bırakır.
Panel açılışı CSS `grid-template-rows: 0fr → 1fr` geçişiyle animasyonlanır — ek
kütüphane yoktur. Çipler `rounded-full`, seçili durumda `--color-accent-soft` zemin
ve `--color-accent` metin kullanır; bu, projedeki mevcut rozet diline uyar.

### Dosya Sınırları

| Dosya | Sorumluluk |
| --- | --- |
| `frontend/src/lib/interview-filter.ts` | Saf mantık: `applyFilters`, `facetCounts`, `EMPTY_FILTERS`. React bağımlılığı yok, doğrudan birim test edilir. |
| `frontend/src/components/interview/interview-filter-bar.tsx` | Kontrollü sunum bileşeni: arama kutusu + çip satırları + katlanır panel. Kendi filtre state'ini tutmaz. |
| `frontend/src/pages/interview/list.tsx` | Filtre state'i, çubuğun yerleştirilmesi, sonuç sayacı ve iki farklı boş durum. |

## Bağımlılıklar / Entegrasyon Noktaları

- `frontend/src/lib/interview-client.ts` → `InterviewListItem` tipi (değişmez).
- `frontend/src/components/interview/interview-card.tsx` → rozet etiketleri. Arama,
  kartta **görünen** metinlerle aynı sözlüğü kullanmalıdır; etiket sözlükleri bu
  nedenle `interview-filter.ts` içinde tek kaynaktan tanımlanır ve karttaki
  değerlerle birebir aynı tutulur.

## Success Criteria

- **SC-001**: 20 görüşmesi olan bir kullanıcı, aradığı görüşmeyi en fazla iki
  etkileşimde (bir çip veya birkaç harf) listede tek başına bırakabilir.
- **SC-002**: Filtre veya arama değişiminde ağ isteği atılmaz; liste güncellemesi
  algılanabilir gecikme olmadan (< 100 ms) gerçekleşir.
- **SC-003**: Çip sayaçlarının toplamı, o eksende her zaman görünen sonuç kümesiyle
  tutarlıdır; 0 sayaçlı bir çip seçilerek boş sonuç üretilemez.
- **SC-004**: `frontend/test/interview-filter.test.ts` saf filtre mantığını (AND/OR
  birleşimi, arama eşleşmesi, facet sayaçları), `frontend/test/interview-list.test.tsx`
  ise ekran davranışını (çip tıklama, arama, sayaç, iki boş durum) kapsar ve geçer.
