import { useId, useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import {
  LEVEL_LABEL,
  LEVEL_ORDER,
  MODE_LABEL,
  MODE_ORDER,
  STATUS_FILTER_LABEL,
  STATUS_ORDER,
  activeAdvancedCount,
  toggle,
  type FacetCounts,
  type FilterState,
} from '@/lib/interview-filter'

// 004-history uzantisi (filtre-arama.md) — "Gorusmelerim" filtre cubugu.
// Kontrollu bilesen: filtre state'ini disarisi (list.tsx) tutar, burada
// yalnizca acilir panelin acik/kapali olmasi yerel state'tir.

function Chip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string
  count: number
  selected: boolean
  onClick: () => void
}) {
  // FR-021a: sayaci 0 olan cip pasiflesir, AMA secili cip asla pasiflesmez —
  // aksi hâlde kullanici kendi secimini geri alamaz.
  const disabled = count === 0 && !selected
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      // Ekran okuyucu "Senior, 3 sonuc" duysun; gorsel rozet yalnizca sayidir.
      aria-label={`${label}, ${count} sonuç`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-soft)] ${
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]'
      } ${disabled ? 'cursor-not-allowed opacity-40 hover:border-[var(--color-border)] hover:text-[var(--color-text-muted)]' : ''}`}
    >
      {label}
      <span
        className={`font-data text-xs tabular-nums ${
          selected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  )
}

export function InterviewFilterBar({
  filters,
  counts,
  onChange,
}: {
  filters: FilterState
  counts: FacetCounts
  onChange: (next: FilterState) => void
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const searchId = useId()
  const advancedCount = activeAdvancedCount(filters)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56">
          <label htmlFor={searchId} className="sr-only">
            Görüşmelerde ara
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            id={searchId}
            type="search"
            value={filters.q}
            onChange={(e) => onChange({ ...filters, q: e.target.value })}
            placeholder="Pozisyon veya etiket ara..."
            // [&::-webkit-search-cancel-button]: Chromium'un yerlesik temizle
            // ikonu bizimkiyle yan yana cift ikon olusturuyordu.
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted)] py-2 pl-9 pr-9 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filters.q && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, q: '' })}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text)]"
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filtreler
          {advancedCount > 0 && (
            <span className="font-data rounded-full bg-[var(--color-accent-soft)] px-1.5 text-xs text-[var(--color-accent)]">
              {advancedCount}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div role="group" aria-label="Durum" className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((status) => (
          <Chip
            key={status}
            label={STATUS_FILTER_LABEL[status]}
            count={counts.status[status]}
            selected={filters.status === status}
            onClick={() => onChange({ ...filters, status })}
          />
        ))}
      </div>

      {/* Katlanir panel: grid-rows 0fr -> 1fr, ek kutuphane yok. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open
            ? 'grid-rows-[1fr] border-t border-[var(--color-border)] pt-3'
            : 'grid-rows-[0fr]'
        }`}
      >
        <div className="flex flex-col gap-3 overflow-hidden">
          <ChipRow label="Deneyim">
            {LEVEL_ORDER.map((level) => (
              <Chip
                key={level}
                label={LEVEL_LABEL[level]}
                count={counts.levels[level]}
                selected={filters.levels.includes(level)}
                onClick={() => onChange({ ...filters, levels: toggle(filters.levels, level) })}
              />
            ))}
          </ChipRow>
          <ChipRow label="Mod">
            {MODE_ORDER.map((mode) => (
              <Chip
                key={mode}
                label={MODE_LABEL[mode]}
                count={counts.modes[mode]}
                selected={filters.modes.includes(mode)}
                onClick={() => onChange({ ...filters, modes: toggle(filters.modes, mode) })}
              />
            ))}
          </ChipRow>
        </div>
      </div>
    </div>
  )
}
