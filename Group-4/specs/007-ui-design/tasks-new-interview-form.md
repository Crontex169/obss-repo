# Tasks: Yeni Görüşme formu — v2.pen "Screen - Yeni Mülakat (İlan Ekle)" portu

**Kaynak tasarım**: `specs/007-ui-design/v2.pen`, node `T8Hdu`.
**Alınan kısım**: yalnızca `hwrnB Body` — `lZhVq Hero` + `Y5MqJs Card - İlan Kaynağı`.
**Alınmayan**: `f2lXMI Sidebar`, `NCLUM Topbar`, sağ kolon. Bunlar `app-shell.tsx`'te zaten var, dokunulmaz.
**Hedef dosya**: `frontend/src/pages/interview/new.tsx` — mevcut form **yeniden yazılmaz**, görsel katmanı uyarlanır. State/submit/validation/i18n mantığı aynen kalır.

## Kararlar

| # | Karar | Gerekçe |
|---|-------|---------|
| K1 | `W4zNP` "Tahmini süre 18 – 22 dk" **portlanmaz**. | İstenen değişiklik. Kodda zaten yok, sadece mockup'ta var. |
| K2 | `IfLoJ` "Tespit edilen pozisyon" chip'i **portlanmaz**. Pozisyon tespiti için istemci tarafı sezgi, ekstra LLM çağrısı, DTO alanı — hiçbiri eklenmez. | İstenen değişiklik. Gerçek pozisyon zaten sunucuda üretiliyor (`backend/src/interview/llm/question-generation.ts`), önizlemeye gerek yok. |
| K3 | `JXVjY` -/+ stepper **portlanmaz**. Mevcut `<input type="number">` korunur, üzerine `font-data tabular-nums` eklenir. | "Elle yazılabilsin + font değişebilir" isteği. `font-data` repoda zaten var (`interview-filter-bar.tsx:50`). |
| K4 | `z650PY` "612 / 8000 karakter" sayacı **portlanmaz**. | Backend'de ilan metni için uzunluk sınırı yok (`create-interview.dto.ts`). Olmayan sınırı UI'da uydurmak yanlış bilgi olur. Sınır eklenirse sayaç da eklenir. |
| K5 | Kaynak sekmeleri (`Q11zS`) ve seviye seçenekleri (`kbWr5`) görsel olarak pill/tab olur ama **altta `<input type="radio">` kalır** (görsel gizli radio + stillenmiş label). | Erişilebilirlik (ok tuşuyla gezinme, grup semantiği) bedava gelir; `interview-form.test.tsx` içindeki `getByRole('radio', …)` sorguları kırılmaz. |
| K6 | Metin/başlık dili repo sözlüğünde kalır ("görüşme", mockup'taki "mülakat" değil). | `interview.json` genelinde "görüşme" kullanılıyor; tek ekranda ayrışmak sırıtır. |

## Görevler

- [ ] **T1 — Kabuk ve genişlik**: `new.tsx` sarmalayıcı `max-w-lg` → `max-w-3xl` (tasarımdaki 760px kart). Hero: mevcut `h1` + `p` korunur, aralık tasarımdaki gibi (`gap` 6 → başlık/alt başlık arası 1). Kart: mevcut `rounded-2xl border … p-6` sınıfları kalır, içi `gap-5`'e çıkar.

- [ ] **T2 — Kart başlığı (`l9SOa Head`)**: kartın en üstüne sol tarafta "İlan kaynağı" + alt satır "Metni yapıştır, PDF yükle ya da ilan bağlantısını ver", sağ tarafta kaynak sekmeleri olacak şekilde `flex items-start justify-between` satırı eklenir. Alt başlık `text-xs text-[var(--color-text-muted)]`.

- [ ] **T3 — Kaynak sekmeleri (`Q11zS`)**: mevcut 3 radio, `bg-[var(--color-bg)]` zeminli `rounded-lg p-0.5` bir kapsayıcı içinde segmentli kontrole dönüşür. Her seçenek: `<label>` + `sr-only` radio + lucide ikon (`FileText` / `FileUp` / `Link2`) + metin. Seçili: `bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm`; seçili değil: `text-[var(--color-text-muted)]`. `focus-visible:ring-2 ring-[var(--color-accent-soft)]` `peer-focus-visible:` ile radio'dan alınır. Etiket metinleri değişmez (`new.sourceText/sourcePdf/sourceUrl`) — testler bu adlara dayanıyor.

- [ ] **T4 — Ayarlar satırı (`oisGl`)**: soru sayısı / görüşme modu / seviye tek bir yatay satıra alınır (`flex flex-wrap gap-6`, dar ekranda alt alta). Her kolon: küçük etiket (`text-xs font-medium text-[var(--color-text-muted)]`) + kontrol.
  - **Soru sayısı**: mevcut `<input type="number" min={5} max={20}>` + `onBlur` clamp **aynen kalır**; sınıfa `w-24 font-data tabular-nums text-center` eklenir (K3). `clampQuestionCount` fonksiyonuna dokunulmaz.
  - **Görüşme modu**: `ModeSelector` içi pill grubuna çevrilir (`mode-selector.tsx`), `isSupported()` kontrolü ve devre dışı sözlü seçeneği **korunur** — desteklenmeyen pill `opacity-40 cursor-not-allowed` + `disabled` radio.
  - **Seviye**: `<select>` → 3 pill'lik radio grubu (Stajyer / Junior / Senior). `initialLevel` ön-doldurma davranışı değişmez.

- [ ] **T5 — Adaptif akış (`gAaUs`)**: checkbox satırı, kart içinde üst çizgili (`border-t border-[var(--color-border)] pt-4`) bir satıra dönüşür: solda başlık "Adaptif soru akışı" + mevcut `InfoTooltip`, altında `text-xs` açıklama (`new.adaptiveTooltip`'in kısa hâli, yeni anahtar `new.adaptiveDesc`), sağda anahtar. Anahtar: `sr-only` checkbox + `peer` ile stillenen `w-10 h-6 rounded-full` yol + `w-4 h-4` topuz — semantik `<input type="checkbox">` korunur.

- [ ] **T6 — Aksiyon satırı (`exniv`)**: "Tahmini süre" notu yok (K1). Buton tam genişlik yerine sağa yaslanır: `BUTTON_CLASS`'tan `w-full` çıkarılıp `ui-styles.ts`'e `BUTTON_BASE` (genişliksiz) + `BUTTON_CLASS = BUTTON_BASE + ' w-full'` ayrımı yapılır — auth formları etkilenmez. Butona `ArrowRight` ikonu eklenir. Hata metni (`error`) butonun solunda/üstünde kalır.

- [ ] **T7 — i18n**: `frontend/src/lib/i18n/locales/{tr,en}/interview.json` içine `new.cardTitle`, `new.cardSubtitle`, `new.adaptiveDesc` eklenir. Mevcut anahtarların **metni değiştirilmez** (testler ve K6).

- [ ] **T8 — Test uyumu**: `frontend/test/interview-form.test.tsx`
  - `getByRole('radio', { name: 'PDF' })` / `'Bağlantı'` → K5 sayesinde geçmeye devam etmeli, doğrula.
  - `getByRole('combobox')` (satır ~172, seviye ön-doldurma testi) → T4 ile select kalktığı için `getByRole('radio', { name: 'Senior' })` + `toBeChecked()` olarak güncellenir.
  - `getByLabelText(/Soru say/)` testleri (satır ~178, ~186) değişmemeli — etiket-input bağı korunur.
  - Yeni test: adaptif anahtarı tıklanınca `checked` değişiyor.

- [ ] **T9 — Doğrulama**: `cd frontend && npm run build && npm run lint && npx vitest run test/interview-form.test.tsx`. Ayrıca açık/koyu temada gözle kontrol (`--color-surface` kart, `--color-bg` segment zemini koyu temada da ayrışmalı).

## Bitti sayma ölçütü

- [ ] "Tahmini süre" ve "Tespit edilen pozisyon" ekranda hiç yok
- [ ] Soru sayısı elle yazılabiliyor, 5–20 dışı değer odak çıkışında kırpılıyor, `font-data tabular-nums` ile render ediliyor
- [ ] Kaynak / mod / seviye seçimleri klavyeyle (Tab + ok tuşları) kullanılabiliyor
- [ ] Sidebar/topbar tasarımdan kopyalanmadı; sayfa `app-shell` içinde duruyor
- [ ] `npm run build`, `npm run lint`, `interview-form.test.tsx` hatasız
