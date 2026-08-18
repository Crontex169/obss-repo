---
name: Mock Interview
description: AI destekli deneme mülakatı — kurumsal güven + terminal netliğinde skor verisi
colors:
  bg: "#f8fafc"
  bg-muted: "#f3f4f6"
  surface: "#ffffff"
  border: "#e5e7eb"
  bg-dark: "#0b1220"
  surface-dark: "#121b30"
  border-dark: "#26314d"
  text: "#111827"
  text-muted: "#6b7280"
  text-inverse: "#f4f6fb"
  text-muted-inverse: "#94a1c2"
  accent: "#00a3e0"
  accent-strong: "#0077a3"
  accent-soft: "#e6f6fd"
  admin-accent: "#0e7490"
  admin-accent-strong: "#155e75"
  admin-accent-soft: "#e0f2fe"
  success: "#16a34a"
  success-soft: "#eafaf0"
  danger: "#dc2626"
  danger-soft: "#fdecec"
  warning: "#d97706"
  warning-soft: "#fef3e0"
typography:
  display:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, system-ui, Segoe UI, sans-serif"
    fontWeight: 400
  data:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontWeight: 500
    letterSpacing: "-0.02em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.accent-strong}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
---

# Design System: Mock Interview

## Overview

**Creative North Star: "Kurumsal Terminal"**

OBSS'in beyaz zemin + güvenilir mavi kurumsal kimliği ile getdevinterview.com
referansındaki koyu, net "premium SaaS" enerjisinin birleşimi. Sistem iki
kayıtlı yüzeye ayrılır: **fonksiyonel ekranlar** (form, liste, oturum, rapor)
aydınlık ve pratik zeminde çalışır; **hero/karşılama** alanları koyu lacivert
zeminde ürünü "canlı veri" olarak sergiler. İmza öğe: skorlar, sayaçlar ve
tarihler JetBrains Mono ile — süs değil, "geliştirici mülakatı" ürününe özgü
bir referans, aday okuduğunda bir terminal çıktısı gibi güvenilir hissetmeli.

Admin paneli aynı yerleşimi paylaşır ama ayırt edici camgöbeği/açık mavi
vurgu rengi taşır — kullanıcı panelinin OBSS lacivert mavisiyle karışmaması
kasıtlı bir karar (bkz. Colors → Named Rules).

**Key Characteristics:**
- Aydınlık işlevsel zemin + koyu hero zemin ikiliği (tek sistem, iki mod)
- Tek imza vurgu rengi (`accent`), admin'de ayrı ikinci vurgu (`admin-accent`)
- Veri (skor/süre/sayaç) her zaman `font-data` (JetBrains Mono, tabular)
- Düz, hafif gölgeli kartlar — dramatik elevasyon yok

## Colors

Tek imza vurgu (OBSS mavisi) + fonksiyonel nötrler; hero'da koyu lacivert
zemin üstünde aynı vurgu daha parlak versiyonuyla çalışır.

### Primary
- **OBSS Mavisi** (`#00a3e0`, `accent`): ince bağlantılar, aktif nav durumu,
  hero CTA dolgusu, imleç/odak halkası rengi.
- **Koyu OBSS Mavisi** (`#0077a3`, `accent-strong`): beyaz metinli buton
  dolgusu. `accent` üzerinde beyaz kontrast 2.87:1 — WCAG AA'nin (4.5:1)
  altında kalıyor; `accent-strong` 5.03:1 ile geçiyor. Bu yüzden dolgulu
  butonlar her zaman `accent-strong`, ince çizgi/link'ler `accent` kullanır.

### Secondary
- **Admin Camgöbeği** (`#0e7490`, `admin-accent` / `#155e75`
  `admin-accent-strong`): yalnızca admin panelinde, aynı yerleşimle kullanıcı
  panelinden görsel olarak ayrışmak için.

### Neutral
- **Ekran Zemini** (`#f8fafc`, `bg`): fonksiyonel ekranların ve input
  kutularının zemini.
- **Kart Zemini** (`#ffffff`, `surface`): kartlar, header.
- **Çizgi** (`#e5e7eb`, `border`): kart/header ayraçları.
- **Koyu Zemin** (`#0b1220`, `bg-dark` / `#121b30` `surface-dark` /
  `#26314d` `border-dark`): yalnızca hero/karşılama.
