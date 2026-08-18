import type {
  AnsweredPair,
  QuestionFeedback,
  Verdict,
} from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

// T030 - US3 (FR-007): tamamlanmis bir gorusmenin soru/cevap ciftlerini
// sirayla, degistirilmeden gosterir.
//
// Issue #68: rapor hazirsa her cifte soru bazli geri bildirim eklenir — durum
// rozeti + katlanir "dogru cevap ve aciklama". Geri bildirim MULAKAT SIRASINDA
// gosterilmez (adaptif akisi ve sonraki cevaplari kirletirdi); bu bilesen zaten
// yalnizca tamamlanmis gorusme ekraninda kullaniliyor ve `feedback` prop'u
// rapor yoksa bos gelir.

const VERDICT_STYLE: Record<Verdict, { icon: string; className: string }> = {
  // Renk TEK sinyal degil: ikon + metin etiketi + renk birlikte (Ilke VII).
  dogru: {
    icon: '✓',
    className:
      'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]',
  },
  kismen: {
    icon: '◑',
    className:
      'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]',
  },
  yetersiz: {
    icon: '!',
    className:
      'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]',
  },
}

const VERDICT_ORDER: Verdict[] = ['dogru', 'kismen', 'yetersiz']

export function QuestionAnswerList({
  pairs,
  feedback = [],
}: {
  pairs: AnsweredPair[]
  feedback?: QuestionFeedback[]
}) {
  const { t } = useTranslation('interview')
  const byOrder = new Map(feedback.map((f) => [f.order, f]))

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-[var(--color-surface)] p-4 shadow">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-medium text-[var(--color-text)]">
          {t('questionAnswerList.heading')}
        </h2>
        {feedback.length > 0 && <VerdictSummary feedback={feedback} />}
      </div>

      {pairs.map((pair) => (
        <div
          key={pair.order}
          className="flex flex-col gap-1 border-b border-[var(--color-bg-muted)] pb-3 last:border-0 last:pb-0"
        >
          <p className="text-sm font-medium text-[var(--color-text)]">
            {pair.order}. {pair.text}
          </p>
          <p className="rounded-lg bg-[var(--color-bg-muted)] p-2 text-sm text-[var(--color-text)]">
            {pair.answer.content}
          </p>
          <FeedbackBlock
            feedback={byOrder.get(pair.order)}
            isMultipleChoice={pair.type === 'multiple_choice'}
          />
        </div>
      ))}
    </section>
  )
}

// Ozet serit: kullanici tek tek karti acmadan nerede durdugunu gorur
// (degerlendirme raporlarinin standart acilisi).
function VerdictSummary({ feedback }: { feedback: QuestionFeedback[] }) {
  const { t } = useTranslation('interview')
  const counts = VERDICT_ORDER.map((verdict) => ({
    verdict,
    count: feedback.filter((f) => f.verdict === verdict).length,
  })).filter((entry) => entry.count > 0)

  return (
    <ul className="flex flex-wrap items-center gap-2">
      {counts.map(({ verdict, count }) => (
        <li key={verdict}>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[verdict].className}`}
          >
            <span aria-hidden="true">{VERDICT_STYLE[verdict].icon}</span>
            {count} {t(`questionAnswerList.verdict.${verdict}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function FeedbackBlock({
  feedback,
  isMultipleChoice,
}: {
  feedback: QuestionFeedback | undefined
  isMultipleChoice: boolean
}) {
  const { t } = useTranslation('interview')
  if (!feedback) return null

  const style = VERDICT_STYLE[feedback.verdict]

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <span
        className={`self-start inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
      >
        <span aria-hidden="true">{style.icon}</span>
        {t(`questionAnswerList.verdict.${feedback.verdict}`)}
      </span>

      {/* <details>: acilir panel icin JS/state gerekmez, klavye ve ekran
          okuyucu davranisi tarayicidan gelir. Dogru cevaplananlar KAPALI
          baslar (rapor sisirmesin), yanlis/eksik olanlar ACIK — issue #68'in
          asil istedigi bilgi tikla-bul ardina gizlenmemeli. */}
      <details open={feedback.verdict !== 'dogru'} className="text-sm">
        <summary className="cursor-pointer text-[var(--color-accent)]">
          {isMultipleChoice
            ? t('questionAnswerList.correctAnswerLabel')
            : t('questionAnswerList.expectedAnswerLabel')}
        </summary>
        <div className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-[var(--color-border)] pl-3">
          <p className="break-words text-[var(--color-text)]">
            {feedback.correctAnswer}
          </p>
          <p className="break-words text-[var(--color-text-muted)]">
            {feedback.explanation}
          </p>
        </div>
      </details>
    </div>
  )
}
