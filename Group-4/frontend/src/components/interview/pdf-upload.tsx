import { useState } from 'react'
import { useTranslation } from '@/lib/i18n/language-provider'

const MAX_SIZE_MB = 10

// Istemci tarafi dogrulama yalnizca UX icindir; sunucu ayni kurallari TEKRAR
// dogrular ve baypas edilebilir kabul edilir (Ilke V, contracts/interview-api.md §1).
export function PdfUpload({
  file,
  onChange,
}: {
  file: File | null
  onChange: (file: File | null, error: string) => void
}) {
  const { t } = useTranslation('interview')
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    if (!selected) {
      setError('')
      onChange(null, '')
      return
    }
    if (selected.type !== 'application/pdf') {
      const msg = t('pdfUpload.invalidType')
      setError(msg)
      onChange(null, msg)
      return
    }
    if (selected.size > MAX_SIZE_MB * 1024 * 1024) {
      const msg = t('pdfUpload.tooLarge', { maxSizeMb: MAX_SIZE_MB })
      setError(msg)
      onChange(null, msg)
      return
    }
    setError('')
    onChange(selected, '')
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        className="rounded border border-[var(--color-border)] px-3 py-2"
      />
      {file && <p className="text-sm text-[var(--color-text-muted)]">{file.name}</p>}
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  )
}
