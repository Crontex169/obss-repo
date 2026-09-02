import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConsentGateDialog } from '@/components/consent-gate-dialog'
import { acceptKvkkConsent, getKvkkConsentStatus } from '@/lib/users-client'

vi.mock('@/lib/users-client', () => ({
  getKvkkConsentStatus: vi.fn(),
  acceptKvkkConsent: vi.fn(),
}))

// issue #71: onayin toplandigi TEK yer burasi. Kayit formundaki eski kutu
// sunucuya hic gitmiyordu ve Google ile giren kullanici onu atliyordu.
describe('ConsentGateDialog', () => {
  beforeEach(() => {
    vi.mocked(getKvkkConsentStatus).mockReset()
    vi.mocked(acceptKvkkConsent).mockReset()
    vi.mocked(getKvkkConsentStatus).mockResolvedValue({
      kvkkConsentAt: null,
      hasPassword: true,
      cv: null,
      // 010-odeme-abonelik: /me yaniti plan ve kota alanlariyla genisledi.
      plan: 'free',
      interviewsUsed: 0,
      interviewsLimit: 3,
    })
  })

  it('onay verilmemis kullaniciya iki onay kutusu gosterir', async () => {
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    expect(
      screen.getByRole('button', { name: 'KVKK Aydınlatma Metni' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Kullanım Şartları ve Gizlilik Politikası' }),
    ).toBeInTheDocument()
  })

  it('yalnizca bir kutu isaretliyken devam butonu PASIF kalir', async () => {
    const user = userEvent.setup()
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    const devam = screen.getByRole('button', { name: /Kabul et ve başla/ })
    expect(devam).toBeDisabled()

    await user.click(screen.getAllByRole('checkbox')[0])
    expect(devam).toBeDisabled()

    await user.click(screen.getAllByRole('checkbox')[1])
    expect(devam).toBeEnabled()
  })

  it('iki kutu da isaretliyken onay sunucuya gonderilir ve popup kapanir', async () => {
    vi.mocked(acceptKvkkConsent).mockResolvedValue({
      kvkkConsentAt: '2026-08-07T00:00:00.000Z',
    })
    const user = userEvent.setup()
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    for (const kutu of screen.getAllByRole('checkbox')) await user.click(kutu)
    await user.click(screen.getByRole('button', { name: /Kabul et ve başla/ }))

    expect(acceptKvkkConsent).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(),
    )
  })

  // Onay kutusunun erisilebilir adi cumlenin TAMAMIDIR (on ek + belge adi + son
  // ek). Bir ceviri anahtari eksik kalirsa burada ham anahtar ("rows.kvkk.suffix")
  // gorunur ve test kirilir.
  it('onay kutusunun erisilebilir adi cumlenin tamamidir', async () => {
    render(<ConsentGateDialog />)

    expect(
      await screen.findByRole('checkbox', {
        name: "KVKK Aydınlatma Metni'ni okudum ve anladım.",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: "Kullanım Şartları ve Gizlilik Politikası'nı okudum, kabul ediyorum.",
      }),
    ).toBeInTheDocument()
  })

  it('belge adina tiklayinca tam metin ikinci dialogda acilir ve kapatilabilir', async () => {
    const user = userEvent.setup()
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    await user.click(
      screen.getByRole('button', { name: 'Kullanım Şartları ve Gizlilik Politikası' }),
    )

    expect(await screen.findByText('1. Hizmetin Kapsamı')).toBeInTheDocument()
    expect(screen.getByText('10. Saklama Süresi ve Silme')).toBeInTheDocument()

    // Belge kapaninca kapi ve isaretlenmis kutular yerinde kalmali.
    await user.click(screen.getByRole('button', { name: 'Kapat' }))
    await waitFor(() =>
      expect(screen.queryByText('1. Hizmetin Kapsamı')).not.toBeInTheDocument(),
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('KVKK belgesi de ayni dialogla acilir', async () => {
    const user = userEvent.setup()
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    await user.click(screen.getByRole('button', { name: 'KVKK Aydınlatma Metni' }))

    expect(await screen.findByText('1. Veri Sorumlusu')).toBeInTheDocument()
  })

  // Kabul istegi basarisiz olursa kullanici kilitli kalmamali: popup acik kalir,
  // hata gorunur ve buton yeniden denenebilir olur.
  it('sunucu hatasinda popup acik kalir ve buton tekrar aktiflesir', async () => {
    vi.mocked(acceptKvkkConsent).mockRejectedValue(new Error('ag hatasi'))
    const user = userEvent.setup()
    render(<ConsentGateDialog />)

    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(2))
    for (const kutu of screen.getAllByRole('checkbox')) await user.click(kutu)
    await user.click(screen.getByRole('button', { name: /Kabul et ve başla/ }))

    expect(await screen.findByText(/Onay kaydedilemedi/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kabul et ve başla/ })).toBeEnabled()
  })

  it('onay zaten verilmisse popup HIC gosterilmez', async () => {
    vi.mocked(getKvkkConsentStatus).mockResolvedValue({
      kvkkConsentAt: '2026-01-01T00:00:00.000Z',
      hasPassword: true,
      cv: null,
      // 010-odeme-abonelik: /me yaniti plan ve kota alanlariyla genisledi.
      plan: 'free',
      interviewsUsed: 0,
      interviewsLimit: 3,
    })
    render(<ConsentGateDialog />)

    await waitFor(() => expect(getKvkkConsentStatus).toHaveBeenCalled())
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
