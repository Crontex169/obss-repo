import { test, expect, type Page } from '@playwright/test'
import trCommon from '../../src/lib/i18n/locales/tr/common.json' with { type: 'json' }
import trInterview from '../../src/lib/i18n/locales/tr/interview.json' with { type: 'json' }

// Gorunur metinler locale dosyasindan OKUNUR, teste elle kopyalanmaz. Metinler
// i18n'e tasinirken buradaki ASCII kopyalar ("Cevabinizi yazin") gercek UI ile
// ("Cevabınızı yazın") ayrisip 5 testi kirmisti (issue #67); tek kaynak olunca
// ceviri degisince test kendiliginden takip eder ve kaynak dosya ASCII kalir.
const T = trInterview
const TC = trCommon

// quickstart.md S1-S6 uctan uca dogrulama (002-interview). Kapsam notu:
// LLM/PDF cikarimi ve backend REST yuzeyi GERCEK sunucuya/saglayiciya
// GITMEZ — Anayasa Ilke VI ("gercek saglayiciya istek atan test yazilmaz")
// ve auth-flows.spec.ts'teki oturum on-kosulu bu dilimde henuz gercek bir
// backend-e2e kosum hattina baglanmadigindan, backend REST cagrilari
// (`/api/auth/get-session`, `/api/interviews*`) Playwright route mock'lariyla
// FAKE edilir — boylece test deterministik, hizli ve maliyetsiz kalir; frontend
// tarafinin GERCEK tarayicida (routing, form, chat-flow render, Web Speech API
// entegrasyonu) dogru calistigi dogrulanir. Sunucu sozlesmesinin kendisi
// backend Jest entegrasyon testlerinde (us1-us5-*.spec.ts) zaten kanitlandi.

const FAKE_USER = { id: 'e2e-user-1', email: 'e2e@example.com', name: 'E2E Kullanici' }
const FAKE_SESSION = { id: 'sess-1', userId: FAKE_USER.id, expiresAt: new Date(Date.now() + 3600_000).toISOString() }

async function mockSession(page: Page) {
  await page.route('**/api/auth/get-session*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session: FAKE_SESSION, user: FAKE_USER }),
    }),
  )
  // issue #71: onay kapisi artik korumali HER rotada mount ediliyor. Onayi
  // verilmis bir kullanici dondurulmezse bloke eden popup butun bu testlerin
  // onune gecerdi.
  await page.route('**/api/users/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kvkkConsentAt: '2026-01-01T00:00:00.000Z', hasPassword: true }),
    }),
  )
}

/** ADR-0010: tarayici destegi olmadigi durumu simule eder (FR-025). */
async function stubVoiceUnsupported(page: Page) {
  // ADR-0014: STT artik MediaRecorder+getUserMedia+AudioContext'e bagli
  // (SpeechRecognition'a DEGIL). Gercek tarayicida (Chromium) bu API'ler
  // VARDIR — yalnizca SpeechRecognition'i silmek recordingSupported()'i
  // false yapmaz ve senaryo sessizce anlamsizlasirdi.
  await page.addInitScript(() => {
    // @ts-expect-error test stub
    delete window.MediaRecorder
    // @ts-expect-error test stub
    delete window.AudioContext
    // @ts-expect-error test stub
    delete window.speechSynthesis
  })
}

/**
 * Ilk soruda (currentQuestionOrder === 1) bloke eden bir bilgilendirme dialogu
 * acilir (session.tsx); kapatilmadan cevap alani devre disi kalir.
 */
async function ilkSoruUyarisiniKapat(page: Page) {
  await page.getByRole('button', { name: T.session.notice.confirm }).click()
}

