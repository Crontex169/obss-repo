// Formlarda (auth, yeni görüşme) tekrar eden Tailwind sınıf setleri —
// tutarlı görünüm için tek yerden paylaşılır.
export const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-soft)]'

// Dolgu rengi accent DEGIL accent-strong: beyaz metin #00A3E0 uzerinde 2.87:1
// (AA'nin 4.5:1 esigini gecmez), #0077A3 uzerinde 5.03:1 (007-ui-design K5).
// Hover'da brightness ile koyulastirilir; ayri bir token gerekmiyor.
// BUTTON_BASE genislik VERMEZ (007-ui-design/tasks-new-interview-form.md T6):
// yeni gorusme formunun aksiyon butonu sagda oturur, auth formlarindaki tam
// genislikli buton BUTTON_CLASS ile degismeden kalir.
export const BUTTON_BASE =
  'rounded-lg bg-[var(--color-accent-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] transition-[filter] hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50'
export const BUTTON_CLASS = `w-full ${BUTTON_BASE}`
