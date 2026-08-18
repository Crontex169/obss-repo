import { Link } from 'react-router-dom'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminInterviewListItem } from '@/lib/admin-client'
import { useTranslation } from '@/lib/i18n/language-provider'
import { cn } from '@/lib/utils'

// 005-admin US1 / T017 (FR-002, FR-004) — shadcn/ui Table bilesenleri (plan.md).
// FR-008: bu tabloda hicbir yazma aksiyonu (sil/duzenle) RENDER EDILMEZ.

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso))
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'success' | 'warning' | 'danger'
}) {
  const tones = {
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
  }
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function InterviewTable({ items }: { items: AdminInterviewListItem[] }) {
  const { t } = useTranslation('admin')
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <Table className="min-w-[38rem]">
        <TableCaption className="sr-only">
          {t('table.caption')}
        </TableCaption>
        <TableHeader>
          <TableRow className="bg-[var(--color-bg-muted)]/60 hover:bg-[var(--color-bg-muted)]/60">
            <TableHead className="px-4 py-3">{t('table.user')}</TableHead>
            <TableHead className="px-4 py-3">{t('table.position')}</TableHead>
            <TableHead className="px-4 py-3">{t('table.createdAt')}</TableHead>
            <TableHead className="px-4 py-3">{t('table.status')}</TableHead>
            <TableHead className="px-4 py-3 text-right">
              <span className="sr-only">{t('table.detail')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(item.deletedAt && 'bg-[var(--color-danger-soft)]/30')}
            >
              {/* E-posta bosluksuz tek kelimedir; whitespace-nowrap (TableCell
                  varsayilani) onu tek satira zorlayip tabloyu gereksiz
                  genisletiyordu. */}
              <TableCell className="px-4 py-3 font-medium break-all whitespace-normal text-[var(--color-text)]">
                {item.ownerEmail}
              </TableCell>
              <TableCell className="px-4 py-3 whitespace-normal">
                <span
                  className={cn(
                    item.position
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)] italic',
                  )}
                >
                  {item.positionLabel}
                </span>
              </TableCell>
              <TableCell className="font-data px-4 py-3 text-[var(--color-text-muted)]">
                {formatDate(item.createdAt)}
              </TableCell>
              <TableCell className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.status === 'completed' ? (
                    <Pill tone="success">{t('interviewDetail.completed')}</Pill>
                  ) : (
                    <Pill tone="warning">{t('interviewDetail.incomplete')}</Pill>
                  )}
                  {/* FR-004: kullanici silse de kayit listede kalir. */}
                  {item.deletedAt && <Pill tone="danger">{t('interviewDetail.deleted')}</Pill>}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-right">
                <Link
                  to={`/admin/interview/${item.id}`}
                  className="rounded-md px-2.5 py-1 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-strong)]"
                >
                  {t('table.detail')}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