- **Metin** (`#111827` `text` / `#6b7280` `text-muted`): aydınlık zeminde.
- **Ters Metin** (`#f4f6fb` `text-inverse` / `#94a1c2`
  `text-muted-inverse`): koyu zeminde.

### Durum Renkleri
- **Başarı** (`#16a34a` / zemin `#eafaf0`), **Tehlike** (`#dc2626` / zemin
  `#fdecec`), **Uyarı** (`#d97706` / zemin `#fef3e0`) — rozet ve skor
  durumlarında.

### Named Rules
**The AA-Contrast Fill Rule.** Beyaz metinli dolgu butonlarda her zaman
`accent-strong` kullanılır, `accent` değil — `accent` yalnızca ince
çizgi/bağlantı/aktif-durum arka planında (kendi metniyle birlikte) geçerlidir.
**The Admin-Is-Different Rule.** Admin ekranları kullanıcı ekranlarıyla aynı
bileşenleri ve yerleşimi kullanır ama asla `accent`/`accent-strong`
kullanmaz — her zaman `admin-accent` ailesi.

## Typography

**Display Font:** Manrope (with system-ui, sans-serif) — başlıklar (`h1-h4`)
**Body Font:** Inter (with system-ui, Segoe UI, sans-serif) — gövde metni
**Data/Mono Font:** JetBrains Mono (with ui-monospace, SFMono-Regular, Menlo)

**Character:** Manrope başlıklarda güçlü/kurumsal ağırlık (800, negatif
letter-spacing) verir; Inter gövdede sakin okunabilirlik sağlar; JetBrains
Mono skor/sayaç/tarih gibi her veri noktasını "ölçülmüş, doğrulanabilir"
hissettirir (tabular-nums + hafif negatif spacing).

### Hierarchy
- **Display** (800, `text-4xl`–`text-5xl`, `leading-[1.08]`): hero başlığı.
- **Headline/Title** (Manrope, `font-display`, negatif spacing): sayfa/kart
  başlıkları (`h1-h4` otomatik).
