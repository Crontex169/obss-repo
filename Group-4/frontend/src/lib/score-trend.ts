import type { InterviewListItem, Report } from './interview-client'

export interface ScoreTrendPoint {
  createdAt: string
  technicalScore: number
  behavioralScore: number
  generalScore: number
}

// T049 (US5, FR-017) - SAF veri donusumu, fetch YAPMAZ. GET /api/interviews
// (liste) yaniti skorlari icermez (yalnizca ozet alanlar, contracts/interview-api.md
// §2) - cagiran taraf (list.tsx) ilgili kayitlarin detayini (getInterview) once
// cekip skorlari buraya gecirir.
export function computeScoreTrend(
  items: {
    createdAt: string
    report: Pick<Report, 'technicalScore' | 'behavioralScore' | 'generalScore'>
  }[],
): ScoreTrendPoint[] {
  return [...items]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((item) => ({
      createdAt: item.createdAt,
      technicalScore: item.report.technicalScore,
      behavioralScore: item.report.behavioralScore,
      generalScore: item.report.generalScore,
    }))
}

// Ayni pozisyon icin >=2 tamamlanmis+raporlu kayit iceren en genis grubu
// bulur (FR-017 "birden fazla tamamlanmis gorusme bulundugunda"); yoksa null.
export function findTrendCandidates(
  items: InterviewListItem[],
): InterviewListItem[] | null {
  const groups = new Map<string, InterviewListItem[]>()
  for (const item of items) {
    if (item.status !== 'completed' || item.reportStatus !== 'ready' || !item.position) {
      continue
    }
    const group = groups.get(item.position) ?? []
    group.push(item)
    groups.set(item.position, group)
  }

  let best: InterviewListItem[] | null = null
  for (const group of groups.values()) {
    if (group.length >= 2 && (!best || group.length > best.length)) best = group
  }
  return best
}
