import { useMemo, useState } from 'react'
import {
  MAX_SKILL_TAGS,
  MAX_SKILL_TAG_LENGTH,
  getSkillSuggestions,
} from '@/lib/pre-assessment-options'
import { INPUT_CLASS } from '@/lib/ui-styles'
import { useTranslation } from '@/lib/i18n/language-provider'

// FR-002b — yetenek etiketi girisi: oneri listesinden secim VE serbest yazim.
//
// Oneri listesi kapsayici DEGILDIR (hicbir liste tum meslekleri kapsayamaz);
// bu yuzden serbest giris bilincli olarak aciktir. Sinirlar (adet/uzunluk)
// burada da gosterilir ama ESAS dogrulama sunucudadir (FR-003).
export function SkillTagInput({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
}) {
  const { t } = useTranslation('preAssessment')
  const [draft, setDraft] = useState('')

  const atLimit = value.length >= MAX_SKILL_TAGS
  const skillSuggestions = getSkillSuggestions(t)

  const suggestions = useMemo(() => {
    const query = draft.trim().toLocaleLowerCase('tr')
    return skillSuggestions.filter(
      (s) =>
        !value.includes(s) &&
        (query.length === 0 || s.toLocaleLowerCase('tr').includes(query)),
    ).slice(0, 8)
  }, [draft, value, skillSuggestions])

  function addTag(raw: string) {
    const tag = raw.trim().slice(0, MAX_SKILL_TAG_LENGTH)
    if (!tag || atLimit || value.includes(tag)) return
    onChange([...value, tag])
    setDraft('')
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Enter ve virgul etiketi tamamlar; Backspace bos kutuda sonuncuyu siler.
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(draft)
    } else if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      removeTag(value[value.length - 1])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] py-1 pl-3 pr-1.5 text-xs font-medium text-[var(--color-accent)]">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  disabled={disabled}
                  aria-label={t('skillInput.removeTag', { tag })}
                  className="rounded-full px-1 leading-none hover:bg-[var(--color-accent)] hover:text-[var(--color-on-accent)] disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, MAX_SKILL_TAG_LENGTH))}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(draft)}
        disabled={disabled || atLimit}
        maxLength={MAX_SKILL_TAG_LENGTH}
        placeholder={
          atLimit
            ? t('skillInput.placeholderAtLimit', { max: MAX_SKILL_TAGS })
            : t('skillInput.placeholder')
        }
        aria-label={t('skillInput.addLabel')}
        className={INPUT_CLASS}
      />

      <p className="text-xs text-[var(--color-text-muted)]">
        {t('skillInput.counter', { count: value.length, max: MAX_SKILL_TAGS })}
      </p>

      {suggestions.length > 0 && !atLimit && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              disabled={disabled}
              className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
