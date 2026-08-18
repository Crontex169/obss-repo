// contracts/pre-assessment-api.md — POST/GET /api/pre-assessments.
// interview-client.ts deseniyle ayni: TanStack Query KULLANILMAZ (devralma-dogrulama.md
// T003 karari) - duz fetch sarmalayicisi, cookie tabanli oturum (credentials: 'include').
//
// 2026-08-04: girdi MESLEK-BAGIMSIZ hale getirildi (spec FR-002) — `interestAreas`,
// `experienceLevel` ve `skillSelections` alanlari kaldirildi.
import i18n from '@/lib/i18n'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export type ExperienceYears = 'none' | 'lt1' | 'y1_3' | 'y3_5' | 'y5_10' | 'y10plus'
export type WorkStatus = 'employed_full' | 'employed_part' | 'seeking' | 'student'
export type EducationLevel =
  | 'primary' | 'secondary' | 'high_school' | 'vocational'
  | 'associate' | 'bachelor' | 'graduate'
export type WorkPreference =
  | 'hands_on' | 'people' | 'detail_routine' | 'problem_solving' | 'planning'
export type TeamPreference =
  | 'alone' | 'small_team' | 'large_team' | 'leading' | 'no_preference'
export type LearningStyle = 'shown' | 'by_doing' | 'written' | 'video' | 'mentorship'
export type ProblemApproach =
  | 'self' | 'ask_experienced' | 'report_manager' | 'research' | 'team_discussion'
export type ConfidenceLevel = 'dusuk' | 'orta' | 'yuksek'
/** 002-interview FR-021 on-doldurmasi bunu okur; forma SORULMAZ (FR-002d). */
export type ExperienceLevel = 'intern' | 'junior' | 'senior'

export type SelfRatings = Record<string, number>

export interface OpenAnswers {
  enIyiOldugum?: string
  gelistirmekIstedigim?: string
  ikiYillikHedef?: string
}

export interface CreatePreAssessmentInput {
  experienceYears: ExperienceYears
  workStatus: WorkStatus
  workPreference: WorkPreference
  teamPreference: TeamPreference
  problemApproach: ProblemApproach
  skills?: string[]
  openAnswers?: OpenAnswers
}

export interface ApiErrorBody {
  statusCode: number
  error: string
  message: string
  details?: Record<string, unknown>
}

export class ApiError extends Error {
  status: number
  body: ApiErrorBody

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.body = body
  }
}

export interface CompetencyReport {
  id: string
  genelOzet: string
  gucluYonler: string[]
  gelisimAlanlari: string[]
  calismaTarziOzeti: string
  guvenSeviyesi: ConfidenceLevel
}

export interface PreAssessmentWithReport {
  id: string
  experienceYears: ExperienceYears
  workStatus: WorkStatus
  educationLevel: EducationLevel | null
  workPreference: WorkPreference
  teamPreference: TeamPreference
  learningStyle: LearningStyle | null
  problemApproach: ProblemApproach
  selfRatings: SelfRatings | null
  skills: string[]
  openAnswers: OpenAnswers | null
  experienceLevel: ExperienceLevel
  language: 'tr' | 'en'
  status: 'generating' | 'completed' | 'failed'
  isActive: boolean
  createdAt: string
  report: CompetencyReport | null
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json()
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody)
  return body as T
}

// §POST — senkron uretim (30 sn timeout, FR-008a). 201 rapor / 400 / 409 / 429 / 502 / 504.
export async function createPreAssessment(input: CreatePreAssessmentInput) {
  const res = await fetch(`${API_URL}/api/pre-assessments`, {
    method: 'POST',
    credentials: 'include',
    // Backend, rapor dilini bu header'dan cozer (resolveLanguage) — secili UI
    // dilini acikca gonderiyoruz, tarayicinin varsayilanina guvenmiyoruz.
    headers: { 'Content-Type': 'application/json', 'Accept-Language': i18n.language },
    body: JSON.stringify(input),
  })
  return parse<PreAssessmentWithReport>(res)
}

// §GET /active — LLM cagirmaz. 200 (var) / 204 (hic yok -> null).
export async function getActivePreAssessment(): Promise<PreAssessmentWithReport | null> {
  const res = await fetch(`${API_URL}/api/pre-assessments/active`, {
    credentials: 'include',
  })
  if (res.status === 204) return null
  return parse<PreAssessmentWithReport>(res)
}

// Arsiv listesi istemcisi KALDIRILDI: kullanicinin tek bir on degerlendirmesi
// var, gecmis listesi arayuzde yok. Sunucudaki GET /api/pre-assessments ucu
// duruyor (arsiv satirlari denetim izi icin saklaniyor, FR-009a).

// §GET /:id — sahibi veya admin; yabanci/yok kayit 404 (sizinti onleme, §1).
export async function getPreAssessment(id: string) {
  const res = await fetch(`${API_URL}/api/pre-assessments/${id}`, {
    credentials: 'include',
  })
  return parse<PreAssessmentWithReport>(res)
}
