import { test, expect, type Page } from '@playwright/test'

// 005-admin quickstart.md US1 / T014. interview-flows.spec.ts ile AYNI yaklasim:
// backend REST yuzeyi Playwright route mock'lariyla FAKE edilir (sunucu
// sozlesmesi backend Jest entegrasyon testlerinde kanitlandi); burada gercek
// tarayicida routing, rol koruma, tablo render'i, filtre ve sayfalama dogrulanir.

const ADMIN_USER = {
  id: 'e2e-admin-1',
  email: 'admin@example.com',
  name: 'E2E Admin',
  role: 'admin',
}
const PLAIN_USER = {
  id: 'e2e-user-1',
  email: 'aday@example.com',
  name: 'E2E Aday',
  role: 'user',
}
const SESSION = {
  id: 'sess-1',
  userId: ADMIN_USER.id,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
}

async function mockSession(page: Page, user: typeof ADMIN_USER | typeof PLAIN_USER) {
  await page.route('**/api/auth/get-session*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session: { ...SESSION, userId: user.id }, user }),
    }),
  )
}

const ITEMS = [
  {
    id: 'iv-1',
    ownerEmail: 'aday@example.com',
    position: 'Backend Gelistirici',
    positionLabel: 'Backend Gelistirici',
    status: 'completed',
    createdAt: '2026-08-01T09:00:00.000Z',
    completedAt: '2026-08-01T09:20:00.000Z',
    deletedAt: null,
  },
  {
    id: 'iv-2',
    ownerEmail: 'baskasi@example.com',
    position: null,
    positionLabel: 'Belirsiz',
    status: 'in_progress',
    createdAt: '2026-08-01T08:00:00.000Z',
    completedAt: null,
    deletedAt: '2026-08-02T10:00:00.000Z',
  },
]

/** position query parametresine gore mock listeyi filtreler. */
async function mockList(page: Page) {
  await page.route('**/api/admin/interviews*', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname !== '/api/admin/interviews') return route.fallback()

    const position = url.searchParams.get('position')
    const items = !position
      ? ITEMS
      : position === 'unspecified'
        ? ITEMS.filter((i) => i.position === null)
        : ITEMS.filter((i) => i.position === position)

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items, total: items.length, page: 1, pageSize: 20 }),
    })
  })
}

test.describe('US1 — Admin gorusme listesi', () => {
  test('admin tum kullanicilarin gorusmelerini gorur, silinmis kayit "Silindi" rozetiyle kalir', async ({
    page,
  }) => {
    await mockSession(page, ADMIN_USER)
    await mockList(page)
    await page.goto('/admin/dashboard')

    await expect(page.getByText('aday@example.com')).toBeVisible()
    await expect(page.getByText('baskasi@example.com')).toBeVisible()

    const deletedRow = page.getByRole('row', { name: /baskasi@example\.com/ })
    await expect(deletedRow.getByText('Silindi')).toBeVisible()
  })

  test('meslek filtresi yalnizca eslesen kayitlari birakir', async ({ page }) => {
    await mockSession(page, ADMIN_USER)
    await mockList(page)
    await page.goto('/admin/dashboard')
    await expect(page.getByText('aday@example.com')).toBeVisible()

    // shadcn/ui Select = Radix listbox: selectOption yerine ac + tikla.
    await page.getByLabel(/meslek/i).click()
    await page.getByRole('option', { name: 'Backend Gelistirici' }).click()

    await expect(page.getByText('aday@example.com')).toBeVisible()
    await expect(page.getByText('baskasi@example.com')).toHaveCount(0)
  })

  test('"Belirsiz" filtresi yalnizca pozisyonsuz kayitlari birakir', async ({ page }) => {
    await mockSession(page, ADMIN_USER)
    await mockList(page)
    await page.goto('/admin/dashboard')
    await expect(page.getByText('aday@example.com')).toBeVisible()

    await page.getByLabel(/meslek/i).click()
    await page.getByRole('option', { name: 'Belirsiz' }).click()

    await expect(page.getByText('baskasi@example.com')).toBeVisible()
    await expect(page.getByText('aday@example.com')).toHaveCount(0)
  })

  test('role="user" oturumu admin panelinden yonlendirilir (istemci UX katmani)', async ({
    page,
  }) => {
    await mockSession(page, PLAIN_USER)
    await mockList(page)
    await page.goto('/admin/dashboard')

    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
