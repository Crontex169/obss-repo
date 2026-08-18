import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import NewInterviewPage from '@/pages/interview/new'
import InterviewSessionPage from '@/pages/interview/session'
import {
  createInterview,
  getInterview,
  submitAnswer,
  ApiError,
} from '@/lib/interview-client'

// Hikaye 1: yeni gorusme formu UX'i. Sunucu tarafi dogrulama zaten
// backend entegrasyon testlerinde (us1-create-validation.spec.ts) kanitlandi;
// burada yalnizca ISTEMCI davranisi (dogrulama mesajlari, dogru payload,
// hata gosterimi) test edilir — LLM/PDF cagrisi her zaman mock'lanir
// (Anayasa Ilke VI, gercek saglayiciya istek YOK).
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return {
    ...actual,
    createInterview: vi.fn(),
    getInterview: vi.fn(),
    submitAnswer: vi.fn(),
  }
})

// Navigasyon artik react-router useNavigate ile yapilir (tam sayfa reload YOK):
// hedef rota bir stub sayfa ile isaretlenir, gecis DOM'dan dogrulanir.
function renderNewInterview(props: React.ComponentProps<typeof NewInterviewPage> = {}) {
  return render(
    <MemoryRouter initialEntries={['/interview/new']}>
      <Routes>
        <Route path="/interview/new" element={<NewInterviewPage {...props} />} />
        <Route path="/interview/:id" element={<p>SESSION PAGE STUB</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('NewInterviewPage (yeni gorusme formu)', () => {
  beforeEach(() => {
    vi.mocked(createInterview).mockReset()
  })

  it('bos is ilani metniyle gonderim engellenir, createInterview cagrilmaz', async () => {
    const user = userEvent.setup()
    renderNewInterview()

    // Textarea'da HTML5 `required` var (yalnizca bos degeri engeller) — sadece
    // BOSLUK girilerek native dogrulamayi gecip istemci tarafi `trim()` kontrolu
    // tetiklenir (component: `jobPostingText.trim().length === 0`).
    await user.type(screen.getByPlaceholderText('İş ilanını yapıştırın'), '   ')
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    expect(await screen.findByText(/İş ilanı metni boş olamaz/)).toBeInTheDocument()
    expect(createInterview).not.toHaveBeenCalled()
  })

  it('PDF kaynagi secilip dosya yuklenmezse gonderim engellenir', async () => {
    const user = userEvent.setup()
    renderNewInterview()

    await user.click(screen.getByRole('radio', { name: 'PDF' }))
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    expect(await screen.findByText(/Lütfen bir PDF dosyası seçin/)).toBeInTheDocument()
    expect(createInterview).not.toHaveBeenCalled()
  })

  // 009-linkedin-ilan-cekme: baglanti kaynagi. Bicim dogrulamasi SUNUCUDA
  // (us1-create-url.spec.ts) — istemci yalnizca bos alani erken yakalar.
  it('baglanti kaynagi secilip URL girilmezse gonderim engellenir', async () => {
    const user = userEvent.setup()
    renderNewInterview()

    await user.click(screen.getByRole('radio', { name: 'Bağlantı' }))
    // Metin sekmesiyle ayni desen: HTML5 `required` yalnizca tam bos degeri
    // engeller, sadece BOSLUK girilerek istemci `trim()` kontrolu tetiklenir.
    await user.type(
      screen.getByPlaceholderText('https://www.linkedin.com/jobs/view/...'),
      '   ',
    )
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    expect(await screen.findByText(/İlan bağlantısı boş olamaz/)).toBeInTheDocument()
    expect(createInterview).not.toHaveBeenCalled()
  })

  it('baglanti kaynaginda jobPostingUrl payload olarak gonderilir', async () => {
    vi.mocked(createInterview).mockResolvedValue({
      interview: { id: 'iv-2' },
      currentQuestion: null,
    } as never)
    const user = userEvent.setup()
    renderNewInterview()

    await user.click(screen.getByRole('radio', { name: 'Bağlantı' }))
    await user.type(
      screen.getByPlaceholderText('https://www.linkedin.com/jobs/view/...'),
      'https://www.linkedin.com/jobs/view/backend-engineer-at-acme-4447384933',
    )
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    await waitFor(() => expect(createInterview).toHaveBeenCalledTimes(1))
    expect(createInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        jobPostingSource: 'url',
        jobPostingUrl:
          'https://www.linkedin.com/jobs/view/backend-engineer-at-acme-4447384933',
        jobPostingText: undefined,
        jobPostingFile: undefined,
      }),
    )
    expect(await screen.findByText('SESSION PAGE STUB')).toBeInTheDocument()
  })

  it('gecerli girdiyle dogru payload ile createInterview cagrilir ve yonlendirilir', async () => {
    vi.mocked(createInterview).mockResolvedValue({
      interview: { id: 'iv-1' },
      currentQuestion: null,
    } as never)
    const user = userEvent.setup()
    renderNewInterview()

    await user.type(
      screen.getByPlaceholderText('İş ilanını yapıştırın'),
      'Aradigimiz pozisyon: Backend Gelistirici...',
    )
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    await waitFor(() => expect(createInterview).toHaveBeenCalledTimes(1))
    expect(createInterview).toHaveBeenCalledWith(
      expect.objectContaining({
        jobPostingSource: 'text',
        jobPostingText: 'Aradigimiz pozisyon: Backend Gelistirici...',
        questionCount: 8,
        mode: 'written',
        level: 'junior',
        adaptiveEnabled: false,
      }),
    )
    expect(await screen.findByText('SESSION PAGE STUB')).toBeInTheDocument()
  })

  it('sunucu hatasinda (ApiError) hata mesaji gosterilir, yonlendirme yapilmaz', async () => {
    vi.mocked(createInterview).mockRejectedValue(
      new ApiError(429, {
        statusCode: 429,
        error: 'TooManyRequests',
        message: 'Saatlik gorusme sinirina ulastiniz.',
      }),
    )
    const user = userEvent.setup()
    renderNewInterview()

    await user.type(screen.getByPlaceholderText('İş ilanını yapıştırın'), 'Ilan metni')
    await user.click(screen.getByRole('button', { name: /Görüşmeyi Başlat/ }))

    expect(
      await screen.findByText('Saatlik gorusme sinirina ulastiniz.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('SESSION PAGE STUB')).not.toBeInTheDocument()
  })

  it('on-doldurulmus seviye (003-pre-assessment kancasi) forma yansir', () => {
    renderNewInterview({ initialLevel: 'senior' })

    expect(screen.getByRole('radio', { name: 'Uzman' })).toBeChecked()
  })

  it('adaptif anahtar tiklaninca checked degisir', async () => {
    const user = userEvent.setup()
    renderNewInterview()

    const toggle = screen.getByRole('checkbox')
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(toggle).toBeChecked()
  })

  it('soru sayisi alani 5-20 araligini HTML5 min/max ile isaretler', () => {
    renderNewInterview()

    const input = screen.getByLabelText(/Soru say/) as HTMLInputElement
    expect(input).toHaveAttribute('min', '5')
    expect(input).toHaveAttribute('max', '20')
  })

  it('soru sayisi silinip yeniden yazilabilir, gecersiz deger sinira kirpilir', async () => {
    const user = userEvent.setup()
    renderNewInterview()
    const input = screen.getByLabelText(/Soru say/) as HTMLInputElement

    await user.clear(input)
    expect(input).toHaveValue(null) // bos kalir, 5'e yapismaz
    await user.type(input, '15')
    expect(input).toHaveValue(15)

    await user.clear(input)
    await user.type(input, '2')
    await user.tab()
    expect(input).toHaveValue(5)

    await user.clear(input)
    await user.type(input, '30')
    await user.tab()
    expect(input).toHaveValue(20)

    await user.clear(input)
    await user.tab()
    expect(input).toHaveValue(5)
  })
})

// Hikaye 2: chat akisi sira kilidi GORUNUMU. Sunucu sozlesmesi (FR-006/FR-007)
// backend entegrasyon testlerinde (us2-order-lock.spec.ts, us2-answer-immutable.spec.ts)
// zaten kanitlandi; burada istemcinin bu sozlesmeyi DOGRU YANSITTIGI test edilir:
// (a) istemci hicbir zaman gelecek soruyu elinde tutmaz — yalnizca sunucunun
// dondugu `currentQuestion` gosterilir, (b) cevaplanmis ciftler DEGISTIRILEMEZ
// gecmis olarak gosterilir, (c) cevap gonderildikten sonra sira ilerler.
function renderSession(id = 'iv-1') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${id}`]}>
      <Routes>
        <Route path="/interview/:id" element={<InterviewSessionPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InterviewSessionPage (chat akisi sira kilidi gorunumu)', () => {
  beforeEach(() => {
    vi.mocked(getInterview).mockReset()
    vi.mocked(submitAnswer).mockReset()
  })

  it('yalnizca aktif soru gosterilir; henuz cevaplanmamis SONRAKI sorular hic gorunmez', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'in_progress',
      reportStatus: 'not_applicable',
      currentQuestionOrder: 2,
      questionCount: 3,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: null,
      currentQuestion: {
        id: 'q2',
        order: 2,
        type: 'open_ended',
        text: 'Ikinci soru metni',
        options: [],
      },
      answeredPairs: [
        {
          order: 1,
          type: 'open_ended',
          text: 'Birinci soru metni',
          options: [],
          answer: { content: 'ilk cevap', answeredAt: '2026-08-01T00:00:00.000Z' },
        },
      ],
      report: null,
    } as never)

    renderSession()

    expect(await screen.findByText('Ikinci soru metni')).toBeInTheDocument()
    // Gecmis soru DEGISTIRILEMEZ goruntude — metni gorunur ama input alani yok.
    expect(screen.getByText('Birinci soru metni')).toBeInTheDocument()
    expect(screen.getByText('ilk cevap')).toBeInTheDocument()
    // Sunucu ucuncu soruyu hic dondurmedi (FR-006) — istemci onu asla gostermez.
    expect(screen.queryByText(/Ucuncu/)).not.toBeInTheDocument()
  })

  it('cevap gonderilince sira ilerler: eski soru gecmise gecer, yeni currentQuestion gosterilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'in_progress',
      reportStatus: 'not_applicable',
      currentQuestionOrder: 1,
      questionCount: 2,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: null,
      currentQuestion: {
        id: 'q1',
        order: 1,
        type: 'open_ended',
        text: 'Birinci soru',
        options: [],
      },
      answeredPairs: [],
      report: null,
    } as never)
    vi.mocked(submitAnswer).mockResolvedValue({
      interview: {
        id: 'iv-1',
        status: 'in_progress',
        reportStatus: 'not_applicable',
        currentQuestionOrder: 2,
        questionCount: 2,
        position: null,
        level: 'junior',
        language: 'tr',
        mode: 'written',
        completedAt: null,
      },
      currentQuestion: {
        id: 'q2',
        order: 2,
        type: 'open_ended',
        text: 'Ikinci soru',
        options: [],
      },
    } as never)

    const user = userEvent.setup()
    renderSession()

    await screen.findByText('Birinci soru')
    // FR-007 kalicilik uyarisi artik HER gonderimde degil, yalnizca ilk soruda
    // bir kez gosteriliyor (session.tsx notice + firstQuestionNoticeSeen).
    await user.click(screen.getByRole('button', { name: 'Anladım, başla' }))
    await user.type(screen.getByPlaceholderText('Cevabınızı yazın'), 'cevabim')
    await user.click(screen.getByRole('button', { name: /Cevabı gönder/ }))

    await waitFor(() => expect(submitAnswer).toHaveBeenCalledWith('iv-1', 1, 'cevabim'))
    expect(await screen.findByText('Ikinci soru')).toBeInTheDocument()
    // Cevaplanmis soru gecmise TASINIR, tekrar duzenlenemez (yalnizca metin olarak gorunur).
    expect(screen.getByText('Birinci soru')).toBeInTheDocument()
    expect(screen.getByText('cevabim')).toBeInTheDocument()
  })

  // 004-history US2/FR-014: baska cihazda/sekmede tamamlanmis bir gorusmeye
  // "Devam Et" ile gelinirse sistem OTOMATIK olarak rapor ekranina yonlendirir
  // (Hikaye 2 kriter 3) — eskiden yalnizca manuel bir link gosteriliyordu.
  it('gorusme tamamlanmissa (status=completed) otomatik olarak rapor sayfasina yonlendirilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      id: 'iv-1',
      status: 'completed',
      reportStatus: 'ready',
      currentQuestionOrder: 4,
      questionCount: 3,
      position: null,
      level: 'junior',
      language: 'tr',
      mode: 'written',
      completedAt: '2026-08-01T00:00:00.000Z',
      currentQuestion: null,
      answeredPairs: [],
      report: null,
    } as never)

    render(
      <MemoryRouter initialEntries={['/interview/iv-1']}>
        <Routes>
          <Route path="/interview/:id" element={<InterviewSessionPage />} />
          <Route path="/interview/:id/report" element={<p>REPORT PAGE STUB</p>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('REPORT PAGE STUB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cevabi gonder/ })).not.toBeInTheDocument()
  })

  it('sunucu hatasi durumunda hata mesaji gosterilir', async () => {
    vi.mocked(getInterview).mockRejectedValue(
      new ApiError(404, { statusCode: 404, error: 'NotFound', message: 'Gorusme bulunamadi' }),
    )

    renderSession()

    expect(await screen.findByText('Gorusme bulunamadi')).toBeInTheDocument()
  })
})
