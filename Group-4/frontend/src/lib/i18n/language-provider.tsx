import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import i18n, { LANGUAGE_STORAGE_KEY, type AppLanguage } from './index'

interface LanguageContextValue {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

// i18next zaten kendi context'ini I18nextProvider ile tasir; bu ek context
// sadece "o an secili dil" + "dili degistir" cifti icin ince bir katman —
// bilesenlerin i18n instance'iyla degil, basit bir AppLanguage degeriyle
// ugrasmasini saglar (interview-client.ts / pre-assessment-client.ts gibi
// React-disi dosyalar da dogrudan `i18n.language`'i okuyabilir).
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(
    i18n.language === 'en' ? 'en' : 'tr',
  )

  const setLanguage = useCallback((next: AppLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    void i18n.changeLanguage(next)
    setLanguageState(next)
  }, [])

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={{ language, setLanguage }}>
        {children}
      </LanguageContext.Provider>
    </I18nextProvider>
  )
}

export function useAppLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useAppLanguage, LanguageProvider disinda kullanildi')
  }
  return ctx
}

// react-i18next'in kendi hook'unu tekrar export ediyoruz ki bilesenler tek
// bir yerden import etsin (`@/lib/i18n/language-provider`).
export { useTranslation }