- **Body** (Inter, 400, `text-sm`/`text-base`): form, açıklama, gövde metni.
- **Label** (Inter, 500-600, `text-xs`, çoğu zaman `uppercase` +
  `tracking-[0.16em]`): eyebrow/etiketler (ör. hero'daki `$ yapay_zeka...`).
- **Data** (JetBrains Mono, 500-600, `tabular-nums`, `-0.02em`): skorlar,
  süre sayaçları, tarihler, ID'ler — asla Inter/Manrope ile yazılmaz.

### Named Rules
**The Mono-For-Measurement Rule.** Herhangi bir ölçülebilir/sayısal veri
(skor, süre, sayaç, tarih) `font-data` sınıfıyla render edilir; düz metin
asla mono kullanmaz.

## Layout

Tek sütunlu, ortalanmış `max-w-5xl` konteyner (hero ve app-shell ortak).
Fonksiyonel ekranlarda üstte sticky, yarı saydam+blur header (`bg-surface/90
backdrop-blur`, `border-b`); içerik `px-6 py-8`. Hero geniş grid
(`lg:grid-cols-[1.1fr_0.9fr]`) ile metin + "skor kartı" önizlemesini yan yana
verir, mobilde tek sütuna düşer. Boşluk ritmi Tailwind'in `gap-3/4/6/8/12`
adımlarını kullanır; yoğunluk düşük-orta (nefes alan kart içi `px-6 py-6`).

## Elevation & Depth

Sistem büyük ölçüde **düz**: kartlar `shadow-sm` (hafif, ambient) kullanır,
dramatik elevasyon yok. Tek istisna hero'daki skor kartı önizlemesi —
`shadow-[0_20px_60px_-20px_rgba(36,87,229,0.35)]` ile markanın mavisini taşıyan
yumuşak bir "spot ışığı" gölgesi; bu, ürünün en önemli tekil kanıt-parçasını
(rapor önizlemesi) öne çıkarmak için kasıtlı tek bir vurgu, genel kural değil.

### Named Rules
**The Flat-By-Default Rule.** Kartlar rest halinde `shadow-sm`'i geçmez;
daha güçlü gölge yalnızca hero'nun imza skor kartı gibi tek, kasıtlı vitrin
anlarında kullanılır.

## Shapes

Köşeler orta-yumuşak: butonlar/inputlar `rounded-md`/`rounded-lg` (6-8px),
kartlar `rounded-xl` (12px), hero skor kartı `rounded-2xl` (16px), rozet/pill
öğeler `rounded-full`. Kenarlık her zaman ince tek çizgi (`border`,
1px, `border-*` token'ı) — çift çizgi veya kalın kenarlık yok.

## Components

### Buttons
- **Shape:** `rounded-md` (varsayılan shadcn boyutları), form CTA'ları
  `rounded-lg`.
- **Primary:** dolgu `accent-strong`, metin beyaz, `hover:brightness-90`
  (form CTA'ları) veya shadcn `hover:bg-primary/90` (uygulama içi).
- **Hover/Focus:** `transition-[filter]`/`transition-colors`; odakta
  `outline: 2px solid accent` + `outline-offset: 2px` (global `:focus-visible`).
- **Ghost/Outline/Secondary:** shadcn varyantları (`variant="outline"` vb.)
  değişmeden kullanılır; nav linkleri aktifken `accent-soft` zemin + `accent`
  metin.

### Cards / Containers
- **Corner Style:** `rounded-xl` (12px).
- **Background:** `surface` (beyaz) aydınlık ekranlarda, `surface-dark`
  hero'da.
- **Shadow Strategy:** bkz. Elevation & Depth — `shadow-sm` varsayılan.
- **Border:** ince `border` (aydınlık) / `border-dark` (koyu).
- **Internal Padding:** `py-6`/`px-6` (shadcn Card varsayılanı).

### Inputs / Fields
- **Style:** `rounded-lg`, `border border-border`, zemin `bg` (ekran zeminiyle
  aynı — inputlar zeminden "oyulmuş" gibi görünür, kart üstünde değil).
- **Focus:** `border-accent` + `ring-2 ring-accent-soft`.
- **Disabled:** `disabled:cursor-not-allowed disabled:opacity-50`.

### Navigation
- Üst, sticky, yarı saydam+blur header; sol logo, orta nav linkleri
  (`rounded-md px-3 py-1.5`, aktifte `accent-soft` zemin), sağda kullanıcı
  aksiyonu (çıkış). Sidebar yok — tüm gezinme üst navbar'da. Hero'da aynı
  desen ama koyu zeminde ve nav linkleri ters metin renginde.

### Rozet/Durum Etiketleri (signature component)
Skor/durum rozetleri her zaman renk çifti olarak gelir (`success`/
`success-soft`, `danger`/`danger-soft`, `warning`/`warning-soft`): koyu metin
renginin açık tonundaki zemin üzerinde, `rounded-full px-2 py-0.5 text-xs`.
Skor sayıları rozetin yanında değil, ayrı `font-data` hücrelerinde gösterilir.

## Do's and Don'ts

### Do:
- **Do** dolgu butonlarda `accent-strong` kullan (AA kontrast); ince
  çizgi/link'lerde `accent`.
- **Do** her ölçülebilir veriyi (skor, süre, tarih, sayaç) `font-data`
  (JetBrains Mono, tabular) ile yaz.
- **Do** admin ekranlarında `admin-accent` ailesini kullan, kullanıcı
  ekranındaki `accent` ailesini asla admin'e taşıma.
- **Do** kartları `rounded-xl` + `shadow-sm` ile düz tut; güçlü gölgeyi
  yalnızca hero'nun imza skor kartı gibi tek vitrin anına sakla.

### Don't:
- **Don't** koyu hero zeminini (`bg-dark`/`surface-dark`) fonksiyonel
  form/liste/rapor ekranlarına taşıma — bu ikilik kasıtlı ve sabit.
- **Don't** `accent` (açık mavi) rengini beyaz metinle dolgulu bir yüzeyde
  kullanma — AA kontrastı geçmiyor, her zaman `accent-strong`.
- **Don't** yeni bir ikinci grafik/görselleştirme kütüphanesi ekleme;
  sistem Recharts (shadcn `Chart`) üzerine kilitli (ADR-0011).
