import type { TFunction } from 'i18next'
import type {
  ExperienceYears,
  ProblemApproach,
  TeamPreference,
  WorkPreference,
  WorkStatus,
} from '@/lib/pre-assessment-client'

// FR-002 — meslek-bagimsiz form secenekleri (etiketler kullaniciya gorunen metin).
// Backend enum'lariyla (backend/prisma/schema.prisma) ELLE senkron tutulur.
//
// ⚠️ Metinler HICBIR sektore ozgu terim icermemelidir (SC-001a): temizlik
// gorevlisi de, insaat iscisi de, yazilimci da ayni soruyu anlayabilmeli.
//
// Etiketler `preAssessment` namespace'inden (locales/{tr,en}/preAssessment.json,
// `options.*` altinda) t() ile cozulur — bu dosya artik sadece deger/anahtar
// eslemesini tasir, metnin kendisini TASIMAZ (i18n oncesi burada sabitti).

export function getExperienceYearsOptions(
  t: TFunction,
): { value: ExperienceYears; label: string }[] {
  return [
    { value: 'none', label: t('options.experienceYears.none') },
    { value: 'lt1', label: t('options.experienceYears.lt1') },
    { value: 'y1_3', label: t('options.experienceYears.y1_3') },
    { value: 'y3_5', label: t('options.experienceYears.y3_5') },
    { value: 'y5_10', label: t('options.experienceYears.y5_10') },
    { value: 'y10plus', label: t('options.experienceYears.y10plus') },
  ]
}

export function getWorkStatusOptions(
  t: TFunction,
): { value: WorkStatus; label: string }[] {
  return [
    { value: 'employed_full', label: t('options.workStatus.employed_full') },
    { value: 'employed_part', label: t('options.workStatus.employed_part') },
    { value: 'seeking', label: t('options.workStatus.seeking') },
    { value: 'student', label: t('options.workStatus.student') },
  ]
}

export function getWorkPreferenceOptions(
  t: TFunction,
): { value: WorkPreference; label: string }[] {
  return [
    { value: 'hands_on', label: t('options.workPreference.hands_on') },
    { value: 'people', label: t('options.workPreference.people') },
    { value: 'detail_routine', label: t('options.workPreference.detail_routine') },
    { value: 'problem_solving', label: t('options.workPreference.problem_solving') },
    { value: 'planning', label: t('options.workPreference.planning') },
  ]
}

export function getTeamPreferenceOptions(
  t: TFunction,
): { value: TeamPreference; label: string }[] {
  return [
    { value: 'alone', label: t('options.teamPreference.alone') },
    { value: 'small_team', label: t('options.teamPreference.small_team') },
    { value: 'large_team', label: t('options.teamPreference.large_team') },
    { value: 'leading', label: t('options.teamPreference.leading') },
    { value: 'no_preference', label: t('options.teamPreference.no_preference') },
  ]
}

export function getProblemApproachOptions(
  t: TFunction,
): { value: ProblemApproach; label: string }[] {
  return [
    { value: 'self', label: t('options.problemApproach.self') },
    { value: 'ask_experienced', label: t('options.problemApproach.ask_experienced') },
    { value: 'report_manager', label: t('options.problemApproach.report_manager') },
    { value: 'research', label: t('options.problemApproach.research') },
    { value: 'team_discussion', label: t('options.problemApproach.team_discussion') },
  ]
}

// FR-002b — yetenek etiketi ONERILERI. Dogrulama listesi DEGIL: kullanici
// listede olmayan etiketi serbestce yazabilir (backend yalnizca uzunluk/adet
// dogrular). Secilen dile gore ONERI metni degisir; secilince o metin
// DOGRUDAN skill degeri olarak kaydedilir (serbest metin oldugu icin sorun
// degil — backend tarafinda oneri listesi YOKTUR, dogrulama yalnizca
// uzunluk/adet uzerinden yapilir).
export function getSkillSuggestions(t: TFunction): string[] {
  return t('options.skillSuggestions', { returnObjects: true }) as string[]
}

export const MAX_SKILL_TAGS = 15
export const MAX_SKILL_TAG_LENGTH = 40
export const MAX_OPEN_ANSWER_LENGTH = 300
