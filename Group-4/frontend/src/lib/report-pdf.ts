import { jsPDF } from 'jspdf'
import type { AnsweredPair, Report, Verdict } from '@/lib/interview-client'
import { ROBOTO_BOLD_BASE64, ROBOTO_REGULAR_BASE64 } from '@/lib/pdf-font-roboto'

// T048 (US5, FR-016) — istemci tarafinda PDF uretimi (research-pdf-karar.md:
// jspdf tek basina, html2canvas YOK), yeni backend uc noktasi gerektirmez.
//
// Bu modul PDF'i KURAR ve dondurur; indirme (doc.save) cagirana aittir — boylece
// yerlesim testte gercek jsPDF ile dogrulanabilir (jsdom'da indirme tetiklemeden).
//
// Iki bilinen kusur burada giderildi:
//  1) Sayfa tasmasi — eski addSection y'yi sinirsiz artiriyordu, sayfa sonunu
//     asan metin PDF'e hic cizilmiyordu (kullaniciya "yazilar kesik" olarak
//     gorunen sorun). Artik HER satir icin yer kontrolu yapilir, gerekirse
//     yeni sayfa acilir.
//  2) Turkce karakterler — jsPDF'in yerlesik fontlari WinAnsi ile sinirli
//     oldugu icin s/g/I/i basilmiyordu; gomulu Roboto ile cozuldu.

// A4 (mm). Ust/alt kenar boslugu altbilgiye yer birakir.
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_X = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2
const CONTENT_TOP = 20
/** Metnin inebilecegi en alt taban cizgisi; altinda altbilgi seridi var. */
export const CONTENT_BOTTOM = PAGE_HEIGHT - 20

const ACCENT: [number, number, number] = [36, 87, 229] // --color-accent
const ACCENT_SOFT: [number, number, number] = [174, 191, 247]
const TEXT: [number, number, number] = [16, 24, 40] // --color-text
const TEXT_MUTED: [number, number, number] = [100, 116, 139] // --color-text-muted
const TRACK: [number, number, number] = [226, 232, 240]

const FONT = 'Roboto'

// `doc` yalnizca test icin disaridan verilir (jsPDF metodlari ORNEK uzerinde
// tanimli, prototipte degil — casuslamanin tek yolu hazir bir ornek gecmek).
export function buildReportPdf(
  report: Report,
  position: string | null,
  pairs: AnsweredPair[] = [],
  doc: jsPDF = new jsPDF(),
): jsPDF {
  registerFont(doc)

  drawHeaderBand(doc, report, position)

  let y = 46
  y = drawScoreVisuals(doc, report, y)

  y = addSection(doc, 'Genel İzlenim', [report.overallImpression], y)
  y = addSection(doc, 'Güçlü Yönler', report.strengths, y)
  y = addSection(doc, 'Geliştirilmesi Gereken Alanlar', report.improvementAreas, y)
  if (report.additionalNotes.length > 0) {
    y = addSection(doc, 'Ek Notlar', report.additionalNotes, y)
  }
  y = addQuestionFeedback(doc, report, pairs, y)

  drawFooters(doc, report)
  return doc
}

// Issue #68 — soru bazli geri bildirim. Ekrandakiyle AYNI bilgi, ama PDF'te
// katlanacak panel yok: her sey acik yazilir. Rapor bolumlerinin ARDINDAN
// gelir; ozet once okunur, soru dokumu referans olarak arkada durur.
const VERDICT_LABEL: Record<Verdict, string> = {
  dogru: 'Doğru',
  kismen: 'Kısmen',
  yetersiz: 'Yetersiz',
}

function addQuestionFeedback(
  doc: jsPDF,
  report: Report,
  pairs: AnsweredPair[],
  y: number,
): number {
  // Bu alan eklenmeden once uretilmis raporlarda bos — bolum HIC basilmaz.
  // Opsiyonel zincir bilerek: PDF indirme yolu, alani hic tanimayan bir
  // sunucu yanitinda da patlamamali.
  if (!report.questionFeedback?.length) return y

  const byOrder = new Map(pairs.map((p) => [p.order, p]))
  const lines: string[] = []
  for (const item of [...report.questionFeedback].sort(
    (a, b) => a.order - b.order,
  )) {
    const pair = byOrder.get(item.order)
    // Soru metni cifte bagli; cift gelmediyse yalnizca numarayla yaziriz —
    // "acikllama var ama neye ait belli degil" durumundan iyidir.
    lines.push(
      `${item.order}. ${pair?.text ?? ''} [${VERDICT_LABEL[item.verdict]}]`,
    )
    if (pair) lines.push(`   Senin cevabın: ${pair.answer.content}`)
    lines.push(
      `   ${pair?.type === 'multiple_choice' ? 'Doğru cevap' : 'Beklenen cevap'}: ${item.correctAnswer}`,
    )
    lines.push(`   Açıklama: ${item.explanation}`)
  }

  return addSection(doc, 'Soru Bazlı Geri Bildirim', lines, y, { bullets: false })
}

function registerFont(doc: jsPDF) {
  doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64)
  doc.addFont('Roboto-Regular.ttf', FONT, 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64)
  doc.addFont('Roboto-Bold.ttf', FONT, 'bold')
  doc.setFont(FONT, 'normal')
}

