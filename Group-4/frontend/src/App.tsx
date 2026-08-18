import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { LanguageProvider } from '@/lib/i18n/language-provider'
import { ThemeProvider } from '@/lib/theme/theme-provider'
import HomePage from '@/pages/home'
import { RouteFallback } from '@/components/route-fallback'
import { ProtectedRoute } from '@/routes/protected'
import { AdminProtectedRoute } from '@/routes/admin-protected'
import { AppShell } from '@/components/app-shell'
import { AdminShell } from '@/components/admin/admin-shell'
import { ConsentGateDialog } from '@/components/consent-gate-dialog'

// Route bazli kod bolme (code splitting): her sayfa ayri bir chunk'a cikar ve
// yalnizca o rotaya girildiginde indirilir. Bolmeden once TEK bir bundle
// 1.557 kB (gzip 481 kB) idi ve recharts/jspdf gibi yalnizca rapor
// ekranlarinda kullanilan agir bagimliliklar giris sayfasinda da yukleniyordu.
//
// HomePage bilerek eager birakildi: acilis rotasi oldugu icin lazy yapmak ilk
// boyamada gereksiz bir yukleniyor durumu (spinner flash) yaratirdi.
const RegisterPage = lazy(() => import('@/pages/register'))
const VerifyEmailPage = lazy(() => import('@/pages/verify-email'))
const LoginPage = lazy(() => import('@/pages/login'))
const ForgotPasswordPage = lazy(() => import('@/pages/forgot-password'))
const ResetPasswordPage = lazy(() => import('@/pages/reset-password'))
const AdminLoginPage = lazy(() => import('@/pages/admin/login'))
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const SettingsPage = lazy(() => import('@/pages/settings'))
const NewInterviewPage = lazy(() => import('@/pages/interview/new'))
const InterviewSessionPage = lazy(() => import('@/pages/interview/session'))
const InterviewReportPage = lazy(() => import('@/pages/interview/report'))
const InterviewListPage = lazy(() => import('@/pages/interview/list'))
const NewPreAssessmentPage = lazy(() => import('@/pages/pre-assessment/new'))
const PreAssessmentReportPage = lazy(() => import('@/pages/pre-assessment/report'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/dashboard'))
const AdminInterviewDetailPage = lazy(() => import('@/pages/admin/interview-detail'))
const AdminStatsPage = lazy(() => import('@/pages/admin/stats'))
const AdminReportsPage = lazy(() => import('@/pages/admin/reports'))

// Authenticated sayfalar AppShell (ortak header/nav) ile sarmalanir — sayfa
// bilesenlerinin kendisi Router'dan bagimsiz kalir (izole test edilebilir),
// kabuk yalnizca routing seviyesinde eklenir.
// Onay kapisi kabugun ICINDE degil YANINDA durur: kabugun icerigi degismez,
// ama korumali her rotada mount edilir. Panele hic ugramadan /settings veya
// /interview/new acan kullanici da onay vermeden ilerleyemez (issue #71).
function withShell(element: React.ReactNode) {
  return (
    <ProtectedRoute>
      <ConsentGateDialog />
      <AppShell>{element}</AppShell>
    </ProtectedRoute>
  )
}

// 005-admin: admin ekranlari AYRI kabuk + AYRI guard ile sarmalanir
// (oturum + role==='admin'); kullanici tarafi withShell'e dokunulmaz.
function withAdminShell(element: React.ReactNode) {
  return (
    <AdminProtectedRoute>
      <AdminShell>{element}</AdminShell>
    </AdminProtectedRoute>
  )
}

// Tema saglayicisi dil saglayicisiyla ayni seviyede durur: ikisi de "hesap
// tercihi" katmani, ikisi de yalnizca localStorage okur/yazar. ThemeProvider
// ROUTES'U SARMALAR ama hicbir sey remount etmez (yalnizca <html data-theme>
// degisir) — form doldururken tema degistirmek veri kaybettirmez.
function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <Toaster position="top-right" richColors closeButton />
        {/* Tek bir Suspense sinirini Routes'un DISINDA tutuyoruz: rota basina
            ayri sinir koymak, kabugun (AppShell/AdminShell) chunk beklerken
            unmount olmasina ve gecislerde layout sicramasina yol acardi. */}
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            {/* 006-sifre-sifirlama (main) — oturumsuz erisilir, kabuk gerektirmez. */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            <Route path="/dashboard" element={withShell(<DashboardPage />)} />
            <Route path="/settings" element={withShell(<SettingsPage />)} />
            <Route path="/interviews" element={withShell(<InterviewListPage />)} />
            <Route path="/interview/new" element={withShell(<NewInterviewPage />)} />
            <Route path="/interview/:id" element={withShell(<InterviewSessionPage />)} />
            <Route path="/interview/:id/report" element={withShell(<InterviewReportPage />)} />
            <Route path="/pre-assessment/new" element={withShell(<NewPreAssessmentPage />)} />
            <Route path="/pre-assessment/:id" element={withShell(<PreAssessmentReportPage />)} />

            <Route path="/admin/dashboard" element={withAdminShell(<AdminDashboardPage />)} />
            <Route
              path="/admin/interview/:id"
              element={withAdminShell(<AdminInterviewDetailPage />)}
            />
            <Route path="/admin/stats" element={withAdminShell(<AdminStatsPage />)} />
            <Route path="/admin/reports" element={withAdminShell(<AdminReportsPage />)} />
          </Routes>
        </Suspense>
      </ThemeProvider>
    </LanguageProvider>
  )
}

export default App
