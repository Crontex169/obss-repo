import { useState } from 'react'
import { CheckCircle2, CircleAlert, Sparkles } from 'lucide-react'
import { ApiError, cvJobMatch, type CvMatchResult } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// "Bu ilana ne kadar uyuyorum?" — gorusme baslatmadan calisan tek LLM cagrisi.
// Sonuc SAKLANMAZ: ilan da CV de degisir, bayat analiz yanlis yonlendirir.
//
// Panel yeni gorusme formunun ICINDE durur: analizi okuyan aday zaten "bu
// ilanla pratik yapayim mi" karari veriyor, ayri bir ekrana gondermek o karari
// bolerdi.
export function CvMatchPanel({
  disabled,
  buildRequest,
}: {
  /** Ilan girdisi henuz eksikse buton pasif (form ile ayni dogrulama). */
  disabled: boolean
  buildRequest: () => Parameters<typeof cvJobMatch>[0]
}) {
  const { t } = useTranslation('interview')
  const [result, setResult] = useState<CvMatchResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function run() {
    setStatus('loading')
    setError('')
    try {
      setResult(await cvJobMatch(buildRequest()))
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      // CV yoksa sunucu NE YAPILACAGINI soyleyen mesaj doner (Ayarlar'dan
      // yukle) — jenerik metinle ezmiyoruz.
      setError(err instanceof ApiError ? err.message : t('cvMatch.failed'))
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            {t('cvMatch.heading')}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('cvMatch.description')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={disabled || status === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles aria-hidden className="size-4" />
          {status === 'loading' ? t('cvMatch.running') : t('cvMatch.run')}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4">
          <div className="flex items-baseline gap-2">
            <span className="font-data text-2xl font-bold text-[var(--color-accent)]">
              {result.matchScore}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              /100 · {t(`cvMatch.bands.${result.band}`)}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text)]">{result.summary}</p>

          {result.matchedSkills.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {t('cvMatch.matched')}
              </span>
              <ul className="flex flex-col gap-1">
                {result.matchedSkills.map((item) => (
                  <li key={item.skill} className="flex gap-2 text-sm text-[var(--color-text)]">
                    <CheckCircle2
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]"
                    />
                    <span>
                      <strong className="font-semibold">{item.skill}</strong>
                      <span className="text-[var(--color-text-muted)]"> — {item.evidence}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.missingSkills.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                {t('cvMatch.missing')}
              </span>
              <ul className="flex flex-col gap-1">
                {/* Zorunlu eksikler once: hazirlik sirasini belirleyen tek sinyal. */}
                {[...result.missingSkills]
                  .sort((a, b) => Number(b.required) - Number(a.required))
                  .map((item) => (
                    <li key={item.skill} className="flex gap-2 text-sm text-[var(--color-text)]">
                      <CircleAlert
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]"
                      />
                      <span>
                        <strong className="font-semibold">{item.skill}</strong>
                        {item.required && (
                          <span className="ml-1 rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
                            {t('cvMatch.required')}
                          </span>
                        )}
                        <span className="text-[var(--color-text-muted)]"> — {item.suggestion}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {result.focusAreas.length > 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              <span className="font-semibold">{t('cvMatch.focus')}:</span>{' '}
              {result.focusAreas.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
