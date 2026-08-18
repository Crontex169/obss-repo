# T044 — PDF Kütüphane Kararı (US5, FR-016)

**Dilim**: `004-history` | **Tarih**: 2026-08-03

## Karar

**`jspdf`** (tek başına, `html2canvas` veya `react-to-print` **olmadan**).

## Seçenekler

| Seçenek | Değerlendirme |
|---|---|
| `jspdf` (metin/tablo API'si) | Rapor içeriği (skorlar + metinsel geri bildirim) zaten yapılandırılmış veri; DOM'u piksel piksel görüntüye çevirmeye gerek yok. En küçük bundle, en az bağımlılık (`html2canvas` gerektirmez), test edilebilir (DOM/canvas render'a bağımlı değil). |
| `jspdf` + `html2canvas` | Ekranı olduğu gibi (radar grafik dahil) görüntü olarak yakalar; daha büyük bundle, font/CORS sorunlarına açık, jsdom'da test edilemez (canvas gerektirir). |
| `react-to-print` | Tarayıcının kendi yazdırma diyaloğunu kullanır — kullanıcı "PDF olarak kaydet"i **kendi** seçmeli, tek tıkla dosya indirme garantisi yok (FR-016 "dışa aktarılmasına izin vermelidir" ifadesiyle daha az uyumlu). |

## Gerekçe

- Mimari etki **yok**: istemci tarafı üretim, yeni backend uç noktası/tablo gerektirmez (research.md §6, plan.md Karmaşıklık Takibi ile tutarlı).
- Rapor verisi (`Report` — skorlar + `overallImpression`/`strengths`/`improvementAreas`) zaten yapılandırılmış metin; `jspdf`'in `text()`/`splitTextToSize()` API'si bunu doğrudan biçimlendirebilir. Grafik, ekran görüntüsü olarak **gömülmez**; skorlar zaten metin olarak da gösterilir (ADR-0011/R2: grafik tek bilgi kaynağı değil).
- `html2canvas` eklenmesi bundle boyutunu ve font-yükleme karmaşıklığını artırır, test edilebilirliği düşürür (canvas API'si jsdom'da yok) — FR-016'nın gerektirmediği bir maliyet.

## Sonuç

Yeni bağımlılık: `jspdf` (tek). `docs/DECISIONS.md`'ye ayrı bir ADR açılmadı — bu, kilitli
teknoloji yığınını (ADR-0001…0011) etkilemeyen, tek dilime özgü, düşük riskli bir
kütüphane seçimidir (plan.md "Karmaşıklık kapıları" ile aynı gerekçe: PDF kütüphane
seçimi tasks/implement fazına bırakılmıştı, bu belge o kararı kapatır).
`docs/TECH_STACK.md` Frontend tablosuna satır olarak işlendi.

## Uygulama sonrası ek (2026-08-04)

Karar korundu — `html2canvas` **eklenmedi**. Ancak PDF'e görsel eklenmemesi kararı
implementasyonda daraltıldı: `frontend/src/lib/report-pdf.ts` skor çubuklarını ve
üç eksenli radar grafiğini **jsPDF'in kendi vektör primitifleriyle** (`line`,
`circle`, `triangle`) çiziyor (`drawScoreVisuals`, `drawRadar`). Bu, kararın
belirleyici eksenini (DOM/canvas'a bağımlı olmama, jsdom'da test edilebilirlik)
bozmaz — `frontend/test/report-pdf.test.ts` canvas olmadan koşar. Ayrıca Türkçe
karakterler için Roboto fontu gömüldü (`pdf-font-roboto.ts`); jsPDF'in yerleşik
standart fontları Latin-5'i doğru render etmiyordu.