// Marka rengi serit: baslik + pozisyon solda, genel puan sagda.
function drawHeaderBand(doc: jsPDF, report: Report, position: string | null) {
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, PAGE_WIDTH, 36, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(19)
  doc.text('Değerlendirme Raporu', MARGIN_X, 16)

  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.text(position ?? 'Belirsiz pozisyon', MARGIN_X, 24)
  doc.text(
    `Oluşturulma: ${new Date(report.generatedAt).toLocaleDateString('tr-TR')}`,
    MARGIN_X,
    30,
  )

  doc.setFontSize(9)
  doc.text('ORTALAMA SKOR', PAGE_WIDTH - MARGIN_X, 16, { align: 'right' })
  doc.setFont(FONT, 'bold')
  doc.setFontSize(22)
  doc.text(`${report.overallScore}/100`, PAGE_WIDTH - MARGIN_X, 26, { align: 'right' })
}

// Ekrandaki Recharts radar + skor metinleri ile ayni bilgi: solda 3 eksenli
// radar, sagda bar'lar. Grafik TEK bilgi kaynagi DEGIL — skorlar bar'larin
// yaninda sayi olarak da yazilir (Ilke VII, ADR-0011 / R2).
function drawScoreVisuals(doc: jsPDF, report: Report, top: number): number {
  const axes: [string, number][] = [
    ['Teknik', report.technicalScore],
    ['Davranışsal', report.behavioralScore],
    ['Genel Yetkinlik', report.generalScore],
  ]

  drawRadar(doc, axes, 52, top + 30, 22)

  let y = top + 12
  const barX = MARGIN_X + 82
  const barWidth = PAGE_WIDTH - MARGIN_X - barX
  for (const [label, score] of axes) {
    doc.setFont(FONT, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)
    doc.text(label, barX, y)
    doc.setFont(FONT, 'bold')
    doc.text(`${score}/100`, PAGE_WIDTH - MARGIN_X, y, { align: 'right' })

    doc.setFillColor(...TRACK)
    doc.rect(barX, y + 2, barWidth, 3.5, 'F')
    doc.setFillColor(...ACCENT)
    doc.rect(barX, y + 2, (barWidth * clamp(score)) / 100, 3.5, 'F')
    y += 14
  }

  return Math.max(y, top + 60)
}

// 3 eksenli radar: izgara ucgenleri + eksen cizgileri + veri ucgeni.
// Vektorel cizilir (canvas/rasterlestirme YOK) — her olcekte net kalir.
function drawRadar(
  doc: jsPDF,
  axes: [string, number][],
  cx: number,
  cy: number,
  radius: number,
) {
  const point = (index: number, r: number): [number, number] => {
    const angle = ((-90 + index * 120) * Math.PI) / 180
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)]
  }

  doc.setDrawColor(...TRACK)
  doc.setLineWidth(0.2)
  for (const ratio of [0.33, 0.66, 1]) {
    const [a, b, c] = [0, 1, 2].map((i) => point(i, radius * ratio))
    doc.triangle(a[0], a[1], b[0], b[1], c[0], c[1], 'S')
  }
  for (let i = 0; i < 3; i++) {
    const [x, y] = point(i, radius)
    doc.line(cx, cy, x, y)
  }

  const [p0, p1, p2] = axes.map(([, score], i) => point(i, (radius * clamp(score)) / 100))
  doc.setFillColor(...ACCENT_SOFT)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.5)
  doc.triangle(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], 'FD')

  doc.setFont(FONT, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TEXT_MUTED)
  const aligns = ['center', 'left', 'right'] as const
  axes.forEach(([label], i) => {
    const [x, y] = point(i, radius + 5)
    doc.text(label, x, i === 0 ? y : y + 1.5, { align: aligns[i] })
  })
}

// Bolum basligi + madde listesi. Basligin yalniz kalmasi (sayfa sonunda baslik,
// sonraki sayfada icerik) engellenir: baslik icin baslik+ilk satir kadar yer aranir.
function addSection(
  doc: jsPDF,
  title: string,
  lines: string[],
  y: number,
  // Soru bazli geri bildirim (#68) madde isareti KULLANMAZ: satirlari zaten
  // "1." / "   Aciklama:" gibi kendi hiyerarsisini tasiyor.
  { bullets = true }: { bullets?: boolean } = {},
): number {
  y = ensureSpace(doc, y, 14)

  doc.setFont(FONT, 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...ACCENT)
  doc.text(title, MARGIN_X, y)
  doc.setDrawColor(...TRACK)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_X, y + 1.5, PAGE_WIDTH - MARGIN_X, y + 1.5)
  y += 8

  doc.setFont(FONT, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT)
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(
      bullets ? `• ${line}` : line,
      CONTENT_WIDTH - 2,
    ) as string[]
    // Satir satir yazilir: uzun bir madde sayfa sonunu asarsa ORTASINDAN
    // bolunup sonraki sayfadan devam eder, kesilmez.
    for (const part of wrapped) {
      y = ensureSpace(doc, y, 5)
      doc.text(part, MARGIN_X + 2, y)
      y += 5
    }
    y += 1.5
  }

  return y + 6
}

/** Istenen yukseklik sayfaya sigmiyorsa yeni sayfa acar ve ust kenardan devam eder. */
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > CONTENT_BOTTOM) {
    doc.addPage()
    return CONTENT_TOP
  }
  return y
}

function drawFooters(doc: jsPDF, report: Report) {
  const total = doc.getNumberOfPages()
  for (let page = 1; page <= total; page++) {
    doc.setPage(page)
    doc.setFont(FONT, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...TEXT_MUTED)
    doc.text(
      'Yapay zeka tarafından üretilmiştir.',
      MARGIN_X,
      PAGE_HEIGHT - 10,
    )
    doc.text(`${page}/${total}`, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 10, {
      align: 'right',
    })
  }
  doc.setProperties({ title: `Görüşme raporu ${report.id}` })
}

function clamp(score: number) {
  return Math.min(100, Math.max(0, score))
}
