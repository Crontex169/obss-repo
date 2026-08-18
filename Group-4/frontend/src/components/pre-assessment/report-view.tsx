import type { CompetencyReport } from '@/lib/pre-assessment-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// FR-014: "AI tarafından üretildi" rozeti + güven seviyesi HER ZAMAN görünür.
// FR-006b: sayısal skor ve grafik YOK — 1-5 öz-değerlendirme puanları rapora
// puan olarak yansıtılmaz.
// FR-006 (2026-08-04): mesleğe/sektöre göre bölümlenmiş yapı YOK ve öğrenme yol
// haritası YOK. Bunlar bilinçli kapsam kararları, eksik özellik değil.
//
// NOT: report.genelOzet / calismaTarziOzeti / gucluYonler / gelisimAlanlari
// LLM URETIMI icerik (PreAssessment.language'e gore) — t() ile CEVRILMEZ,
// sadece cevrelerindeki basliklar/etiketler cevrilir.
export function ReportView({ report }: { report: CompetencyReport }) {
  const { t } = useTranslation('preAssessment')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-display text-xl font-bold text-[var(--color-text)]">
          {t('reportView.heading')}
        </h2>
        <span className="rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-xs font-medium text-[var(--color-accent)]">
          {t('reportView.aiBadge')}
        </span>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <dt className="text-sm text-[var(--color-text-muted)]">{t('reportView.confidenceLabel')}</dt>
        <dd className="mt-0.5 font-semibold text-[var(--color-text)]">
          {t(`reportView.confidence.${report.guvenSeviyesi}`)}
        </dd>
        <p className="mt-3 text-[var(--color-text)]">{report.genelOzet}</p>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
        <h3 className="font-display mb-2 font-semibold text-[var(--color-text)]">
          {t('reportView.workStyleHeading')}
        </h3>
        <p className="text-[var(--color-text)]">{report.calismaTarziOzeti}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Block title={t('reportView.strengthsHeading')} items={report.gucluYonler} />
        <Block title={t('reportView.improvementAreasHeading')} items={report.gelisimAlanlari} />
      </div>
    </div>
  )
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h3 className="font-display mb-2 font-semibold text-[var(--color-text)]">
        {title}
      </h3>
      <ul className="list-inside list-disc text-sm text-[var(--color-text)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
