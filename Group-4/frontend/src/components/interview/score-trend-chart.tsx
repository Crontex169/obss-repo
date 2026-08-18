import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { ScoreTrendPoint } from '@/lib/score-trend'
import { useTranslation } from '@/lib/i18n/language-provider'

// T050 (US5, FR-017) - ADR-0011: Recharts, shadcn ChartContainer uzerinden
// (report.tsx'teki radar grafikle ayni desen, ek bagimlilik yok).
// chartConfig, legend/tooltip'te GORUNUR label icerdigi icin bilesen icine
// tasindi (t() erisimi icin) — modul seviyesinde sabit KALSAYDI cevrilemezdi.
export function ScoreTrendChart({ points }: { points: ScoreTrendPoint[] }) {
  const { t, i18n } = useTranslation('interview')
  const chartConfig = {
    technicalScore: { label: t('report.axisTechnical'), color: 'var(--color-accent)' },
    // Grafik cizgileri de tema token'i okur — koyu temada yesil/gri tonlari
    // koyu zeminde okunacak sekilde acilir (index.css koyu blok).
    behavioralScore: { label: t('report.axisBehavioral'), color: 'var(--color-success)' },
    generalScore: { label: t('report.axisGeneral'), color: 'var(--color-text-muted)' },
  } satisfies ChartConfig
  const data = points.map((p) => ({
    ...p,
    label: new Date(p.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'tr-TR'),
  }))

  return (
    <section className="rounded-xl bg-[var(--color-surface)] p-4 shadow">
      <h2 className="mb-2 font-medium text-[var(--color-text)]">
        {t('scoreTrend.heading')}
      </h2>
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
        <LineChart data={data} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line dataKey="technicalScore" stroke="var(--color-technicalScore)" strokeWidth={2} dot />
          <Line dataKey="behavioralScore" stroke="var(--color-behavioralScore)" strokeWidth={2} dot />
          <Line dataKey="generalScore" stroke="var(--color-generalScore)" strokeWidth={2} dot />
        </LineChart>
      </ChartContainer>
    </section>
  )
}
