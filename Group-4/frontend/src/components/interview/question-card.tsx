import { useState } from 'react'
import { CheckIcon, PencilIcon } from 'lucide-react'
import type { Question } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// Coktan secmeli: dikey tiklanabilir liste (secilen deger options'tan biri olmak
// ZORUNDA — sunucu ayrica dogrular, FR-008). Acik uclu: serbest metin alani.
//
// Sozlu modda ayni alan transkripti tasir (ADR-0010/R2: gonderim oncesi
// gorunur ve DUZENLENEBILIR olmali). Varsayilan gorunum duz metindir —
// konusurken yazi akar, yazi alani gurultusu yok; duzeltme kalem ikonuyla
// acilir. Metin GIZLENMEZ, yalnizca duzenleme kapali baslar.
export function QuestionCard({
  question,
  value,
  onChange,
  disabled,
  voice = false,
}: {
  question: Question
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  voice?: boolean
}) {
  const { t } = useTranslation('interview')
  const [editing, setEditing] = useState(false)
  const showTranscript = voice && !editing

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-4 shadow">
      <p className="font-medium break-words text-[var(--color-text)]">{question.text}</p>

      {question.type === 'multiple_choice' ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <label
              key={option}
              className="flex items-start gap-2 rounded border border-[var(--color-border)] px-3 py-2.5 text-sm break-words"
            >
              <input
                type="radio"
                name={`question-${question.order}`}
                value={option}
                checked={value === option}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              {option}
            </label>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-2">
          {showTranscript ? (
            <p className="min-h-5 flex-1 whitespace-pre-wrap text-sm text-[var(--color-text)]">
              {value || (
                <span className="italic text-[var(--color-text-muted)]">
                  {t('questionCard.transcriptPlaceholder')}
                </span>
              )}
            </p>
          ) : (
            <textarea
              rows={5}
              value={value}
              disabled={disabled}
              // Kalemle acildiginda odak dogrudan metne gider; yazili modda
              // odagi calmaz (orada bu dal zaten ilk render'dir).
              autoFocus={voice}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('questionCard.answerPlaceholder')}
              className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[var(--color-text)]"
            />
          )}

          {voice && (
            <button
              type="button"
              onClick={() => setEditing((current) => !current)}
              disabled={disabled}
              aria-label={t(editing ? 'questionCard.editDone' : 'questionCard.edit')}
              title={t(editing ? 'questionCard.editDone' : 'questionCard.edit')}
              className="rounded-md border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            >
              {editing ? (
                <CheckIcon aria-hidden className="size-3.5" />
              ) : (
                <PencilIcon aria-hidden className="size-3.5" />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
