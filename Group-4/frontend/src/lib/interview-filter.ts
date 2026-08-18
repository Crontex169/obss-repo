import type {
  ExperienceLevel,
  InterviewListItem,
  InterviewMode,
} from '@/lib/interview-client'

// 004-history uzantisi (filtre-arama.md, FR-018..FR-026) — "Gorusmelerim"
// listesinin istemci tarafi filtre/arama mantigi. React'ten bagimsiz saf
// fonksiyonlar; ekran bilesenleri bunlari yalnizca cagirir.
//
// Rozet etiketleri BURADA tek kaynaktan tanimlanir ve interview-card bunlari
// import eder: FR-019 aramayi kartta GORUNEN metinler uzerinde yapar, iki yerde
// ayri sozlukler tutulursa arama sessizce kartla uyumsuzlasir.

export const STATUS_LABEL: Record<InterviewListItem['status'], string> = {
  in_progress: 'Yarım Kaldı',
  completed: 'Tamamlandı',
}

export const REPORT_LABEL: Record<InterviewListItem['reportStatus'], string> = {
  not_applicable: '',
  pending: 'Rapor hazırlanıyor',
  ready: 'Rapor hazır',
  failed: 'Rapor üretilemedi',
}

export const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  intern: 'Giriş',
  junior: 'Orta',
  mid: 'Deneyimli',
  senior: 'Uzman',
}

export const MODE_LABEL: Record<InterviewMode, string> = {
  written: 'Yazılı',
  voice: 'Sözlü',
}

/** Pozisyon cikarilamamis kayitlarda kartta gosterilen metin (FR-019). */
export const UNKNOWN_POSITION = 'Belirsiz pozisyon'

export const LEVEL_ORDER: ExperienceLevel[] = ['intern', 'junior', 'mid', 'senior']
export const MODE_ORDER: InterviewMode[] = ['voice', 'written']

export type StatusFilter = 'all' | 'completed' | 'in_progress'
export const STATUS_ORDER: StatusFilter[] = ['all', 'completed', 'in_progress']
export const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Tümü',
  ...STATUS_LABEL,
}

export interface FilterState {
  /** Serbest metin (FR-019). */
  q: string
  /** Tek secim (FR-018). */
  status: StatusFilter
  /** Cok secim; bos = kisit yok (FR-020). */
  levels: ExperienceLevel[]
  /** Cok secim; bos = kisit yok (FR-020). */
  modes: InterviewMode[]
}

export const EMPTY_FILTERS: FilterState = {
  q: '',
  status: 'all',
  levels: [],
  modes: [],
}

export function isFiltering(filters: FilterState): boolean {
  return (
    filters.q.trim() !== '' ||
    filters.status !== 'all' ||
    filters.levels.length > 0 ||
    filters.modes.length > 0
  )
}

/** "Filtreler" dugmesindeki rozet: acilir paneldeki aktif kisit sayisi. */
export function activeAdvancedCount(filters: FilterState): number {
  return filters.levels.length + filters.modes.length
}

/** Cok secimli sette bir degeri ekler/cikarir. */
export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value]
}

// Turkce kucultme ('İ' -> 'i') + ASCII katlama. Katlama sart: tr locale'de
// 'ANALIST' -> 'analıst' olur ve 'Analisti' ile eslesmez; ayrica kullanici
// siklikla diakritiksiz yazar ('sozlu' -> 'Sözlü' bulmali).
const TR_FOLD: Record<string, string> = {
  ı: 'i',
  ş: 's',
  ğ: 'g',
  ü: 'u',
  ö: 'o',
  ç: 'c',
}

const normalize = (value: string) =>
  value.toLocaleLowerCase('tr').replace(/[ışğüöç]/g, (c) => TR_FOLD[c])

/** Kartta gorunen tum metinler tek dizede — FR-019 arama yuzeyi. */
function searchHaystack(item: InterviewListItem): string {
  return normalize(
    [
      item.position ?? UNKNOWN_POSITION,
      STATUS_LABEL[item.status],
      REPORT_LABEL[item.reportStatus],
      LEVEL_LABEL[item.level],
      MODE_LABEL[item.mode],
    ].join(' '),
  )
}

/** Facet sayaci hesaplanirken haric tutulacak eksen (FR-021). */
type Axis = 'status' | 'levels' | 'modes'

export function applyFilters(
  items: InterviewListItem[],
  filters: FilterState,
  except?: Axis,
): InterviewListItem[] {
  const query = normalize(filters.q.trim())
  return items.filter((item) => {
    if (query && !searchHaystack(item).includes(query)) return false
    if (except !== 'status' && filters.status !== 'all' && item.status !== filters.status)
      return false
    if (except !== 'levels' && filters.levels.length > 0 && !filters.levels.includes(item.level))
      return false
    if (except !== 'modes' && filters.modes.length > 0 && !filters.modes.includes(item.mode))
      return false
    return true
  })
}

export interface FacetCounts {
  status: Record<StatusFilter, number>
  levels: Record<ExperienceLevel, number>
  modes: Record<InterviewMode, number>
}

/**
 * FR-021: her cipin rozeti "bu cipe tiklarsam kac sonuc kalir" sayisidir.
 * Hesap, cipin KENDI seti haric tum aktif kisitlar uygulandiktan sonra yapilir;
 * aksi hâlde ayni setteki cipler birbirinin sayacini sifirlar.
 */
export function facetCounts(
  items: InterviewListItem[],
  filters: FilterState,
): FacetCounts {
  const forStatus = applyFilters(items, filters, 'status')
  const forLevels = applyFilters(items, filters, 'levels')
  const forModes = applyFilters(items, filters, 'modes')

  const count = <T>(list: InterviewListItem[], pick: (i: InterviewListItem) => T, value: T) =>
    list.filter((i) => pick(i) === value).length

  return {
    status: {
      all: forStatus.length,
      completed: count(forStatus, (i) => i.status, 'completed'),
      in_progress: count(forStatus, (i) => i.status, 'in_progress'),
    },
    levels: {
      intern: count(forLevels, (i) => i.level, 'intern'),
      junior: count(forLevels, (i) => i.level, 'junior'),
      mid: count(forLevels, (i) => i.level, 'mid'),
      senior: count(forLevels, (i) => i.level, 'senior'),
    },
    modes: {
      voice: count(forModes, (i) => i.mode, 'voice'),
      written: count(forModes, (i) => i.mode, 'written'),
    },
  }
}