function jsonRoute(page: Page, pattern: string, body: unknown, status = 200) {
  return page.route(pattern, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

const baseInterview = {
  id: 'iv-e2e-1',
  status: 'in_progress' as const,
  reportStatus: 'not_applicable' as const,
  currentQuestionOrder: 1,
  questionCount: 2,
  position: 'Backend Gelistirici',
  level: 'junior' as const,
  language: 'tr' as const,
  mode: 'written' as const,
  completedAt: null,
}

test.describe('S1 — Is ilani girme ve soru uretimi (fake LLM)', () => {
  test('gecerli metin ilanla gorusme olusturulur, ilk soru gosterilir', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews', {
      interview: baseInterview,
      currentQuestion: { id: 'q1', order: 1, type: 'open_ended', text: 'Kendinizden bahseder misiniz?', options: [] },
    })
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      currentQuestion: { id: 'q1', order: 1, type: 'open_ended', text: 'Kendinizden bahseder misiniz?', options: [] },
      answeredPairs: [],
      report: null,
    })

    await page.goto('/interview/new')
    await page.getByPlaceholder(T.new.jobPostingPlaceholder).fill('Aradigimiz pozisyon: Backend Gelistirici (Node.js, PostgreSQL).')
    await page.getByRole('button', { name: T.new.submit }).click()

    await expect(page).toHaveURL('/interview/iv-e2e-1')
    await expect(page.getByText('Kendinizden bahseder misiniz?')).toBeVisible()
  })

  test('questionCount 5-20 disi -> sunucu 400 doner, hata gosterilir', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(
      page,
      '**/api/interviews',
      { statusCode: 400, error: 'BadRequest', message: 'questionCount 5 ile 20 arasinda olmalidir.' },
      400,
    )

    await page.goto('/interview/new')
    await page.getByPlaceholder(T.new.jobPostingPlaceholder).fill('Bir ilan metni.')
    // Native `max=20` kisitlamasini bilerek kaldirip 25 yaziyoruz: istemci
    // odak cikisinda 20'ye kirpmali. Sunucu sozlesmesi yine de istemciye
    // guvenmez — bu istekte 400 mock'lanir ve hata gosterimi dogrulanir.
    const questionCountInput = page.getByLabel(T.new.questionCountLabel)
    await questionCountInput.evaluate((el: HTMLInputElement) => el.removeAttribute('max'))
    await questionCountInput.fill('25')
    await questionCountInput.blur()
    await expect(questionCountInput).toHaveValue('20')
    await page.getByRole('button', { name: T.new.submit }).click()

    await expect(page.getByText('questionCount 5 ile 20 arasinda olmalidir.')).toBeVisible()
    await expect(page).toHaveURL(/\/interview\/new$/)
  })

  test('LLM soru uretimi hata/zaman asimi verir -> 502, gorusme olusturulmaz', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(
      page,
      '**/api/interviews',
      { statusCode: 502, error: 'BadGateway', message: 'Yapay zeka beklenen bicimde yanit uretmedi. Lutfen tekrar deneyin.' },
      502,
    )

    await page.goto('/interview/new')
    await page.getByPlaceholder(T.new.jobPostingPlaceholder).fill('Bir ilan metni.')
    await page.getByRole('button', { name: T.new.submit }).click()

    await expect(
      page.getByText('Yapay zeka beklenen bicimde yanit uretmedi. Lutfen tekrar deneyin.'),
    ).toBeVisible()
  })
})

test.describe('S2 — Sirali soru-cevap akisi', () => {
  test('soru cevaplanir -> sonraki soru gosterilir, oncekiler gecmise gecer', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      currentQuestion: { id: 'q1', order: 1, type: 'open_ended', text: 'Birinci soru', options: [] },
      answeredPairs: [],
      report: null,
    })
    await page.route('**/api/interviews/iv-e2e-1/answers', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          interview: { ...baseInterview, currentQuestionOrder: 2 },
          currentQuestion: { id: 'q2', order: 2, type: 'open_ended', text: 'Ikinci soru', options: [] },
        }),
      }),
    )

    await page.goto('/interview/iv-e2e-1')
    await expect(page.getByText('Birinci soru')).toBeVisible()
    await ilkSoruUyarisiniKapat(page)

    await page.getByPlaceholder(T.questionCard.answerPlaceholder).fill('Cevabim burada.')
    await page.getByRole('button', { name: T.session.send }).click()

    await expect(page.getByText('Ikinci soru')).toBeVisible()
    // Cevaplanan soru gecmiste hala GORUNUR (degistirilemez), ama ayri bir
    // duzenlenebilir alan olarak DEGIL.
    await expect(page.getByText('Birinci soru')).toBeVisible()
    await expect(page.getByText('Cevabim burada.')).toBeVisible()
  })

  test('zaten cevaplanmis/sirasi gelmemis soruya cevap -> 409 hatasi gosterilir', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      currentQuestion: { id: 'q1', order: 1, type: 'open_ended', text: 'Birinci soru', options: [] },
      answeredPairs: [],
      report: null,
    })
    await jsonRoute(
      page,
      '**/api/interviews/iv-e2e-1/answers',
      { statusCode: 409, error: 'Conflict', message: 'Bu soru zaten cevaplanmis.' },
      409,
    )

    await page.goto('/interview/iv-e2e-1')
    await ilkSoruUyarisiniKapat(page)
    await page.getByPlaceholder(T.questionCard.answerPlaceholder).fill('Tekrar cevap.')
    await page.getByRole('button', { name: T.session.send }).click()

    await expect(page.getByText('Bu soru zaten cevaplanmis.')).toBeVisible()
  })
})

