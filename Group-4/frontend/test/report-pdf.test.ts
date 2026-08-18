import { describe, it, expect, vi } from 'vitest'
import { jsPDF } from 'jspdf'
import { buildReportPdf, CONTENT_BOTTOM } from '@/lib/report-pdf'
import type { Report } from '@/lib/interview-client'

// FR-016 — PDF yerlesimi GERCEK jsPDF ile dogrulanir; mock'lanmis bir jsPDF
// sayfa tasmasi hatasini yakalayamaz (eski hata tam olarak buydu: sayfa sonunu
// asan metin PDF'e hic cizilmiyor, kullaniciya "yazilar kesik" gorunuyordu).
const base: Report = {
  id: 'rep-1',
  overallImpression: 'Guclu bir performans.',
  strengths: ['Net iletisim'],
  improvementAreas: ['Sistem tasarimi'],
  technicalScore: 78,
  behavioralScore: 85,
  generalScore: 80,
  overallScore: 81,
  additionalNotes: [],
  questionFeedback: [],
  generatedAt: '2026-08-01T00:00:00.000Z',
}

const FOOTER_BASELINE = 297 - 10

describe('buildReportPdf', () => {
  it('sayfaya sigmayan icerik yeni sayfaya taşar, hiçbir metin alt sınırın altına yazılmaz', () => {
    const long: Report = {
      ...base,
      overallImpression: 'Cok uzun bir izlenim metni. '.repeat(40),
      strengths: Array.from(
        { length: 25 },
        (_, i) => `Guclu yon ${i}: ${'ayrinti '.repeat(30)}`,
      ),
      improvementAreas: Array.from({ length: 25 }, (_, i) => `Gelisim alani ${i}`),
      additionalNotes: Array.from({ length: 25 }, (_, i) => `Not ${i}`),
    }
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')

    buildReportPdf(long, 'Backend Gelistirici', [], doc)

    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    // Altbilgi bilerek sayfa dibine yazilir; govde metni taban cizgisini asmaz.
    const bodyBaselines = text.mock.calls
      .map((call) => call[2] as number)
      .filter((y) => y !== FOOTER_BASELINE)
    expect(bodyBaselines.length).toBeGreaterThan(0)
    expect(Math.max(...bodyBaselines)).toBeLessThanOrEqual(CONTENT_BOTTOM)
  })

  it('Türkçe karakterler için gömülü Roboto fontu kullanılır', () => {
    // Yerlesik Helvetica WinAnsi ile sinirli: s/g/I/i PDF'e HIC basilmaz.
    const doc = buildReportPdf(base, 'Yazılım Mühendisi')

    expect(doc.getFontList()).toHaveProperty('Roboto')
    expect(doc.getFont().fontName).toBe('Roboto')
  })

  it('her sayfaya altbilgi ve sayfa numarası eklenir', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')

    buildReportPdf(
      { ...base, strengths: Array.from({ length: 60 }, (_, i) => `Yon ${i}`) },
      null,
      [],
      doc,
    )
    const total = doc.getNumberOfPages()

    for (let page = 1; page <= total; page++) {
      expect(text).toHaveBeenCalledWith(
        `${page}/${total}`,
        expect.any(Number),
        FOOTER_BASELINE,
        expect.anything(),
      )
    }
  })

  it('skor grafiği çizilir (düz metin yığını değil)', () => {
    const doc = new jsPDF()
    const triangle = vi.spyOn(doc, 'triangle')
    const rect = vi.spyOn(doc, 'rect')

    buildReportPdf(base, 'Backend Gelistirici', [], doc)

    // 3 izgara ucgeni + 1 veri ucgeni, baslik seridi + 3 skor barinin dolgusu.
    expect(triangle.mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(rect.mock.calls.length).toBeGreaterThanOrEqual(7)
  })

  // Issue #68 — PDF web ekraniyla AYNI bilgiyi tasir: doğru cevap + açıklama.
  it('#68: soru bazlı geri bildirim doğru cevap ve açıklamayla basılır', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')

    buildReportPdf(
      {
        ...base,
        questionFeedback: [
          {
            order: 1,
            verdict: 'yetersiz',
            correctAnswer: 'Baglanti elemanlari',
            explanation: 'Guvenlik kontrolu once yapilir.',
          },
        ],
      },
      'Santiye Sefi',
      [
        {
          order: 1,
          type: 'multiple_choice',
          text: 'Iskele kurulumunda ilk kontrol nedir?',
          options: ['Baglanti elemanlari', 'Malzeme sayimi'],
          tip: null,
          rationale: null,
          answer: { content: 'Malzeme sayimi', answeredAt: '2026-08-01T00:00:00.000Z' },
        },
      ],
      doc,
    )

    const printed = text.mock.calls.map((call) => String(call[0])).join('\n')
    expect(printed).toContain('Soru Bazlı Geri Bildirim')
    expect(printed).toContain('Iskele kurulumunda ilk kontrol nedir?')
    expect(printed).toContain('Yetersiz')
    expect(printed).toContain('Doğru cevap: Baglanti elemanlari')
    expect(printed).toContain('Guvenlik kontrolu once yapilir.')
  })

  it('#68: geri bildirim yoksa bölüm hiç basılmaz (eski raporlar)', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')

    buildReportPdf(base, null, [], doc)

    const printed = text.mock.calls.map((call) => String(call[0])).join('\n')
    expect(printed).not.toContain('Soru Bazlı Geri Bildirim')
  })
})
