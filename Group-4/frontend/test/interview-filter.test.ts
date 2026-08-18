import { describe, it, expect } from 'vitest'
import type { InterviewListItem } from '@/lib/interview-client'
import {
  EMPTY_FILTERS,
  applyFilters,
  facetCounts,
  isFiltering,
  toggle,
} from '@/lib/interview-filter'

// 004-history uzantisi (filtre-arama.md FR-018..FR-021) — saf filtre mantigi.
const base: InterviewListItem = {
  id: 'iv-1',
  position: 'Backend Gelistirici',
  status: 'completed',
  reportStatus: 'ready',
  mode: 'written',
  level: 'senior',
  language: 'tr',
  questionCount: 5,
  createdAt: '2026-08-01T00:00:00.000Z',
  completedAt: '2026-08-01T01:00:00.000Z',
}

const items: InterviewListItem[] = [
  base,
  {
    ...base,
    id: 'iv-2',
    position: 'Data Analisti',
    status: 'in_progress',
    reportStatus: 'not_applicable',
    mode: 'voice',
    level: 'junior',
    completedAt: null,
  },
  {
    ...base,
    id: 'iv-3',
    position: null,
    status: 'completed',
    reportStatus: 'failed',
    mode: 'voice',
    level: 'intern',
  },
]

const ids = (list: InterviewListItem[]) => list.map((i) => i.id)

describe('applyFilters', () => {
  it('FR-018: durum filtresi tek secimlidir, all hepsini dondurur', () => {
    expect(ids(applyFilters(items, EMPTY_FILTERS))).toEqual(['iv-1', 'iv-2', 'iv-3'])
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, status: 'in_progress' }))).toEqual([
      'iv-2',
    ])
  })

  it('FR-019: pozisyonda buyuk/kucuk harf duyarsiz arar', () => {
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'BACK' }))).toEqual(['iv-1'])
  })

  it('FR-019: rozet metinlerinde de arar (seviye, mod, durum, rapor)', () => {
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'uzman' }))).toEqual(['iv-1'])
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'Sözlü' }))).toEqual(['iv-2', 'iv-3'])
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'Rapor üretilemedi' }))).toEqual([
      'iv-3',
    ])
  })

  it('FR-019: pozisyonu null olan kayit "Belirsiz pozisyon" ile eslesir', () => {
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'belirsiz' }))).toEqual(['iv-3'])
  })

  it('FR-019a: ASCII katlama — buyuk I ve diakritiksiz yazim eslesir', () => {
    // tr locale'de 'ANALIST' -> 'analıst'; katlama olmadan eslesmezdi.
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'ANALIST' }))).toEqual(['iv-2'])
    // Kullanici diakritiksiz yaziyor: 'sozlu' -> 'Sözlü'.
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'sozlu' }))).toEqual(['iv-2', 'iv-3'])
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, q: 'gelistirici' }))).toEqual(['iv-1'])
  })

  it('FR-020: set icinde OR, setler arasinda AND uygulanir', () => {
    expect(
      ids(applyFilters(items, { ...EMPTY_FILTERS, levels: ['junior', 'senior'] })),
    ).toEqual(['iv-1', 'iv-2'])
    expect(
      ids(applyFilters(items, { ...EMPTY_FILTERS, levels: ['junior', 'senior'], modes: ['voice'] })),
    ).toEqual(['iv-2'])
  })

  it('FR-020: bos set kisit getirmez', () => {
    expect(ids(applyFilters(items, { ...EMPTY_FILTERS, levels: [], modes: [] }))).toHaveLength(3)
  })
})

describe('facetCounts', () => {
  it('FR-021: sayaclar arama ve diger setlerle daralir', () => {
    const counts = facetCounts(items, { ...EMPTY_FILTERS, modes: ['voice'] })
    expect(counts.status).toEqual({ all: 2, completed: 1, in_progress: 1 })
    expect(counts.levels).toEqual({ intern: 1, junior: 1, mid: 0, senior: 0 })
  })

  it('FR-021: bir cipin sayaci kendi seti haric hesaplanir', () => {
    // Junior secili olsa bile Senior cipi kendi sayacini korur; aksi hâlde
    // ayni setteki cipler birbirini sifirlar ve coklu secim imkansizlasir.
    const counts = facetCounts(items, { ...EMPTY_FILTERS, levels: ['junior'] })
    expect(counts.levels).toEqual({ intern: 1, junior: 1, mid: 0, senior: 1 })
    // Durum ekseni ise levels kisitini gorur.
    expect(counts.status).toEqual({ all: 1, completed: 0, in_progress: 1 })
  })
})

describe('yardimcilar', () => {
  it('toggle ekler ve cikarir', () => {
    expect(toggle<string>([], 'a')).toEqual(['a'])
    expect(toggle(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('isFiltering yalnizca aktif kisitta true doner', () => {
    expect(isFiltering(EMPTY_FILTERS)).toBe(false)
    expect(isFiltering({ ...EMPTY_FILTERS, q: '   ' })).toBe(false)
    expect(isFiltering({ ...EMPTY_FILTERS, modes: ['voice'] })).toBe(true)
  })
})
