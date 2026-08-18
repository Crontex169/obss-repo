import { useState } from 'react'
import { Accordion } from 'radix-ui'
import { ChevronDownIcon, Send } from 'lucide-react'
import type {
  CreatePreAssessmentInput,
  ExperienceYears,
  ProblemApproach,
  TeamPreference,
  WorkPreference,
  WorkStatus,
} from '@/lib/pre-assessment-client'
import {
  getExperienceYearsOptions,
  MAX_OPEN_ANSWER_LENGTH,
  getProblemApproachOptions,
  getTeamPreferenceOptions,
  getWorkPreferenceOptions,
  getWorkStatusOptions,
} from '@/lib/pre-assessment-options'
import { SkillTagInput } from '@/components/pre-assessment/skill-tag-input'
import { INPUT_CLASS, BUTTON_CLASS } from '@/lib/ui-styles'
import { useTranslation } from '@/lib/i18n/language-provider'

// Hikaye 1 — MESLEK-BAGIMSIZ, kademeli (accordion) form (spec FR-002, #49/#69).
//
// Her soru, mesleginden bagimsiz olarak HERKESIN cevaplayabilecegi sekilde
// yazilmistir (SC-001a): sektore ozgu terim veya arac bilgisi gerektirmez.
// `experienceLevel` (intern/junior/senior) BILINCLI olarak SORULMAZ - yazilim
// jargonudur; sunucu deneyim suresinden turetir (FR-002d).
//
// 008: learningStyle / selfRatings / educationLevel formdan KALDIRILDI (K1-K4,
// specs/008-on-degerlendirme-sadelestirme). 5 zorunlu alan uc gruba bolundu;
// 3. grup (yetenekler + acik uclu) tamamen opsiyonel ama ilerleme gostergesine
// DAHIL (bkz. progressPercent). Radix Accordion: gercek <button> tetikleyici +
// klavye/aria yerlesik gelir (a11y gereksinimi, ekstra kod yazmadan - rung 5).
const GROUPS = ['basics', 'workStyle', 'optional'] as const
type GroupId = (typeof GROUPS)[number]

/**
 * Mevcut aktif degerlendirmenin cevaplari. Verilirse form onlarla dolu acilir -
 * kullanici raporunu degistirmek icin 5 soruyu bastan cevaplamak zorunda kalmaz.
 *
 * DIKKAT: useState baslangic degeri yalnizca ILK render'da okunur. Bu bilesen
 * `initial` gelmeden RENDER EDILMEMELI (cagiran taraf yuklemeyi bekler),
 * yoksa gec gelen cevaplar forma islemez.
 */
