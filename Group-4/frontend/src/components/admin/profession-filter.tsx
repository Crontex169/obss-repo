import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UNSPECIFIED_POSITION } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US1 / T018 (FR-003) — shadcn/ui Select (plan.md).
//
// "Belirsiz" SABIT bir secenektir: position=null kayitlar sessizce goz ardi
// edilmez, kendi kovasindan erisilebilir (spec Edge Cases).
//
// Radix Select bos string'i deger olarak KABUL ETMEZ ("" ic temizleme degeri
// icin ayrilmistir), bu yuzden "filtre yok" durumu icin ALL nobetci degeri
// kullanilir; disariya donen sozlesme yine '' (filtre yok) olarak kalir.
const ALL = 'all'

export function ProfessionFilter({
  professions,
  value,
  onChange,
}: {
  /** Sunucudan gelen ayirt edici pozisyon degerleri (null haric). */
  professions: string[]
  /** '' = filtre yok, 'unspecified' = Belirsiz kovasi. */
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
      {/* Radix tetikleyicisi bir <button>; native <label for> yerine
          aria-labelledby ile iliskilendirilir. */}
      <span
        id="admin-profession-filter-label"
        className="text-sm font-medium text-[var(--color-text-muted)]"
      >
        {t('professionFilter.label')}
      </span>
      <Select
        value={value === '' ? ALL : value}
        onValueChange={(next) => onChange(next === ALL ? '' : next)}
      >
        <SelectTrigger
          id="admin-profession-filter"
          aria-labelledby="admin-profession-filter-label"
          className="min-w-44 sm:min-w-52"
        >
          <SelectValue placeholder={t('professionFilter.all')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('professionFilter.all')}</SelectItem>
          {professions.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={UNSPECIFIED_POSITION}>{t('professionFilter.unspecified')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
