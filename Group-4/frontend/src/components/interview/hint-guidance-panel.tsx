import { useRef, useState } from 'react'
import { Collapsible, Tabs } from 'radix-ui'
import { logPanelEvent } from '@/lib/interview-client'
import { useTranslation } from '@/lib/i18n/language-provider'

type Tab = 'hint' | 'rationale'

// Hikaye 6 (FR-031..FR-034, issue #48): varsayilan KAPALI, kullanici acar;
// "Ipucu" ve "Neden bu soru?" ayri sekmeler; ikisi de yoksa panel hic render
// olmaz. `key={question.id}` ile parent'ta yeniden monte edilir (session.tsx)
// — her soru icin acilis durumu ve loglama sifirdan baslar.
export function HintGuidancePanel({
  interviewId,
  questionOrder,
  tip,
  rationale,
}: {
  interviewId: string
  questionOrder: number
  tip: string | null
  rationale: string | null
}) {
  const { t } = useTranslation('interview')
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('hint')
  // Sekme basina EN FAZLA BIR kez logla (FR-034) — ayni soru icin tekrar
  // ac/kapa veya sekme degistirmede spam log uretilmez.
  const logged = useRef<Set<Tab>>(new Set())

  if (!tip && !rationale) return null

  function logOnce(nextTab: Tab) {
    if (logged.current.has(nextTab)) return
    logged.current.add(nextTab)
    logPanelEvent(interviewId, questionOrder, nextTab)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) logOnce(tab)
  }

  function handleTabChange(next: string) {
    const nextTab = next as Tab
    setTab(nextTab)
    if (open) logOnce(nextTab)
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={handleOpenChange}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <Collapsible.Trigger
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-[var(--color-accent)]"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-base leading-none">
            💡
          </span>
          {open ? t('hintPanel.close') : t('hintPanel.trigger')}
        </span>
        <span aria-hidden className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content className="border-t border-[var(--color-border)] px-4 py-3">
        <Tabs.Root value={tab} onValueChange={handleTabChange}>
          <Tabs.List className="flex gap-2 border-b border-[var(--color-border)]">
            <Tabs.Trigger
              value="hint"
              className="border-b-2 border-transparent px-2 py-2 text-sm font-medium text-[var(--color-text-muted)] data-[state=active]:border-[var(--color-accent)] data-[state=active]:text-[var(--color-accent)]"
            >
              {t('hintPanel.hintTab')}
            </Tabs.Trigger>
            <Tabs.Trigger
              value="rationale"
              className="border-b-2 border-transparent px-2 py-2 text-sm font-medium text-[var(--color-text-muted)] data-[state=active]:border-[var(--color-accent)] data-[state=active]:text-[var(--color-accent)]"
            >
              {t('hintPanel.rationaleTab')}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="hint" className="pt-3 text-sm text-[var(--color-text)]">
            {tip || t('hintPanel.hintEmpty')}
          </Tabs.Content>
          <Tabs.Content value="rationale" className="pt-3 text-sm text-[var(--color-text)]">
            {rationale || t('hintPanel.rationaleEmpty')}
          </Tabs.Content>
        </Tabs.Root>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
