import { test, expect, type Page } from '@playwright/test'

// 005-admin quickstart.md US2 / T025. Backend REST yuzeyi route mock'lariyla
// FAKE edilir (sunucu sozlesmesi backend Jest testlerinde kanitlandi);
// burada gercek tarayicida detay ekraninin render'i dogrulanir.

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

const READY_DETAIL = {
  id: 'iv-1',
  ownerEmail: 'aday@example.com',
  position: 'Backend Gelistirici',
  positionLabel: 'Backend Gelistirici',
  status: 'completed',
  mode: 'written',
  level: 'junior',
  language: 'tr',
  createdAt: '2026-08-01T09:00:00.000Z',
  completedAt: '2026-08-01T09:20:00.000Z',
  deletedAt: null,
  questions: [
    {
      order: 1,
      type: 'open_ended',
      text: 'Deneyiminizi anlatin.',
      options: [],
      answer: 'Uc yildir backend gelistiriyorum.',
    },
  ],
  reportStatus: 'ready',
  report: {
    overallImpression: 'Aday genel olarak yeterli.',
    strengths: ['Net iletisim'],
    improvementAreas: ['Derinlemesine ornek'],
    additionalNotes: [],
    technicalScore: 70,
    behavioralScore: 80,
    generalScore: 75,
  },
  tokenUsage: { totalTokens: 430, estimatedCostUsd: '0.004000' },
}

function mockDetail(page: Page, body: unknown, status = 200) {
  return page.route('**/api/admin/interviews/iv-1', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    }),
  )
}

test.describe('US2 — Admin gorusme detayi', () => {
  test('tam raporlu gorusmede soru/cevap, skorlar ve maliyet gorunur', async ({
    page,
  }) => {
    await mockSession(page)
    await mockDetail(page, READY_DETAIL)
    await page.goto('/admin/interview/iv-1')

    await expect(page.getByText('aday@example.com')).toBeVisible()
    await expect(page.getByText('Deneyiminizi anlatin.')).toBeVisible()
    await expect(page.getByText('Uc yildir backend gelistiriyorum.')).toBeVisible()

    const report = page.getByRole('region', { name: /rapor/i })
    await expect(report.getByText('70')).toBeVisible()
    await expect(page.getByRole('region', { name: /maliyet/i })).toContainText('430')
  })

  test('rapor uretimi basarisizsa zarif durum, soru/cevap yine gorunur', async ({
    page,
  }) => {
    await mockSession(page)
    await mockDetail(page, {
      ...READY_DETAIL,
      reportStatus: 'failed',
      report: null,
      tokenUsage: null,
    })
    await page.goto('/admin/interview/iv-1')

    await expect(page.getByText(/üretilemedi/i)).toBeVisible()
    await expect(page.getByText(/maliyet bilgisi yok/i)).toBeVisible()
    await expect(page.getByText('Deneyiminizi anlatin.')).toBeVisible()
  })

  test('silinmis kayitta "Silindi" rozeti + eksiksiz icerik', async ({ page }) => {
    await mockSession(page)
    await mockDetail(page, {
      ...READY_DETAIL,
      deletedAt: '2026-08-02T10:00:00.000Z',
    })
    await page.goto('/admin/interview/iv-1')

    await expect(page.getByText('Silindi')).toBeVisible()
    await expect(page.getByText('Deneyiminizi anlatin.')).toBeVisible()
  })

  // SC-001: "listeden tek bir secimle, sayfa yuklenmesi dahil 3 saniye icinde".
  // Olcum kalici bir gerileme koruyucusu olarak burada durur (T052).
  test('SC-001: listeden detaya gecis 3 saniyeden kisa surer', async ({ page }) => {
    await mockSession(page)
    await mockDetail(page, READY_DETAIL)
    await page.route('**/api/admin/interviews?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
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
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      }),
    )

    await page.goto('/admin/dashboard')
    await expect(page.getByText('aday@example.com')).toBeVisible()

    const started = Date.now()
    await page.getByRole('link', { name: 'Detay' }).click()
    // Detayin "yuklendi" olcutu: rapor skorlari ekranda.
    await expect(
      page.getByRole('region', { name: /rapor/i }).getByText('70'),
    ).toBeVisible()
    const elapsedMs = Date.now() - started

    expect(elapsedMs).toBeLessThan(3000)
  })

  test('FR-008: detay ekraninda hicbir silme/duzenleme aksiyonu yok', async ({
    page,
  }) => {
    await mockSession(page)
    await mockDetail(page, READY_DETAIL)
    await page.goto('/admin/interview/iv-1')
    await expect(page.getByText('aday@example.com')).toBeVisible()

    await expect(page.getByRole('button', { name: /sil/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /düzenle/i })).toHaveCount(0)
  })
})
