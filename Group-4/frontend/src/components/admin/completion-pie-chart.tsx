import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AdminStatsResponse } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US3 / T039 (FR-011) — ADR-0011 Recharts.
// T043: accessibilityLayer + grafigin yaninda metinsel sayi/yuzde ozeti.

export function CompletionPieChart({
  ratio,
}: {
  ratio: AdminStatsResponse['completionRatio']
}) {
  const { t } = useTranslation('admin')
  const chartConfig = {
    completed: { label: t('interviewDetail.completed'), color: 'var(--color-success)' },
    inProgress: { label: t('interviewDetail.incomplete'), color: 'var(--color-warning)' },
  } satisfies ChartConfig
  const total = ratio.completed + ratio.inProgress
  const percent = total === 0 ? null : Math.round((ratio.completed / total) * 100)

  const data = [
    { key: 'completed', label: t('interviewDetail.completed'), value: ratio.completed },
    { key: 'inProgress', label: t('interviewDetail.incomplete'), value: ratio.inProgress },
  ]

  return (
    <section
      aria-label={t('completionPieChart.heading')}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
    >
      <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
        {t('completionPieChart.heading')}
      </h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {t('completionPieChart.empty')}
        </p>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-48 w-full">
            <PieChart accessibilityLayer>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={45} strokeWidth={2}>
                {data.map((entry) => (
                  <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">{t('interviewDetail.completed')}</dt>
              <dd className="font-data text-xl font-bold text-[var(--color-success)]">
                {ratio.completed}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">{t('interviewDetail.incomplete')}</dt>
              <dd className="font-data text-xl font-bold text-[var(--color-warning)]">
                {ratio.inProgress}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">{t('completionPieChart.ratio')}</dt>
              <dd className="font-data text-xl font-bold text-[var(--color-text)]">
                %{percent}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  )
}
