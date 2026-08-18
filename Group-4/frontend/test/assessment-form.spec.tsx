import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssessmentForm } from '@/components/pre-assessment/assessment-form'

// T018 / T094 — MESLEK-BAGIMSIZ form (spec FR-002, 2026-08-04 kapsam karari).
// Zorunlu alanlar eksikse gonderim engellenir; opsiyonel alanlar (yetenek
// etiketleri, acik uclu cevaplar) bos birakilabilir.

// 008 (#69): ogrenme stili, oz-degerlendirme ve egitim durumu formdan
// KALDIRILDI. Zorunlu alan sayisi 6'dan 5'e dustu.

// Gruplar BASTA KAPALI acilir (Radix Accordion kapali icerigi DOM'dan cikarir),
// bu yuzden alanlara dokunmadan once grup basliklari acilir.
async function openAllGroups(user: ReturnType<typeof userEvent.setup>) {
  for (const name of [
    /temel bilgiler/i,
    /çalışma tarzı/i,
    /kısa sorular ve yetenekler/i,
  ]) {
    await user.click(screen.getByRole('button', { name }))
  }
}

/** Zorunlu alanlarin hepsini doldurur. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await openAllGroups(user)
  await user.selectOptions(screen.getByLabelText(/toplam çalışma deneyimin/i), 'y1_3')
  await user.selectOptions(screen.getByLabelText(/şu anki durumun/i), 'seeking')
  await user.click(screen.getByLabelText('Elimle bir şeyler üretirken / tamir ederken'))
  await user.click(screen.getByLabelText('Küçük bir ekiple'))
  await user.click(screen.getByLabelText('Deneyimli birine sorarım'))
}

// `as const`: alanlar `string` degil literal tip alir, boylece
// `Partial<CreatePreAssessmentInput>` icindeki enum tipleriyle eslesir.
const EXPECTED_REQUIRED = {
  experienceYears: 'y1_3',
  workStatus: 'seeking',
  workPreference: 'hands_on',
  teamPreference: 'small_team',
  problemApproach: 'ask_experienced',
} as const

describe('AssessmentForm', () => {
  // 008/#49: gonder dugmesi zorunlu alanlar dolana kadar DEVRE DISI - tiklama
  // artik hata mesaji uretmiyor, submit hic baslamiyor.
  it('zorunlu alanlar eksikken gonder dugmesi devre disi, onSubmit CAGRILMAZ', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AssessmentForm onSubmit={onSubmit} submitting={false} />)

    const submit = screen.getByRole('button', { name: /^kaydet$/i })
    expect(submit).toBeDisabled()

    await user.click(submit)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  // Tek rapor + degistirilebilirlik: mevcut cevaplar forma yuklenir, kullanici
  // raporunu degistirmek icin 5 soruyu bastan cevaplamaz.
  it('initial verilirse form mevcut cevaplarla DOLU acilir', async () => {
    const user = userEvent.setup()
    render(
      <AssessmentForm
        onSubmit={vi.fn()}
        submitting={false}
        initial={{
          experienceYears: 'y1_3',
          workStatus: 'seeking',
          workPreference: 'hands_on',
          teamPreference: 'small_team',
          problemApproach: 'ask_experienced',
          skills: ['kaynak'],
          openAnswers: { enIyiOldugum: 'Ekip uyumu' },
        }}
      />,
    )

    // Kaydedilmis cevaplar oldugu icin gonderim gruplar acilmadan da mumkun.
    expect(screen.getByRole('button', { name: /^kaydet$/i })).toBeEnabled()

    await openAllGroups(user)
    expect(screen.getByLabelText(/toplam çalışma deneyimin/i)).toHaveValue('y1_3')
    expect(screen.getByLabelText(/şu anki durumun/i)).toHaveValue('seeking')
    expect(screen.getByLabelText('Elimle bir şeyler üretirken / tamir ederken')).toBeChecked()
    expect(screen.getByLabelText('Küçük bir ekiple')).toBeChecked()
    expect(screen.getByLabelText('Deneyimli birine sorarım')).toBeChecked()
    expect(screen.getByDisplayValue('Ekip uyumu')).toBeInTheDocument()
  })

  it('initial verilirse degistirilmeyen cevaplar payload da AYNEN gider', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <AssessmentForm
        onSubmit={onSubmit}
        submitting={false}
        initial={{ ...EXPECTED_REQUIRED, skills: ['kaynak'] }}
      />,
    )

    // Yalnizca tek alani degistir.
    await openAllGroups(user)
    await user.selectOptions(screen.getByLabelText(/şu anki durumun/i), 'student')
    await user.click(screen.getByRole('button', { name: /^kaydet$/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      ...EXPECTED_REQUIRED,
      workStatus: 'student',
      skills: ['kaynak'],
    })
  })

  // Gosterge SORU basina ilerler ve opsiyonelleri de sayar (5 zorunlu + yetenek
  // + 3 acik uclu = 9). Yalnizca zorunlulari sayan eski hali, ilk iki grup
  // bitince %100 gosterip "bitti" yalani soyluyordu.
  it('ilerleme her soruda artar; zorunlular bitince %100 OLMAZ', async () => {
    const user = userEvent.setup()
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    expect(screen.getByText('Tamamlanma: %0')).toBeInTheDocument()

    await openAllGroups(user)
    await user.selectOptions(screen.getByLabelText(/toplam çalışma deneyimin/i), 'y1_3')
    expect(screen.getByText('Tamamlanma: %11')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/şu anki durumun/i), 'seeking')
    expect(screen.getByText('Tamamlanma: %22')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Elimle bir şeyler üretirken / tamir ederken'))
    await user.click(screen.getByLabelText('Küçük bir ekiple'))
    await user.click(screen.getByLabelText('Deneyimli birine sorarım'))

    // 5/9 — gonderim mumkun ama form bitmis DEGIL.
    expect(screen.getByText('Tamamlanma: %56')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^kaydet$/i })).toBeEnabled()
  })

  it('%100 ancak opsiyoneller de dolunca cikar', async () => {
    const user = userEvent.setup()
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    await fillRequired(user)
    await user.type(screen.getByLabelText(/yetenek etiketi ekle/i), 'kaynak{Enter}')
    for (const label of [/en iyi olduğunu/i, /geliştirmek istediğin/i, /2 yılda nerede/i]) {
      await user.type(screen.getByLabelText(label), 'cevap')
    }

    expect(screen.getByText('Tamamlanma: %100')).toBeInTheDocument()
  })

  it('grup basliklarinin ucunde de acilir ikonu vardir', () => {
    const { container } = render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    const triggers = screen.getAllByRole('button', {
      name: /temel bilgiler|çalışma tarzı|kısa sorular ve yetenekler/i,
    })
    expect(triggers).toHaveLength(3)
    for (const trigger of triggers) {
      expect(trigger.querySelector('svg')).toBeInTheDocument()
    }
    expect(container.querySelectorAll('[data-state="open"]')).toHaveLength(0)
  })

  it('gruplar KILITLI DEGIL: bos formda son grup da acilabilir', async () => {
    const user = userEvent.setup()
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    // Hicbir alan doldurulmadan ucuncu gruba tiklanabilmeli.
    const lastGroup = screen.getByRole('button', { name: /kısa sorular ve yetenekler/i })
    expect(lastGroup).toBeEnabled()

    await user.click(lastGroup)
    expect(screen.getByLabelText(/yetenek etiketi ekle/i)).toBeVisible()
  })

  it('008/#49: zorunlu alanlar dolunca gonder dugmesi etkinlesir', async () => {
    const user = userEvent.setup()
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    await fillRequired(user)

    expect(screen.getByRole('button', { name: /^kaydet$/i })).toBeEnabled()
  })

  it('yalnizca zorunlu alanlar doldurulunca opsiyonel alanlar payload\'a EKLENMEZ', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AssessmentForm onSubmit={onSubmit} submitting={false} />)

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: /^kaydet$/i }))

    expect(onSubmit).toHaveBeenCalledWith(EXPECTED_REQUIRED)
  })

  it('yetenek etiketi serbest yazilabilir ve payload\'a eklenir (FR-002b)', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AssessmentForm onSubmit={onSubmit} submitting={false} />)

    await fillRequired(user)
    // Oneri listesinde OLMAYAN bir etiket - serbest giris calismali.
    await user.type(screen.getByLabelText(/yetenek etiketi ekle/i), 'vinç operatörlüğü{Enter}')
    await user.click(screen.getByRole('button', { name: /^kaydet$/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      ...EXPECTED_REQUIRED,
      skills: ['vinç operatörlüğü'],
    })
  })

  it('oneri listesinden etiket secilebilir', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AssessmentForm onSubmit={onSubmit} submitting={false} />)

    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: '+ Kaynak' }))
    await user.click(screen.getByRole('button', { name: /^kaydet$/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      ...EXPECTED_REQUIRED,
      skills: ['Kaynak'],
    })
  })

  it('008: kaldirilan alanlar formda RENDER EDILMEZ', () => {
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)

    // Ogrenme stili
    expect(screen.queryByLabelText('Birisi gösterirse / anlatırsa')).not.toBeInTheDocument()
    // Oz-degerlendirme
    expect(screen.queryByLabelText('Fiziksel dayanıklılık')).not.toBeInTheDocument()
    expect(screen.queryByText(/kendini puanla/i)).not.toBeInTheDocument()
    // Egitim durumu
    expect(screen.queryByLabelText(/eğitim durumun/i)).not.toBeInTheDocument()
  })

  it('FR-002d: formda intern/junior/senior secimi YOKTUR', () => {
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)
    expect(screen.queryByText(/junior/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/senior/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stajyer/i)).not.toBeInTheDocument()
  })

  it('SC-001a: zorunlu sorularda sektore ozgu terim bulunmaz', () => {
    render(<AssessmentForm onSubmit={vi.fn()} submitting={false} />)
    for (const term of ['frontend', 'backend', 'React', 'Python', 'yazılım dili']) {
      expect(screen.queryByText(new RegExp(term, 'i'))).not.toBeInTheDocument()
    }
  })

  it('submitting=true iken form alanlari kilitlidir', async () => {
    const user = userEvent.setup()
    render(<AssessmentForm onSubmit={vi.fn()} submitting />)

    expect(screen.getByRole('button', { name: /oluşturuluyor/i })).toBeDisabled()

    await openAllGroups(user)
    expect(screen.getByLabelText(/toplam çalışma deneyimin/i)).toBeDisabled()
  })
})
