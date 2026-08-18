// specs/005-admin/contracts/admin-api.md — /api/admin/* salt-okunur uc noktalari.
// interview-client.ts ile ayni desen: cookie tabanli oturum -> credentials:'include',
// ek bir veri getirme kutuphanesi (React Query/SWR) YOK.
import { ApiError, type ApiErrorBody } from '@/lib/interview-client'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

/** contracts/admin-api.md §1 — position filtresinin "Belirsiz" kovasi degeri. */
export const UNSPECIFIED_POSITION = 'unspecified'

export interface AdminInterviewListItem {
  id: string
  ownerEmail: string
  position: string | null
  positionLabel: string
  status: 'in_progress' | 'completed'
  createdAt: string
  completedAt: string | null
  deletedAt: string | null
}

export interface AdminInterviewListResponse {
  items: AdminInterviewListItem[]
  total: number
  page: number
  pageSize: number
}

export interface AdminQuestionWithAnswer {
  order: number
  type: 'multiple_choice' | 'open_ended'
  text: string
  options: string[]
  answer: string | null
}

export interface AdminQuestionFeedback {
  /** AdminQuestionWithAnswer.order ile eslesir. */
  order: number
  verdict: 'dogru' | 'kismen' | 'yetersiz'
  correctAnswer: string
  explanation: string
}

export interface AdminReport {
  overallImpression: string
  strengths: string[]
  improvementAreas: string[]
  additionalNotes: string[]
  technicalScore: number
  behavioralScore: number
  generalScore: number
  /** #76 — kullanicinin raporundakiyle ayni icerik (FR-005 "eksiksiz"). */
  questionFeedback: AdminQuestionFeedback[]
}

export interface AdminTokenUsageSummary {
  totalTokens: number
  estimatedCostUsd: string
}

export interface AdminInterviewDetail {
  id: string
  ownerEmail: string
  position: string | null
  positionLabel: string
  status: 'in_progress' | 'completed'
  mode: 'written' | 'voice'
  level: 'intern' | 'junior' | 'mid' | 'senior'
  language: 'tr' | 'en'
  createdAt: string
  completedAt: string | null
  deletedAt: string | null
  questions: AdminQuestionWithAnswer[]
  reportStatus: 'not_applicable' | 'pending' | 'ready' | 'failed'
  report: AdminReport | null
  tokenUsage: AdminTokenUsageSummary | null
}

export interface AdminStatsResponse {
  countsByProfession: Array<{
    position: string | null
    label: string
    count: number
  }>
  averageDurationSeconds: number | null
  completionRatio: { completed: number; inProgress: number }
  dailyTokenUsage: Array<{
    date: string
    totalTokens: number
    /** O gunun tahmini maliyeti (USD) — string, para kaybi olmamasi icin. */
    estimatedCostUsd: string
  }>
  /** Penceredeki tum gunlerin tahmini maliyet toplami (USD). */
  totalCostUsd: string
}

export interface AdminProblemReport {
  id: string
  interviewId: string
  ownerEmail: string
  position: string | null
  positionLabel: string
  message: string
  createdAt: string
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json()
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody)
  return body as T
}

export async function listInterviews(params: {
  position?: string
  page?: number
  pageSize?: number
} = {}) {
  const query = new URLSearchParams()
  if (params.position) query.set('position', params.position)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))

  const suffix = query.toString() ? `?${query}` : ''
  const res = await fetch(`${API_URL}/api/admin/interviews${suffix}`, {
    credentials: 'include',
  })
  return parse<AdminInterviewListResponse>(res)
}

export async function getInterview(id: string) {
  const res = await fetch(`${API_URL}/api/admin/interviews/${id}`, {
    credentials: 'include',
  })
  return parse<AdminInterviewDetail>(res)
}

export async function getStats(params: { tokenWindowDays?: number } = {}) {
  const suffix = params.tokenWindowDays
    ? `?tokenWindowDays=${params.tokenWindowDays}`
    : ''
  const res = await fetch(`${API_URL}/api/admin/stats${suffix}`, {
    credentials: 'include',
  })
  return parse<AdminStatsResponse>(res)
}

export async function listProblemReports() {
  const res = await fetch(`${API_URL}/api/admin/interviews/problem-reports`, {
    credentials: 'include',
  })
  return parse<AdminProblemReport[]>(res)
}
