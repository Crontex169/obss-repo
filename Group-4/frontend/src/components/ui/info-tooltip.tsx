// Imlecle gelince acilan kucuk aciklama balonu (hover-only popup).
export function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[var(--color-border)] text-[10px] font-bold leading-none text-[var(--color-text-muted)]"
      >
        !
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs font-normal text-[var(--color-text)] opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
