import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import trCommon from './locales/tr/common.json'
import trAppShell from './locales/tr/appShell.json'
import trSettings from './locales/tr/settings.json'
import trHome from './locales/tr/home.json'
import trAuth from './locales/tr/auth.json'
import trDashboard from './locales/tr/dashboard.json'
import trInterview from './locales/tr/interview.json'
import trPreAssessment from './locales/tr/preAssessment.json'
import trKvkkConsent from './locales/tr/kvkkConsent.json'
import trTerms from './locales/tr/terms.json'
import trConsentGate from './locales/tr/consentGate.json'
import trSupport from './locales/tr/support.json'
import trAdminShell from './locales/tr/adminShell.json'
import trAdmin from './locales/tr/admin.json'
import trBilling from './locales/tr/billing.json'

import enCommon from './locales/en/common.json'
import enAppShell from './locales/en/appShell.json'
import enSettings from './locales/en/settings.json'
import enHome from './locales/en/home.json'
import enAuth from './locales/en/auth.json'
import enDashboard from './locales/en/dashboard.json'
import enInterview from './locales/en/interview.json'
import enPreAssessment from './locales/en/preAssessment.json'
import enKvkkConsent from './locales/en/kvkkConsent.json'
import enTerms from './locales/en/terms.json'
import enConsentGate from './locales/en/consentGate.json'
import enSupport from './locales/en/support.json'
import enAdminShell from './locales/en/adminShell.json'
import enAdmin from './locales/en/admin.json'
import enBilling from './locales/en/billing.json'

// Butun namespace'ler bundle'a gomulu (lazy-load/http-backend YOK) — 2 sabit
// dil disinda genisleme beklenmiyor.
export const LANGUAGE_STORAGE_KEY = 'app-language'

export type AppLanguage = 'tr' | 'en'

function initialLanguage(): AppLanguage {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return stored === 'en' ? 'en' : 'tr'
}

void i18n.use(initReactI18next).init({
  lng: initialLanguage(),
  fallbackLng: 'tr',
  defaultNS: 'common',
  ns: [
    'common',
    'appShell',
    'settings',
    'home',
    'auth',
    'dashboard',
    'interview',
    'preAssessment',
    'kvkkConsent',
    'terms',
    'consentGate',
    'adminShell',
    'admin',
    'support',
    'billing',
  ],
  resources: {
    tr: {
      common: trCommon,
      appShell: trAppShell,
      settings: trSettings,
      home: trHome,
      auth: trAuth,
      dashboard: trDashboard,
      interview: trInterview,
      preAssessment: trPreAssessment,
      kvkkConsent: trKvkkConsent,
      terms: trTerms,
      consentGate: trConsentGate,
      adminShell: trAdminShell,
      admin: trAdmin,
      support: trSupport,
      billing: trBilling,
    },
    en: {
      common: enCommon,
      appShell: enAppShell,
      settings: enSettings,
      home: enHome,
      auth: enAuth,
      dashboard: enDashboard,
      interview: enInterview,
      preAssessment: enPreAssessment,
      kvkkConsent: enKvkkConsent,
      terms: enTerms,
      consentGate: enConsentGate,
      adminShell: enAdminShell,
      admin: enAdmin,
      support: enSupport,
      billing: enBilling,
    },
  },
  interpolation: {
    escapeValue: false, // React zaten XSS'e karsi kaciyor.
  },
  returnNull: false,
})

export default i18n
