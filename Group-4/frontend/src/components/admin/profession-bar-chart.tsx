import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AdminStatsResponse } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// 005-admin US3 / T038 (FR-009) — ADR-0011 Recharts, shadcn ChartContainer
// uzerinden (score-trend-chart.tsx ile ayni desen, ek bagimlilik yok).
//
// T043: accessibilityLayer acik + grafigin yaninda METINSEL deger tablosu var
// (docs/TECH_STACK.md Data Visualization notu).

export function ProfessionBarChart({
  data,
}: {
  data: AdminStatsResponse['countsByProfession']
}) {
  const { t } = useTranslation('admin')
  const chartConfig = {
    count: { label: t('professionBarChart.seriesLabel'), color: 'var(--color-accent)' },
  } satisfies ChartConfig
  const sorted = [...data].sort((a, b) => b.count - a.count)

  return (
    <section
      aria-label={t('professionBarChart.heading')}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
    >
      <h2 className="font-display text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
        {t('professionBarChart.heading')}
      </h2>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          {t('professionBarChart.empty')}
        </p>
      ) : (
        <>
          <ChartContainer config={chartConfig} className="mt-3 aspect-auto h-64 w-full">
            <BarChart data={sorted} accessibilityLayer margin={{ left: -20 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>

          {/* Metinsel esdegeri: ekran okuyucu ve grafik render edilemeyen
              ortamlar icin ayni veri (T043). */}
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {sorted.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between border-b border-[var(--color-border)] py-1 last:border-b-0"
              >
                <span
                  className={
                    row.position
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)] italic'
                  }
                >
                  {row.label}
                </span>
                <span className="font-data font-semibold text-[var(--color-text)]">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
