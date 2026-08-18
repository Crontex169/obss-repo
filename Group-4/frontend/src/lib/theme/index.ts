// Tema tercihi — dil tercihiyle AYNI desen (bkz. lib/i18n/index.ts):
// localStorage'da tutulur, oturumlar arasi kalicidir, backend'e gitmez.
//
// Iki secenek: 'light' | 'dark'. "Sistem tercihini takip et" BILINCLI OLARAK
// yok — tercih tek ve acikca okunabilir kalsin diye. Hic secim yapilmamissa
// varsayilan acik tema (mevcut gorunum yeni kullanicida degismez).
export const THEME_STORAGE_KEY = 'app-theme'

export type AppTheme = 'light' | 'dark'

export function readStoredTheme(): AppTheme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    // Gizli sekme / storage kapali: tema calismaya devam etsin, sadece kalici olmasin.
    return 'light'
  }
}

// Tek uygulama noktasi: <html data-theme="...">. index.css'teki
// :root[data-theme="dark"] blogu buradan tetiklenir. Ayni mantik index.html'de
// ilk boyamadan once satir ici olarak da calisir (tema sicramasini onler) —
// oradaki kopya bilinclidir, React yuklenmeden once calismak zorunda.
export function applyTheme(theme: AppTheme): void {
  document.documentElement.dataset.theme = theme
}
