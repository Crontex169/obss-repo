import * as React from "react"

import { cn } from "@/lib/utils"

// shadcn/ui "new-york" Table — `npx shadcn add table` ile alindi, RENK
// siniflari bu projenin tasarim token'larina baglandi.
//
// Neden: shadcn'in varsayilan semantik renkleri (`bg-muted`, `text-foreground`,
// `border`) bir `@theme` katmani gerektirir; bu proje ise renkleri dogrudan
// `--color-*` degiskenleriyle tasiyor (`src/index.css`) ve boyle bir katman
// tanimlamiyor. shadcn bilesenleri repoya KOPYALANIP duzenlenmek uzere
// tasarlandigi icin dogru cozum, token katmani eklemek (uygulama genelinde
// `--color-accent`/`--color-border` ile ad cakismasi riski) yerine burada
// yeniden hedeflemek. Yapi, `data-slot`'lar ve API shadcn ile birebir kalir.

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-[var(--color-border)]", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-[var(--color-border)] bg-[var(--color-bg-muted)]/60 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-accent-soft)]/40 has-aria-expanded:bg-[var(--color-bg-muted)]/60 data-[state=selected]:bg-[var(--color-bg-muted)]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-[var(--color-text-muted)] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-[var(--color-text-muted)]", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
