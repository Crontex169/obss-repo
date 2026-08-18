import { test, expect, type Page } from '@playwright/test'

// 005-admin quickstart.md US3 / T035. Backend REST yuzeyi route mock'lariyla
// FAKE edilir (sunucu sozlesmesi backend Jest testlerinde kanitlandi).

const ADMIN_USER = {
  id: 'e2e-admin-1',
  email: 'admin@example.com',
  name: 'E2E Admin',
  role: 'admin',
}

async function mockSession(page: Page) {
  await page.route('**/api/auth/get-session*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: {
          id: 'sess-1',
          userId: ADMIN_USER.id,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        },
        user: ADMIN_USER,
      }),
    }),
  )
}

function days(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    const totalTokens = i === n - 1 ? 350 : 0
    return {
      date: d.toISOString().slice(0, 10),
      totalTokens,
      estimatedCostUsd: totalTokens === 0 ? '0.000000' : '0.005250',
    }
  })
}

const FULL_STATS = {
  countsByProfession: [
    { position: 'Backend Gelistirici', label: 'Backend Gelistirici', count: 12 },
    { position: null, label: 'Belirsiz', count: 3 },
  ],
  averageDurationSeconds: 754,
  completionRatio: { completed: 30, inProgress: 12 },
  dailyTokenUsage: days(30),
  totalCostUsd: '0.005250',
}

const EMPTY_STATS = {
  countsByProfession: [],
  averageDurationSeconds: null,
  completionRatio: { completed: 0, inProgress: 0 },
  dailyTokenUsage: days(30).map((d) => ({
    ...d,
    totalTokens: 0,
    estimatedCostUsd: '0.000000',
  })),
  totalCostUsd: '0.000000',
}

function mockStats(page: Page, body: unknown) {
  return page.route('**/api/admin/stats*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  )
}

test.describe('US3 — Admin istatistik ekrani', () => {
  test('dolu veride meslek/tamamlanma/token gorunumleri gosterilir', async ({
    page,
  }) => {
    await mockSession(page)
    await mockStats(page, FULL_STATS)
    await page.goto('/admin/stats')

    await expect(page.getByRole('heading', { name: 'İstatistikler' })).toBeVisible()
    await expect(page.getByText('12 dk 34 sn')).toBeVisible()

    // Gercek tarayicida Recharts eksen etiketi de "Belirsiz" uretir; iddia
    // grafigin METINSEL esdegeri olan listeye (T043) kapsanir.
    await expect(
      page
        .getByRole('region', { name: /meslek/i })
        .getByRole('listitem')
        .filter({ hasText: 'Belirsiz' }),
    ).toContainText('3')
    await expect(
      page.getByRole('region', { name: /tamamlanma/i }),
    ).toContainText('%71')
    await expect(page.getByRole('region', { name: /token/i })).toContainText('350')
  })

  test('FR-013: veri yokken hata degil, "veri yok" gorunumu', async ({ page }) => {
    await mockSession(page)
    await mockStats(page, EMPTY_STATS)
    await page.goto('/admin/stats')

    await expect(page.getByRole('heading', { name: 'İstatistikler' })).toBeVisible()
    await expect(page.getByText(/veri yok/i).first()).toBeVisible()
  })

  test('FR-008: istatistik ekraninda hicbir yazma aksiyonu yok', async ({ page }) => {
    await mockSession(page)
    await mockStats(page, FULL_STATS)
    await page.goto('/admin/stats')
    await expect(page.getByRole('heading', { name: 'İstatistikler' })).toBeVisible()

    await expect(page.getByRole('button', { name: /sil/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /düzenle/i })).toHaveCount(0)
  })
})
