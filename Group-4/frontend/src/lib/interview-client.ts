// contracts/interview-api.md §1 — POST /api/interviews.
// Better Auth istemcisi yalnizca /api/auth/* icin; bu, geri kalan REST
// yuzeyi icin minimal bir fetch sarmalayicisidir (cookie tabanli oturum ->
// credentials: 'include').
import i18n from '@/lib/i18n';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type ExperienceLevel = 'intern' | 'junior' | 'mid' | 'senior';
export type InterviewMode = 'written' | 'voice';

export interface CreateInterviewInput {
  jobPostingSource: 'text' | 'pdf' | 'url';
  jobPostingText?: string;
  jobPostingFile?: File;
  // 009-linkedin-ilan-cekme: yalnizca ISTEKTE gonderilir, kayitta saklanmaz —
  // sunucu ilan metnini cekip onu kaydeder (specs/009 §2.4).
  jobPostingUrl?: string;
  // CV eklenmesi opsiyoneldir, ilan kaynagindan BAGIMSIZDIR — yalnizca PDF.
  cvFile?: File;
  questionCount: number;
  mode: InterviewMode;
  level: ExperienceLevel;
  adaptiveEnabled: boolean;
  // Ayarlar'da kayitli CV profili varsa bu gorusmede kullanilsin mi
  // (varsayilan true). cvFile gonderildiyse ETKISIZDIR.
  useStoredCv?: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

export interface Question {
  id: string;
  order: number;
  type: 'multiple_choice' | 'open_ended';
  text: string;
  options: string[];
  // FR-031 (Ipucu & Rehberlik paneli, issue #48) — isteğe bağlı, LLM üretemezse null.
  tip: string | null;
  rationale: string | null;
}

export interface InterviewSummary {
  id: string;
  status: 'in_progress' | 'completed';
  reportStatus: 'not_applicable' | 'pending' | 'ready' | 'failed';
  currentQuestionOrder: number;
  questionCount: number;
  position: string | null;
  level: ExperienceLevel;
  language: 'tr' | 'en';
  mode: InterviewMode;
  completedAt: string | null;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body as ApiErrorBody);
  return body as T;
}

export async function createInterview(input: CreateInterviewInput) {
  const form = new FormData();
  form.set('jobPostingSource', input.jobPostingSource);
  if (input.jobPostingText) form.set('jobPostingText', input.jobPostingText);
  if (input.jobPostingFile) form.set('jobPostingFile', input.jobPostingFile);
  if (input.jobPostingUrl) form.set('jobPostingUrl', input.jobPostingUrl);
  if (input.cvFile) form.set('cvFile', input.cvFile);
  form.set('questionCount', String(input.questionCount));
  form.set('mode', input.mode);
  form.set('level', input.level);
  form.set('adaptiveEnabled', String(input.adaptiveEnabled));
  // Ayarlar'daki kayitli CV bu gorusmede kullanilsin mi (varsayilan true,
  // sunucu tarafinda da ayni varsayilan). Bu istekte cvFile de gonderildiyse
  // yuklenen dosya kazanir.
  form.set('useStoredCv', String(input.useStoredCv ?? true));

  const res = await fetch(`${API_URL}/api/interviews`, {
    method: 'POST',
    credentials: 'include',
    // Backend, mulakat/soru dilini bu header'dan cozer (resolveLanguage) —
    // secili UI dilini acikca gonderiyoruz, tarayicinin varsayilanina
    // guvenmiyoruz (bkz. lib/i18n).
    headers: { 'Accept-Language': i18n.language },
    body: form,
  });

  return parse<{
    interview: InterviewSummary;
    currentQuestion: Question | null;
  }>(res);
}

