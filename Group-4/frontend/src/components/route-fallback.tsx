// Route bazli kod bolmenin (App.tsx) Suspense siniri icin gecici ekran.
//
// Bilerek metinsiz: chunk indirmesi hizli aglarda birkac yuz milisaniye surer,
// bu surede yazi gosterip hemen kaldirmak goz yorar. i18n'e de bagli degil —
// dil paketinin kendisi de lazy chunk'la gelebilir.
//
// min-h-[60vh]: kabuk (AppShell) icinde acilirken icerik alaninin cokup tekrar
// buyumesini, yani gecis sirasinda layout sicramasini onler.
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[60vh] w-full items-center justify-center"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      <span className="sr-only">Yukleniyor</span>
    </div>
  )
}