test.describe('S3 — Yarida birakma ve devam etme (resume)', () => {
  test('devam eden gorusmeye donulunce onceki ciftler + aktif soru gosterilir', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      currentQuestionOrder: 4,
      questionCount: 5,
      currentQuestion: { id: 'q4', order: 4, type: 'open_ended', text: 'Dorduncu soru', options: [] },
      answeredPairs: [1, 2, 3].map((order) => ({
        order,
        type: 'open_ended' as const,
        text: `Soru ${order}`,
        options: [],
        answer: { content: `Cevap ${order}`, answeredAt: new Date().toISOString() },
      })),
      report: null,
    })

    await page.goto('/interview/iv-e2e-1')

    await expect(page.getByText('Dorduncu soru')).toBeVisible()
    await expect(page.getByText('Soru 1')).toBeVisible()
    await expect(page.getByText('Cevap 3')).toBeVisible()
    // Sunucu 5. soruyu HENUZ dondurmedi — istemci onu asla gostermez.
    await expect(page.getByText('Besinci')).toHaveCount(0)
  })

  test('baska kullanicinin gorusmesine erisim -> 404, icerik sizmaz', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(
      page,
      '**/api/interviews/iv-not-mine',
      { statusCode: 404, error: 'NotFound', message: 'Gorusme bulunamadi.' },
      404,
    )

    await page.goto('/interview/iv-not-mine')

    await expect(page.getByText('Gorusme bulunamadi.')).toBeVisible()
  })
})

test.describe('S5 — Degerlendirme raporu goruntuleme (Gorusme Detayi, 004-history US3)', () => {
  // 004-history revizyonu: rapor sayfasi artik getReport() degil getInterview()
  // cagirir (contracts/interview-api.md §3) — tek cagrida hem answeredPairs hem
  // report gelir; asagidaki mock'lar da temel /api/interviews/:id uc noktasini hedefler.
  test('rapor hazirsa soru/cevaplar + radar grafik + metinsel skorlar gosterilir', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      status: 'completed',
      reportStatus: 'ready',
      currentQuestion: null,
      answeredPairs: [
        {
          order: 1,
          type: 'open_ended',
          text: 'Birinci soru',
          options: [],
          answer: { content: 'Cevabim burada.', answeredAt: new Date().toISOString() },
        },
      ],
      report: {
        id: 'rep-1',
        overallImpression: 'Aday genel olarak guclu bir performans sergiledi.',
        strengths: ['Net iletisim', 'Problem cozme'],
        improvementAreas: ['Sistem tasarimi derinligi'],
        technicalScore: 78,
        behavioralScore: 85,
        generalScore: 80,
        additionalNotes: [],
        generatedAt: new Date().toISOString(),
      },
    })

    await page.goto('/interview/iv-e2e-1/report')

    await expect(page.getByText(T.report.title)).toBeVisible()
    await expect(page.getByText('Birinci soru')).toBeVisible()
    await expect(page.getByText('Cevabim burada.')).toBeVisible()
    await expect(page.getByText('Aday genel olarak guclu bir performans sergiledi.')).toBeVisible()
    await expect(page.getByText('78/100')).toBeVisible()
    await expect(page.getByText('85/100')).toBeVisible()
    await expect(page.getByText('80/100')).toBeVisible()
  })

  test('rapor uretimi basarisizsa soru/cevaplar yine gosterilir, rapor bolumunde hata + tekrar dene (FR-008)', async ({ page }) => {
    await mockSession(page)
    await jsonRoute(page, '**/api/interviews/iv-e2e-1', {
      ...baseInterview,
      status: 'completed',
      reportStatus: 'failed',
      currentQuestion: null,
      answeredPairs: [
        {
          order: 1,
          type: 'open_ended',
          text: 'Birinci soru',
          options: [],
          answer: { content: 'Cevabim burada.', answeredAt: new Date().toISOString() },
        },
      ],
      report: null,
    })

    await page.goto('/interview/iv-e2e-1/report')

    await expect(page.getByText('Birinci soru')).toBeVisible()
    await expect(page.getByText(T.report.retryFailed)).toBeVisible()
    await expect(page.getByRole('button', { name: TC.retry })).toBeVisible()
  })
})

test.describe('S6 — Sozlu mod: tarayici destegi yoksa zarif bozulma (FR-025)', () => {
  test('SpeechRecognition YOKSA sozlu mod secenegi devre disi, kullanici yaziliya yonlendirilir', async ({ page }) => {
    await stubVoiceUnsupported(page)
    await mockSession(page)

    await page.goto('/interview/new')

    const voiceRadio = page.getByRole('radio', { name: T.modeSelector.voice })
    await expect(voiceRadio).toBeDisabled()
    await expect(page.getByText(T.modeSelector.voiceUnsupported)).toBeVisible()
  })
})
