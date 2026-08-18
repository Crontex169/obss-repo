import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { applyTheme, readStoredTheme, THEME_STORAGE_KEY, type AppTheme } from './index'

interface ThemeContextValue {
  theme: AppTheme
  setTheme: (theme: AppTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// LanguageProvider ile ayni ince katman: "o an secili tema" + "temayi degistir".
// Tema degisimi YALNIZCA <html data-theme> ozniteligini ve bu context degerini
// gunceller — hicbir agac yeniden mount EDILMEZ, bu yuzden form doldururken
// tema degistirmek girilen veriyi kaybettirmez.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme)

  // index.html'deki satir ici script tema'yi ilk boyamadan once uygular; bu
  // efekt onun agi degildir, guvenlik agidir: script hic calismadiysa (eski
  // sekme, farkli giris noktasi) React yine de dogru temayi uygular.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: AppTheme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Kalici olamadi; oturum icinde yine de uygulanir.
    }
    applyTheme(next)
    setThemeState(next)
  }, [])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useAppTheme, ThemeProvider disinda kullanildi')
  }
  return ctx
}
