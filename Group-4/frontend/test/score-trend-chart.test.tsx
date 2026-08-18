import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreTrendChart } from '@/components/interview/score-trend-chart'
import { computeScoreTrend, findTrendCandidates } from '@/lib/score-trend'
import type { InterviewListItem } from '@/lib/interview-client'

// T046/T049 (004-history US5, FR-017): ayni pozisyon icin >=2 tamamlanmis+
// raporlu kayit varken skor trendi dogru veri noktalarini cizer.
describe('computeScoreTrend + findTrendCandidates', () => {
  const baseItem: InterviewListItem = {
    id: 'iv-1',
    position: 'Backend Gelistirici',
    status: 'completed',
    reportStatus: 'ready',
    mode: 'written',
    level: 'junior',
    language: 'tr',
    questionCount: 3,
    createdAt: '2026-07-01T00:00:00.000Z',
    completedAt: '2026-07-01T01:00:00.000Z',
  }

  it('ayni pozisyonda >=2 tamamlanmis+raporlu kayit varsa aday olarak doner', () => {
    const items: InterviewListItem[] = [
      { ...baseItem, id: 'iv-1' },
      { ...baseItem, id: 'iv-2', createdAt: '2026-08-01T00:00:00.000Z' },
      { ...baseItem, id: 'iv-3', position: 'Frontend Gelistirici' },
    ]

    const candidates = findTrendCandidates(items)
    expect(candidates?.map((c) => c.id)).toEqual(['iv-1', 'iv-2'])
  })

  it('tek kayit/pozisyon eslesmesi yoksa null doner', () => {
    const items: InterviewListItem[] = [
      { ...baseItem, id: 'iv-1' },
      { ...baseItem, id: 'iv-2', position: 'Frontend Gelistirici' },
      { ...baseItem, id: 'iv-3', status: 'in_progress', reportStatus: 'not_applicable' },
    ]

    expect(findTrendCandidates(items)).toBeNull()
  })

  it('tarihe gore artan sirada skor noktalari uretir', () => {
    const points = computeScoreTrend([
      {
        createdAt: '2026-08-01T00:00:00.000Z',
        report: { technicalScore: 90, behavioralScore: 80, generalScore: 85 },
      },
      {
        createdAt: '2026-07-01T00:00:00.000Z',
        report: { technicalScore: 60, behavioralScore: 65, generalScore: 62 },
      },
    ])

    expect(points.map((p) => p.technicalScore)).toEqual([60, 90])
  })
})

describe('ScoreTrendChart', () => {
  it('gosterge (legend) etiketlerini render eder', () => {
    render(
      <ScoreTrendChart
        points={[
          { createdAt: '2026-07-01T00:00:00.000Z', technicalScore: 60, behavioralScore: 65, generalScore: 62 },
          { createdAt: '2026-08-01T00:00:00.000Z', technicalScore: 90, behavioralScore: 80, generalScore: 85 },
        ]}
      />,
    )

    expect(screen.getByText('Skor Trendi (aynı pozisyon)')).toBeInTheDocument()
    expect(screen.getByText('Teknik')).toBeInTheDocument()
    expect(screen.getByText('Davranışsal')).toBeInTheDocument()
    expect(screen.getByText('Genel Yetkinlik')).toBeInTheDocument()
  })
})
