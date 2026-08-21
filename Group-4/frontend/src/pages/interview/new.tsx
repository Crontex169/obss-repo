import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, FileUp, Link2 } from 'lucide-react'
import {
  createInterview,
  ApiError,
  type ExperienceLevel,
  type InterviewMode,
} from '@/lib/interview-client'
import { PdfUpload } from '@/components/interview/pdf-upload'
import { ModeSelector } from '@/components/interview/mode-selector'
import { INPUT_CLASS, BUTTON_BASE } from '@/lib/ui-styles'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { PageHeader } from '@/components/page-header'
import { useTranslation } from '@/lib/i18n/language-provider'

// Bos/gecersiz giris en dusuk degere, arali disi sayilar en yakin sinira duser.
export function clampQuestionCount(raw: string) {
  return Math.min(20, Math.max(5, Math.trunc(Number(raw)) || 5))
}

const SOURCE_ICONS = { text: FileText, pdf: FileUp, url: Link2 } as const
const LEVELS: ExperienceLevel[] = ['intern', 'junior', 'mid', 'senior']

// Hikaye 1: is ilani girisi + N/mod/seviye/adaptif secimi (FR-001..FR-005, FR-021).
// Seviye alani icin on-doldurma kancasi: 003-pre-assessment aktif bir on
// degerlendirme bulursa `initialLevel` prop'unu doldurur; yoksa varsayilan
// 'junior' kalir ve akis bozulmaz (FR-021, SC-013).
//
// Gorsel katman 007-ui-design/v2.pen "Screen - Yeni Mülakat (İlan Ekle)"
// tasarimindan portlandi — karar kaydi ve alinmayan parcalar (tahmini sure,
// tespit edilen pozisyon chip'i, karakter sayaci) icin
// specs/007-ui-design/tasks-new-interview-form.md.
export default function NewInterviewPage({
  initialLevel,
}: {
  initialLevel?: ExperienceLevel
}) {
  const { t } = useTranslation('interview')
  const navigate = useNavigate()
  const [source, setSource] = useState<'text' | 'pdf' | 'url'>('text')
  const [jobPostingText, setJobPostingText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  // 009-linkedin-ilan-cekme: bicim dogrulamasi SUNUCUDA (specs/009 §2.3);
  // burada yalnizca bos alan erken yakalanir, metin/PDF dallariyla ayni desen.
  const [jobPostingUrl, setJobPostingUrl] = useState('')
  // CV eklenmesi opsiyoneldir, ilan kaynagindan BAGIMSIZDIR (007-ui-design deseniyle
  // ayni PdfUpload bileseni tekrar kullanilir — yeni bir yukleme UI'i yazilmaz).
  const [cvFile, setCvFile] = useState<File | null>(null)
  // String tutulur ki kullanici alani silip yeniden yazabilsin; gecersiz deger
  // odak cikisinda 5-20 araligina kirpilir.
  const [questionCount, setQuestionCount] = useState('8')
  const [mode, setMode] = useState<InterviewMode>('written')
  const [level, setLevel] = useState<ExperienceLevel>(initialLevel ?? 'junior')
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (source === 'text' && jobPostingText.trim().length === 0) {
      setStatus('error')
      setError(t('new.errors.emptyText'))
      return
    }
    if (source === 'pdf' && !file) {
      setStatus('error')
      setError(t('new.errors.noPdf'))
      return
    }
    if (source === 'url' && jobPostingUrl.trim().length === 0) {
      setStatus('error')
      setError(t('new.errors.emptyUrl'))
      return
    }

    setStatus('loading')
    try {
      const result = await createInterview({
        jobPostingSource: source,
        jobPostingText: source === 'text' ? jobPostingText : undefined,
        jobPostingFile: source === 'pdf' ? (file ?? undefined) : undefined,
        jobPostingUrl: source === 'url' ? jobPostingUrl.trim() : undefined,
        cvFile: cvFile ?? undefined,
        questionCount: clampQuestionCount(questionCount),
        mode,
        level,
        adaptiveEnabled,
      })
      // SPA navigasyonu: tam sayfa reload YOK (app-shell/session.tsx ile ayni desen).
      navigate(`/interview/${result.interview.id}`)
    } catch (err) {
      setStatus('error')
      if (
        err instanceof ApiError &&
        err.body.details?.reason === 'not_a_job_posting'
      ) {
        // FR-028: form girisi (metin/PDF) KAYBEDILMEDEN kalir — state zaten
        // resetlenmiyor, kullanici duzeltip tekrar deneyebilir.
        setError(t('new.errors.notJobPosting'))
      } else {
        setError(err instanceof ApiError ? err.message : t('new.errors.createFailed'))
      }
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('new.title')} subtitle={t('new.subtitle')} />

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex flex-col gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {t('new.cardTitle')}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {t('new.cardSubtitle')}
            </p>
          </div>

          {/* Kaynak sekmeleri: gorsel pill grubu, altta gercek radio (K5) —
              interview-form.test.tsx'teki getByRole('radio', ...) sorgulari
              etiket adlarina dayaniyor, degismiyor. */}
          <div className="flex items-center gap-1 rounded-lg bg-[var(--color-bg)] p-0.5">
            {(['text', 'pdf', 'url'] as const).map((key) => {
              const Icon = SOURCE_ICONS[key]
              const labelKey =
                key === 'text' ? 'sourceText' : key === 'pdf' ? 'sourcePdf' : 'sourceUrl'
              const selected = source === key
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="source"
                    checked={selected}
                    onChange={() => setSource(key)}
                    className="peer sr-only"
                  />
                  <Icon
                    className="peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-soft)]"
                    size={14}
                  />
                  {t(`new.${labelKey}`)}
                </label>
              )
            })}
          </div>
        </div>

        {source === 'text' && (
          <textarea
            placeholder={t('new.jobPostingPlaceholder')}
            required
            rows={6}
            value={jobPostingText}
            onChange={(e) => setJobPostingText(e.target.value)}
            className={INPUT_CLASS}
          />
        )}
        {source === 'pdf' && <PdfUpload file={file} onChange={setFile} />}
        {source === 'url' && (
          <div className="flex flex-col gap-1.5">
            {/* type="url" DEGIL: tarayicinin bicim kontrolu bizimkinden zayif
                ve uyarisi tarayici dilinde cikardi — bicim dogrulamasi
                sunucudadir. inputMode mobil klavyeyi yine URL'ye ayarlar. */}
            <input
              type="text"
              inputMode="url"
              placeholder={t('new.jobPostingUrlPlaceholder')}
              required
              value={jobPostingUrl}
              onChange={(e) => setJobPostingUrl(e.target.value)}
              className={INPUT_CLASS}
            />
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('new.jobPostingUrlHint')}
            </p>
          </div>
        )}

        {/* CV yukleme: opsiyonel, ilan kaynagindan bagimsiz — ayni PdfUpload
            bileseni tekrar kullanilir (yeni bileşen yazılmaz). */}
        <div className="flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-4">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {t('new.cvLabel')}
          </span>
          <PdfUpload file={cvFile} onChange={setCvFile} />
        </div>

        {/* Ayarlar satiri: soru sayisi / gorusme modu / seviye tek yatay
            satirda (007-ui-design T4), dar ekranda alt alta sarar. */}
        <div className="flex flex-wrap gap-6 border-t border-[var(--color-border)] pt-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {t('new.questionCountLabel')}
            </span>
            {/* Merge notu (2026-08-04): alt sinir main'den geldi (5, PR #23) —
                deger string tutulur ki alan silinip yeniden yazilabilsin, odak
                cikisinda 5-20 araligina kirpilir. font-data: repoda zaten
                kullanilan tabular rakam stili (interview-filter-bar.tsx). */}
            <input
              type="number"
              min={5}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              onBlur={(e) => setQuestionCount(String(clampQuestionCount(e.target.value)))}
              className={`${INPUT_CLASS} font-data w-24 text-center tabular-nums`}
            />
          </label>

          <ModeSelector value={mode} onChange={setMode} />

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-medium text-[var(--color-text-muted)]">
              {t('new.levelLabel')}
            </legend>
            <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg)] p-0.5">
              {LEVELS.map((lvl) => (
                <label
                  key={lvl}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    level === lvl
                      ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <input
                    type="radio"
                    name="level"
                    checked={level === lvl}
                    onChange={() => setLevel(lvl)}
                    className="peer sr-only"
                  />
                  <span className="peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-soft)]">
                    {t(`new.level${lvl[0].toUpperCase()}${lvl.slice(1)}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Adaptif akis: semantik checkbox korunur, gorsel bir anahtar (switch)
            olarak stillenir (007-ui-design T5). Kisa aciklama satiri kaldirildi
            (2026-08-10) — InfoTooltip zaten ayni bilgiyi veriyor, ikisi yan
            yana tekrar sayilirdi. */}
        <label className="flex items-center justify-between gap-4 border-t border-[var(--color-border)] pt-4">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text)]">
            {t('new.adaptiveLabel')}
            <InfoTooltip text={t('new.adaptiveTooltip')} />
          </span>
          <span className="relative inline-flex shrink-0 items-center">
            <input
              type="checkbox"
              checked={adaptiveEnabled}
              onChange={(e) => setAdaptiveEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <span className="h-6 w-10 rounded-full bg-[var(--color-border)] transition-colors peer-checked:bg-[var(--color-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-soft)]" />
            <span className="absolute left-1 h-4 w-4 rounded-full bg-[var(--color-surface)] transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={status === 'loading'}
            className={`inline-flex items-center gap-2 ${BUTTON_BASE}`}
          >
            {status === 'loading' ? t('new.submitting') : t('new.submit')}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </div>
  )
}
