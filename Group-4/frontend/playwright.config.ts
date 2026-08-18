import { defineConfig } from '@playwright/test'

// Better Auth istemcisi backend'e DOGRUDAN (cross-origin) gider; backend yalnizca
// FRONTEND_URL kaynagina guvenir (trustedOrigins). Dev sunucusu 5173 disinda bir
// portta ise E2E_BASE_URL ile ayni portu ver, yoksa CORS istekleri dusurur.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  reporter: 'html',
  // Iki proje, ONE-KOSUL farkina gore: "mocked" specler tum backend cagrilarini
  // page.route ile karsilar ve YALNIZCA vite dev sunucusu ister — CI bunlari
  // kosar (--project=mocked). "backend" projesi (auth-flows) gercek Better Auth
  // + Postgres ister, CI'da o yigin ayakta degil. Argumansiz `npx playwright
  // test` ikisini de kosar; boylece yerelde kapsam daralmaz.
  projects: [
    { name: 'mocked', testIgnore: /auth-flows\.spec\.ts$/ },
    { name: 'backend', testMatch: /auth-flows\.spec\.ts$/ },
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
  },
})