// ADR-0014 - sozlu mod STT'si (Groq Whisper, backend). Blob dosya adi
// onemsiz (backend uzantiyi mimeType'tan cikarir); alan adi backend'deki
// FileInterceptor('audio') ile ESLESMELIDIR.
export async function transcribeAudio(
  interviewId: string,
  blob: Blob,
  mimeType: string,
) {
  const form = new FormData();
  form.set(
    'audio',
    blob,
    `kayit.${mimeType.split('/')[1]?.split(';')[0] ?? 'webm'}`,
  );

  const res = await fetch(
    `${API_URL}/api/interviews/${interviewId}/transcribe`,
    { method: 'POST', credentials: 'include', body: form },
  );

  return parse<{ text: string }>(res);
}

export interface AnsweredPair {
  order: number;
  type: 'multiple_choice' | 'open_ended';
  text: string;
  options: string[];
  tip: string | null;
  rationale: string | null;
  answer: { content: string; answeredAt: string };
}

// §3 (resume) — cevaplanmis ciftler + aktif soru; SONRAKI sorular donmez.
export async function getInterview(id: string) {
  const res = await fetch(`${API_URL}/api/interviews/${id}`, {
    credentials: 'include',
  });
  return parse<
    InterviewSummary & {
      currentQuestion: Question | null;
      answeredPairs: AnsweredPair[];
      report: Report | null;
    }
  >(res);
}

// §2 — History ekraninin veri temeli. Tam soru/cevap icerigi BURADA YOK.
export interface InterviewListItem {
  id: string;
  position: string | null;
  status: 'in_progress' | 'completed';
  reportStatus: 'not_applicable' | 'pending' | 'ready' | 'failed';
  mode: InterviewMode;
  level: ExperienceLevel;
  language: 'tr' | 'en';
  questionCount: number;
  createdAt: string;
  completedAt: string | null;
  /** Yalnizca admin yanitinda gelir (§4.3). */
  deletedAt?: string | null;
}

export async function listInterviews() {
  const res = await fetch(`${API_URL}/api/interviews`, {
    credentials: 'include',
  });
  return parse<InterviewListItem[]>(res);
}

// contracts/history-api.md §3 — soft-delete; 204 (yeni veya zaten silinmis, idempotent).
export async function deleteInterview(id: string) {
  const res = await fetch(`${API_URL}/api/interviews/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as ApiErrorBody
    throw new ApiError(res.status, body)
  }
}

// Issue #68 — soru bazli geri bildirim. Mulakat SIRASINDA gelmez: yalnizca
// tamamlanmis gorusmenin raporunda bulunur.
export type Verdict = 'dogru' | 'kismen' | 'yetersiz';

export interface QuestionFeedback {
  /** AnsweredPair.order ile eslesir. */
  order: number;
  verdict: Verdict;
  /** Coktan secmelide dogru secenegin tam metni; acik ucluda beklenen cevabin ozeti. */
  correctAnswer: string;
  explanation: string;
}

export interface Report {
  id: string;
  overallImpression: string;
  strengths: string[];
  improvementAreas: string[];
  technicalScore: number;
  behavioralScore: number;
  generalScore: number;
  overallScore: number;
  additionalNotes: string[];
  /** #68 — bu alan eklenmeden once uretilmis raporlarda bos dizi. */
  questionFeedback: QuestionFeedback[];
  generatedAt: string;
}

// §6 — yalnizca failed durumda gecerli; 5/saat sinirli.
export async function retryReport(interviewId: string) {
  const res = await fetch(
    `${API_URL}/api/interviews/${interviewId}/report/retry`,
    { method: 'POST', credentials: 'include' },
  );
  return parse<{ reportStatus: 'ready'; report: Report }>(res);
}

// specs/007-ui-design Rötuş Notları — "Bildir" (üç nokta menüsü). LLM cagrisi
// yok, hiz siniri yok (panelEvent ile ayni gerekce); hata UI'ı bloklamaz.
export async function reportProblem(interviewId: string, message: string) {
  const res = await fetch(
    `${API_URL}/api/interviews/${interviewId}/report-problem`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    },
  );
  if (!res.ok) {
    const body = (await res.json()) as ApiErrorBody;
    throw new ApiError(res.status, body);
  }
}

// contracts/interview-api.md §4 — siradaki soru VEYA (son soruysa) null doner.
export async function submitAnswer(
  interviewId: string,
  questionOrder: number,
  content: string,
) {
  const res = await fetch(`${API_URL}/api/interviews/${interviewId}/answers`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionOrder, content }),
  });
  return parse<{
    interview: InterviewSummary;
    currentQuestion: Question | null;
    // FR-038: sozlu modda siradaki soruya gecmeden okunan notr replik.
    // Adaptif akis kapaliysa veya LLM uretmediyse null — istemci sablona duser.
    interviewerRemark: string | null;
  }>(res);
}

// contracts/interview-api.md §7 (FR-034, issue #48) — salt telemetri; hata UI'ı
// bloklamaz, panel acilisini engellemez (fire-and-forget).
export function logPanelEvent(
  interviewId: string,
  questionOrder: number,
  tab: 'hint' | 'rationale',
): void {
  void fetch(`${API_URL}/api/interviews/${interviewId}/panel-events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionOrder, tab }),
  }).catch(() => {
    // Sessizce yut: bu bir gozlemlenebilirlik olayidir, kullanici akisini
    // ETKILEMEMELIdir (FR-034 Kapsam Disi).
  });
}

