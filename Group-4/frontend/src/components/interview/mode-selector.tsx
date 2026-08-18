import { isSupported } from '@/lib/voice-client'
import type { InterviewMode } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// FR-025 / ADR-0010 R1: tarayici sesli girisi desteklemiyorsa sozlu mod secenegi
// DEVRE DISI gosterilir; sessiz basarisizlik yok — kullanici neden secemedigini gorur.
// Gorsel katman 007-ui-design/tasks-new-interview-form.md T4 ile pill grubuna
// donustu; erisilebilirlik icin ALTTA hala gercek radio inputlar var (K5),
// yalnizca gorsel olarak `sr-only` ile gizleniyor — testler kirilmiyor.
export function ModeSelector({
  value,
  onChange,
}: {
  value: InterviewMode
  onChange: (mode: InterviewMode) => void
}) {
  const { t } = useTranslation('interview')
  const voiceSupported = isSupported()

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-xs font-medium text-[var(--color-text-muted)]">
        {t('modeSelector.legend')}
      </legend>
      <div className="flex items-center gap-1.5 rounded-lg bg-[var(--color-bg)] p-0.5">
        <label
          className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === 'written'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          <input
            type="radio"
            name="mode"
            checked={value === 'written'}
            onChange={() => onChange('written')}
            className="peer sr-only"
          />
          <span className="peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-soft)]">
            {t('modeSelector.written')}
          </span>
        </label>
        <label
          className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            !voiceSupported ? 'cursor-not-allowed opacity-40' : ''
          } ${
            value === 'voice'
              ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)]'
          }`}
        >
          <input
            type="radio"
            name="mode"
            checked={value === 'voice'}
            disabled={!voiceSupported}
            onChange={() => onChange('voice')}
            className="peer sr-only"
          />
          <span className="peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent-soft)]">
            {t('modeSelector.voice')}
          </span>
        </label>
      </div>
      {!voiceSupported && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('modeSelector.voiceUnsupported')}
        </p>
      )}
    </fieldset>
  )
}
