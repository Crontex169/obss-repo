import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AdminStatsResponse } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US3 / T040 (FR-012) — ADR-0011 Recharts. Gunluk granularite,
// varsayilan son 30 gun (Clarifications Q3). Veri olmayan gunler sunucuda
// 0 ile doldurulur (research.md §4), cizgi kesintisiz akar.
//
// T043: accessibilityLayer + grafigin yaninda metinsel toplam/tepe ozeti.

const dayFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
})

export function TokenLineChart({
  data,
  windowDays,
  totalCostUsd,
}: {
  data: AdminStatsResponse['dailyTokenUsage']
  windowDays: number
  totalCostUsd: string
}) {
  const { t } = useTranslation('admin')
  const chartConfig = {
    totalTokens: { label: t('tokenLineChart.seriesLabel'), color: 'var(--color-accent)' },
  } satisfies ChartConfig
  const total = data.reduce((sum, d) => sum + d.totalTokens, 0)
  const peak = data.reduce(
    (max, d) => (d.totalTokens > max.totalTokens ? d : max),
    data[0] ?? { date: '', totalTokens: 0 },
  )

  const points = data.map((d) => ({
    ...d,
    label: dayFormat.format(new Date(`${d.date}T00:00:00Z`)),
  }))

  return (
    <section
      aria-label={t('tokenLineChart.heading')}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
          {t('tokenLineChart.heading')}
        </h2>
        <span className="text-xs text-[var(--color-text-muted)]">
          {t('tokenLineChart.windowDays', { count: windowDays })}
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {t('tokenLineChart.empty')}
        </p>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-64 w-full">
            <LineChart data={points} accessibilityLayer margin={{ left: -10 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, _name, item) => (
                      <span className="text-xs">
                        {value} {t('tokenLineChart.seriesLabel')} ·{' '}
                        <span className="font-data">
                          ${(item.payload as { estimatedCostUsd: string }).estimatedCostUsd}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Line
                dataKey="totalTokens"
                stroke="var(--color-totalTokens)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>

          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t('tokenLineChart.windowTotal')}
              </dt>
              <dd className="font-data text-xl font-bold text-[var(--color-text)]">
                {total}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t('tokenLineChart.peakDay')}
              </dt>
              <dd className="font-data text-xl font-bold text-[var(--color-text)]">
                {peak.totalTokens}{' '}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  ({peak.date})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-text-muted)]">
                {t('tokenLineChart.windowCost')}
              </dt>
              <dd className="font-data text-xl font-bold text-[var(--color-text)]">
                ${totalCostUsd}
              </dd>
            </div>
          </dl>
        </>
      )}
    </section>
  )
}