// --- Ilan x CV uyum analizi (POST /api/interviews/cv-match) ---
// Gorusme OLUSTURMAZ, hicbir sey kaydetmez: aday mulakata girmeden once
// ilanla CV'si arasindaki bosluklari gorur.
export interface CvMatchResult {
  matchedSkills: { skill: string; evidence: string }[];
  missingSkills: { skill: string; required: boolean; suggestion: string }[];
  band: 'zayif' | 'gelisen' | 'yeterli' | 'guclu' | 'ustun';
  matchScore: number;
  focusAreas: string[];
  summary: string;
}

export async function cvJobMatch(input: {
  jobPostingSource: 'text' | 'pdf' | 'url';
  jobPostingText?: string;
  jobPostingFile?: File;
  jobPostingUrl?: string;
  cvFile?: File;
  useStoredCv?: boolean;
}) {
  const form = new FormData();
  form.set('jobPostingSource', input.jobPostingSource);
  if (input.jobPostingText) form.set('jobPostingText', input.jobPostingText);
  if (input.jobPostingFile) form.set('jobPostingFile', input.jobPostingFile);
  if (input.jobPostingUrl) form.set('jobPostingUrl', input.jobPostingUrl);
  if (input.cvFile) form.set('cvFile', input.cvFile);
  form.set('useStoredCv', String(input.useStoredCv ?? true));

  const res = await fetch(`${API_URL}/api/interviews/cv-match`, {
    method: 'POST',
    credentials: 'include',
    // createInterview ile ayni gerekce: analiz dili secili UI dilinden cozulur.
    headers: { 'Accept-Language': i18n.language },
    body: form,
  });

  return parse<CvMatchResult>(res);
}

// --- Rapor paylasim linki ---
// Uretim/iptal oturum ISTER (sahibi); okuma ucu (getSharedReport) oturumsuzdur.
export interface ShareLink {
  token: string
  expiresAt: string
}

export async function createShareLink(interviewId: string) {
  const res = await fetch(`${API_URL}/api/interviews/${interviewId}/share`, {
    method: 'POST',
    credentials: 'include',
  })
  return parse<ShareLink>(res)
}

export async function revokeShareLink(interviewId: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/interviews/${interviewId}/share`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new ApiError(res.status, (await res.json()) as ApiErrorBody)
}

export interface SharedReport {
  position: string | null
  level: ExperienceLevel
  language: 'tr' | 'en'
  completedAt: string | null
  report: Report
  answeredPairs: AnsweredPair[]
}

// credentials GONDERILMEZ: bu uc kimlikle degil TOKEN ile yetkilendirir,
// cerez gondermek yanlis bir izlenim verirdi.
export async function getSharedReport(token: string) {
  const res = await fetch(`${API_URL}/api/shared-reports/${encodeURIComponent(token)}`)
  return parse<SharedReport>(res)
}
