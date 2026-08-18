import { useEffect, useState } from 'react'
import {
  ApiError,
  createPreAssessment,
  getActivePreAssessment,
  type CreatePreAssessmentInput,
  type PreAssessmentWithReport,
} from '@/lib/pre-assessment-client'
import { AssessmentForm } from '@/components/pre-assessment/assessment-form'
import { GenerationError, GenerationPending } from '@/components/pre-assessment/generation-state'
import { ReportView } from '@/components/pre-assessment/report-view'
import { useTranslation } from '@/lib/i18n/language-provider'

/**
 * Kayit -> form degerleri. 008: kaldirilan alanlar (learningStyle, selfRatings,
 * educationLevel) yanit tipinde HALA var (eski kayitlar tasiyor) ama forma
 * TASINMAZ - form artik onlari sormuyor.
 */
function toFormValues(
  active: PreAssessmentWithReport,
): Partial<CreatePreAssessmentInput> {
  return {
    experienceYears: active.experienceYears,
    workStatus: active.workStatus,
    workPreference: active.workPreference,
    teamPreference: active.teamPreference,
    problemApproach: active.problemApproach,
    skills: active.skills,
    ...(active.openAnswers ? { openAnswers: active.openAnswers } : {}),
  }
}

function FormSkeleton() {
  return (
    <div
      className="h-64 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      aria-hidden
    />
  )
}

type ViewState =
  | { kind: 'form' }
  | { kind: 'pending'; input: CreatePreAssessmentInput }
  | { kind: 'error'; message: string; retryAfterSeconds?: number; input: CreatePreAssessmentInput }
  | { kind: 'done'; result: PreAssessmentWithReport }

// Hikaye 1: form -> senkron uretim -> rapor, AYNI sayfada (route degisikligi
// YOK - LLM cagrisi 30 sn ic zaman asimiyla istek icinde tamamlanir, FR-008a).
// pages/interview/new.tsx'in aksine (ayri /interview/:id sayfasina yonlendirir)
// bu dilim senkron oldugu icin ayri bir "session" adimina ihtiyac duymaz.
export default function NewPreAssessmentPage() {
  const { t } = useTranslation('preAssessment')
  const [state, setState] = useState<ViewState>({ kind: 'form' })
  // Kullanicinin TEK on degerlendirmesi. `undefined` = henuz yuklenmedi,
  // `null` = hic yok. Yeni gonderim bunun yerini alir (gecmis listesi YOK).
  const [saved, setSaved] = useState<PreAssessmentWithReport | null>()

  useEffect(() => {
    getActivePreAssessment()
      .then(setSaved)
      .catch(() => setSaved(null))
  }, [])

  async function submit(input: CreatePreAssessmentInput) {
    setState({ kind: 'pending', input })
    try {
      const result = await createPreAssessment(input)
      setState({ kind: 'done', result })
      setSaved(result)
    } catch (err) {
      if (err instanceof ApiError) {
        setState({
          kind: 'error',
          // 403: RolesGuard('user') yonetici hesabini reddeder (FR-011a, admin
          // salt okunur). Guard genel bir "Forbidden" doner - orasi paylasimli
          // oldugu icin mesaj BURADA aciklanir, yoksa kullanici sebebi gormez.
          message: err.status === 403 ? t('new.adminForbidden') : err.message,
          retryAfterSeconds: err.body.details?.retryAfterSeconds as number | undefined,
          input,
        })
      } else {
        setState({ kind: 'error', message: t('new.genericSubmitError'), input })
      }
    }
  }

  // Tek kayit oldugu icin "eskisi arsivlenecek" onayi YOK: degistirmek normal
  // akis, onaylanacak bir kayip degil.
  function handleFormSubmit(input: CreatePreAssessmentInput) {
    void submit(input)
  }

  const initial = saved ? toFormValues(saved) : undefined
  // Kaydedilmis rapor sayfada KALIR - kullanici geri geldiginde de gorur.
  const report = state.kind === 'done' ? state.result.report : saved?.report

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-xl font-bold text-[var(--color-text)] sm:text-2xl">
          {t('new.heading')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {t('new.subheading')}
        </p>
      </header>

      {/* Form, aktif kayit yuklenene kadar RENDER EDILMEZ: AssessmentForm
          baslangic degerlerini yalnizca ilk render'da okur, gec gelen cevaplar
          forma islemezdi. */}
      {saved === undefined && <FormSkeleton />}

      {saved !== undefined && (
        <AssessmentForm
          onSubmit={handleFormSubmit}
          submitting={state.kind === 'pending'}
          initial={initial}
        />
      )}

      {state.kind === 'pending' && <GenerationPending />}

      {state.kind === 'error' && (
        <GenerationError
          message={state.message}
          retryAfterSeconds={state.retryAfterSeconds}
          onRetry={() => void submit(state.input)}
        />
      )}

      {report && <ReportView report={report} />}
    </div>
  )
}
