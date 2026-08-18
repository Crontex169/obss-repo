import { cn } from '@/lib/utils'

// v2.pen "Screen - Landing" Nav > Logo: 112x40 gorsel (images-removebg-preview.png),
// yazi/ikon yok — dogrudan marka gorseli.
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="OBSS"
      width={112}
      height={40}
      className={cn('h-10 w-28 object-contain', className)}
    />
  )
}