export function AssessmentForm({
  onSubmit,
  submitting,
  initial,
}: {
  onSubmit: (input: CreatePreAssessmentInput) => void
  submitting: boolean
  initial?: Partial<CreatePreAssessmentInput>
}) {
  const [experienceYears, setExperienceYears] = useState<ExperienceYears | ''>(
    initial?.experienceYears ?? '',
  )
  const [workStatus, setWorkStatus] = useState<WorkStatus | ''>(initial?.workStatus ?? '')
  const [workPreference, setWorkPreference] = useState<WorkPreference | ''>(
    initial?.workPreference ?? '',
  )
  const [teamPreference, setTeamPreference] = useState<TeamPreference | ''>(
    initial?.teamPreference ?? '',
  )
  const [problemApproach, setProblemApproach] = useState<ProblemApproach | ''>(
    initial?.problemApproach ?? '',
  )
  const { t } = useTranslation('preAssessment')
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? [])
  const [openAnswers, setOpenAnswers] = useState({
    enIyiOldugum: initial?.openAnswers?.enIyiOldugum ?? '',
    gelistirmekIstedigim: initial?.openAnswers?.gelistirmekIstedigim ?? '',
    ikiYillikHedef: initial?.openAnswers?.ikiYillikHedef ?? '',
  })
  const [error, setError] = useState('')

  // Gruplar KILITLI DEGIL: kullanici istedigi grubu istedigi an acabilir.
  // Otomatik acilma yalnizca bir kolaylik - onceki grup bitince sonraki kendi
  // acilir, ama bunu beklemek zorunda degil.
  // Baslangicta TUM gruplar KAPALI: sayfa tek bakista neyin sorulacagini
  // gosterir, kullanici nereden baslayacagini kendi secer.
  const [openGroups, setOpenGroups] = useState<GroupId[]>([])
  const [announcement, setAnnouncement] = useState('')

  const basicsDone = Boolean(experienceYears && workStatus)
  const workStyleDone = Boolean(workPreference && teamPreference && problemApproach)
  // Tamamlanma durumuna gore OTOMATIK acilacak gruplar (kilit degil).
  const autoOpenGroups: GroupId[] = basicsDone
    ? workStyleDone
      ? GROUPS.slice()
      : ['basics', 'workStyle']
    : ['basics']

  const requiredFilledCount = [
    experienceYears,
    workStatus,
    workPreference,
    teamPreference,
    problemApproach,
  ].filter(Boolean).length

  // Gosterge SORU basina ilerler ve opsiyonelleri de sayar: 5 zorunlu + yetenek
  // etiketleri + 3 acik uclu = 9. %100 yalnizca HEPSI dolunca cikar; ilk iki
  // grup bitince %100 gostermek "bitti" yalani soyluyordu.
  // Gonder dugmesi bundan BAGIMSIZ: yalnizca 5 zorunlu alana bakar.
  const answeredCount =
    requiredFilledCount +
    (skills.length > 0 ? 1 : 0) +
    Object.values(openAnswers).filter((v) => v.trim().length > 0).length
  const progressPercent = Math.round((answeredCount / 9) * 100)

  // Bir grup ilk kez tamamlaninca sonraki grubu otomatik ac + ekran okuyucuya
  // duyur (odak TASINMAZ - kullanici zaten mevcut alanda etkilesimde).
  function advanceIfComplete(nextUnlocked: GroupId[]) {
    setOpenGroups((prev) => {
      const toOpen = nextUnlocked.filter((g) => !prev.includes(g))
      if (toOpen.length === 0) return prev
      const justUnlocked = toOpen[toOpen.length - 1]
      setAnnouncement(t(`form.groups.${justUnlocked}.announced`))
      return [...prev, ...toOpen]
    })
  }

  function handleGroupChange(next: string[]) {
    setOpenGroups(next.filter((g): g is GroupId => GROUPS.includes(g as GroupId)))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!experienceYears || !workStatus || !workPreference || !teamPreference || !problemApproach) {
      setError(t('form.requiredError'))
      return
    }

    const trimmedAnswers = Object.fromEntries(
      Object.entries(openAnswers)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v.length > 0),
    )

    onSubmit({
      experienceYears,
      workStatus,
      workPreference,
      teamPreference,
      problemApproach,
      ...(skills.length > 0 ? { skills } : {}),
      ...(Object.keys(trimmedAnswers).length > 0 ? { openAnswers: trimmedAnswers } : {}),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-[var(--color-text-muted)]" aria-live="off">
          {t('form.progressLabel', { percent: progressPercent })}
        </p>
      </div>

      {/* Ekran okuyucu duyurusu: otomatik acilan grup. Gorsel olarak gizli. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <Accordion.Root
        type="multiple"
        value={openGroups}
        onValueChange={handleGroupChange}
        className="flex flex-col gap-3"
      >
        <FormGroup
          id="basics"
          title={t('form.groups.basics.title')}

          done={basicsDone}
        >
          <Select
            label={t('form.experienceYearsLabel')}
            value={experienceYears}
            onChange={(v) => {
              setExperienceYears(v as ExperienceYears)
              advanceIfComplete(
                Boolean(v && workStatus) ? ['basics', 'workStyle'] : ['basics'],
              )
            }}
            options={getExperienceYearsOptions(t)}
            disabled={submitting}
          />

          <Select
            label={t('form.workStatusLabel')}
            value={workStatus}
            onChange={(v) => {
              setWorkStatus(v as WorkStatus)
              advanceIfComplete(
                Boolean(experienceYears && v) ? ['basics', 'workStyle'] : ['basics'],
              )
            }}
            options={getWorkStatusOptions(t)}
            disabled={submitting}
          />
        </FormGroup>

        <FormGroup
          id="workStyle"
          title={t('form.groups.workStyle.title')}

          done={workStyleDone}
        >
          <RadioGroup
            legend={t('form.workPreferenceLegend')}
            name="workPreference"
            value={workPreference}
            onChange={(v) => {
              setWorkPreference(v as WorkPreference)
              advanceIfComplete(
                Boolean(v && teamPreference && problemApproach) ? GROUPS.slice() : autoOpenGroups,
              )
            }}
            options={getWorkPreferenceOptions(t)}
            disabled={submitting}
          />

          <RadioGroup
            legend={t('form.teamPreferenceLegend')}
            name="teamPreference"
            value={teamPreference}
            onChange={(v) => {
              setTeamPreference(v as TeamPreference)
              advanceIfComplete(
                Boolean(workPreference && v && problemApproach) ? GROUPS.slice() : autoOpenGroups,
              )
            }}
            options={getTeamPreferenceOptions(t)}
            disabled={submitting}
          />

          <RadioGroup
            legend={t('form.problemApproachLegend')}
            name="problemApproach"
            value={problemApproach}
            onChange={(v) => {
              setProblemApproach(v as ProblemApproach)
              advanceIfComplete(
                Boolean(workPreference && teamPreference && v) ? GROUPS.slice() : autoOpenGroups,
              )
            }}
            options={getProblemApproachOptions(t)}
            disabled={submitting}
          />
        </FormGroup>

        <FormGroup
          id="optional"
          title={t('form.groups.optional.title')}

          // K3: bu grupta zorunlu alan yok, tamamlanma rozeti/ilerlemeye hic girmez.
          done={false}
          hideDoneBadge
        >
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {t('form.skillsLabel')}{' '}
              <span className="font-normal text-[var(--color-text-muted)]">{t('form.optionalSuffix')}</span>
            </p>
            <SkillTagInput value={skills} onChange={setSkills} disabled={submitting} />
          </div>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-medium text-[var(--color-text)]">
              {t('form.openAnswersLegend')}{' '}
              <span className="font-normal text-[var(--color-text-muted)]">{t('form.optionalSuffix')}</span>
            </legend>
            <OpenAnswer
              label={t('form.openAnswers.bestAt')}
              value={openAnswers.enIyiOldugum}
              onChange={(v) => setOpenAnswers((p) => ({ ...p, enIyiOldugum: v }))}
              disabled={submitting}
            />
            <OpenAnswer
              label={t('form.openAnswers.wantToImprove')}
              value={openAnswers.gelistirmekIstedigim}
              onChange={(v) => setOpenAnswers((p) => ({ ...p, gelistirmekIstedigim: v }))}
              disabled={submitting}
            />
            <OpenAnswer
              label={t('form.openAnswers.twoYearGoal')}
              value={openAnswers.ikiYillikHedef}
              onChange={(v) => setOpenAnswers((p) => ({ ...p, ikiYillikHedef: v }))}
              disabled={submitting}
            />
          </fieldset>
        </FormGroup>
      </Accordion.Root>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <button
        type="submit"
        disabled={submitting || requiredFilledCount < 5}
        className={`inline-flex items-center justify-center gap-1.5 ${BUTTON_CLASS}`}
      >
        {!submitting && <Send aria-hidden className="size-4" />}
        {submitting ? t('form.submitting') : t('form.submit')}
      </button>
    </form>
  )
}

function FormGroup({
  id,
  title,
  done,
  hideDoneBadge,
  children,
}: {
  id: GroupId
  title: string
  done: boolean
  hideDoneBadge?: boolean
  children: React.ReactNode
}) {
  const { t } = useTranslation('preAssessment')
  return (
    <Accordion.Item
      value={id}
      className="rounded-xl border border-[var(--color-border)]"
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-[var(--color-text)]">
          <span className="flex-1">{title}</span>
          {!hideDoneBadge && done && (
            <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
              {t('form.groups.doneBadge')}
            </span>
          )}
          {/* Acilir oldugunu gosterir; Radix trigger'a data-state koyar. */}
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-data-[state=open]:rotate-180"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="flex flex-col gap-4 border-t border-[var(--color-border)] px-4 py-4">
        {children}
      </Accordion.Content>
    </Accordion.Item>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  optional,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  optional?: boolean
}) {
  const { t } = useTranslation('preAssessment')
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-[var(--color-text)]">
      <span>
        {label}
        {optional && (
          <span className="font-normal text-[var(--color-text-muted)]"> {t('form.optionalSuffix')}</span>
        )}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={INPUT_CLASS}
      >
        <option value="">{t('form.selectPlaceholder')}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RadioGroup({
  legend,
  name,
  value,
  onChange,
  options,
  disabled,
}: {
  legend: string
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium text-[var(--color-text)]">
        {legend}
      </legend>
      {options.map((o) => (
        <label
          key={o.value}
          className="flex items-center gap-2 text-sm text-[var(--color-text)]"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="accent-[var(--color-accent)]"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  )
}

function OpenAnswer({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text)]">
      {label}
      <textarea
        rows={2}
        value={value}
        maxLength={MAX_OPEN_ANSWER_LENGTH}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={INPUT_CLASS}
      />
      <span className="text-xs text-[var(--color-text-muted)]">
        {value.length}/{MAX_OPEN_ANSWER_LENGTH}
      </span>
    </label>
  )
}
