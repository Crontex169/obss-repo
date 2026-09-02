// DOSYA REHBERİ: Raporun görsel gövdesi (radar grafiği + skorlar + metin
// blokları). İki ekran birden kullanır: sahibinin gördüğü görüşme raporu ve
// paylaşım linkiyle açılan herkese açık rapor — ikisinin AYNI görünmesi
// gerektiği için bileşen tek yerde durur.
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import type { Report } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// ADR-0011: Recharts, shadcn ChartContainer uzerinden. accessibilityLayer ACIK
// degil — skorlar zaten METIN olarak da veriliyor (ADR-0011 / R2, asagida).
const chartConfig = {
  score: { label: 'Skor', color: 'var(--color-accent)' },
} satisfies ChartConfig

export function ReportSections({ report }: { report: Report }) {
  const { t } = useTranslation('interview')
  const axes = [
    { axis: t('report.axisTechnical'), score: report.technicalScore },
    { axis: t('report.axisBehavioral'), score: report.behavioralScore },
    { axis: t('report.axisGeneral'), score: report.generalScore },
  ]

  return (
    <>
      {/* Ortalama skor METIN olarak grafigin yaninda gosterilir (FR-026, Ilke VII, ADR-0011/R2). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <span className="font-medium text-[var(--color-text)]">{t('report.overallScore')}</span>
        <span className="text-2xl font-semibold text-[var(--color-accent)]">
          {report.overallScore}/100
        </span>
      </div>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-72">
          {/* margin/outerRadius: varsayilan 5px kenar bosluğu "Genel
              Yetkinlik" gibi uzun eksen etiketlerini konteynerin disina
              tasirip kirpiyordu — etiketlere yer acmak icin buyutuldu. */}
          {/* accessibilityLayer=false: burada Tooltip yok, skorlar zaten
              METIN olarak asagida veriliyor (ADR-0011/R2) — acik birakilirsa
              Recharts SVG'yi tabIndex=0 yapiyor ve tiklamada tarayicinin
              varsayilan odak cercevesi (siyah kutu) + rastgele bir "aktif
              nokta" gorunuyor, hicbir bilgi tasimadan. */}
          <RadarChart
            data={axes}
            accessibilityLayer={false}
            outerRadius="60%"
            margin={{ top: 16, right: 32, bottom: 16, left: 56 }}
          >
            <PolarGrid />
            <PolarAngleAxis dataKey="axis" />
            {/* PDF ciktisi (report-pdf.ts drawRadar) skoru sabit 0-100
                olcekte cizer; ayni sabit olcek burada da kilitlenmezse
                Recharts eksenini veriye gore otomatik olceklendirip web ve
                PDF gorunumlerini tutarsiz hale getirir. */}
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              dataKey="score"
              fill="var(--color-score)"
              fillOpacity={0.5}
              stroke="var(--color-score)"
              activeDot={false}
            />
          </RadarChart>
        </ChartContainer>

        {/* Skorlar METIN olarak da: grafik tek bilgi kaynagi degil (ADR-0011 / R2). */}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {axes.map((a) => (
            <div key={a.axis}>
              <dt className="text-xs text-[var(--color-text-muted)] sm:text-sm">{a.axis}</dt>
              <dd className="font-data mt-0.5 text-lg font-semibold text-[var(--color-text)] sm:text-2xl">
                {a.score}/100
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <TextBlock title={t('report.overallImpression')}>
        <p className="break-words text-[var(--color-text)]">{report.overallImpression}</p>
      </TextBlock>

      <TextBlock title={t('report.strengths')}>
        <BulletList items={report.strengths} />
      </TextBlock>

      <TextBlock title={t('report.improvementAreas')}>
        <BulletList items={report.improvementAreas} />
      </TextBlock>

      {report.additionalNotes.length > 0 && (
        <TextBlock title={t('report.additionalNotes')}>
          <BulletList items={report.additionalNotes} />
        </TextBlock>
      )}
    </>
  )
}

function TextBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h2 className="font-display mb-2 font-semibold text-[var(--color-text)]">{title}</h2>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-inside list-disc break-words text-[var(--color-text)]">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}
