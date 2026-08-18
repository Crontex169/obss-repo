import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HintGuidancePanel } from '@/components/interview/hint-guidance-panel'
import { logPanelEvent } from '@/lib/interview-client'

// Hikaye 6 (FR-031/FR-032/FR-034, issue #48): panel varsayilan kapali, ayri
// sekmeler, tip/rationale ikisi de yoksa hic render olmaz, acilista logPanelEvent
// sekme basina EN FAZLA bir kez tetiklenir.
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return {
    ...actual,
    logPanelEvent: vi.fn(),
  }
})

describe('HintGuidancePanel', () => {
  beforeEach(() => {
    vi.mocked(logPanelEvent).mockReset()
  })

  it('tip/rationale ikisi de null ise hic render olmaz', () => {
    const { container } = render(
      <HintGuidancePanel
        interviewId="iv-1"
        questionOrder={1}
        tip={null}
        rationale={null}
      />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(logPanelEvent).not.toHaveBeenCalled()
  })

  it('varsayilan kapali gelir; icerik gorunmez ve log tetiklenmez', () => {
    render(
      <HintGuidancePanel
        interviewId="iv-1"
        questionOrder={2}
        tip="Kisa ve net anlat."
        rationale="Ilanin deneyim gereksinimini olcuyor."
      />,
    )
    expect(screen.queryByText('Kisa ve net anlat.')).not.toBeInTheDocument()
    expect(logPanelEvent).not.toHaveBeenCalled()
  })

  it('acilinca Ipucu sekmesi varsayilan secili gelir ve log bir kez tetiklenir', async () => {
    const user = userEvent.setup()
    render(
      <HintGuidancePanel
        interviewId="iv-1"
        questionOrder={3}
        tip="Kisa ve net anlat."
        rationale="Ilanin deneyim gereksinimini olcuyor."
      />,
    )

    await user.click(screen.getByText('İpucu Göster'))

    expect(screen.getByText('Kisa ve net anlat.')).toBeInTheDocument()
    expect(logPanelEvent).toHaveBeenCalledTimes(1)
    expect(logPanelEvent).toHaveBeenCalledWith('iv-1', 3, 'hint')

    // Ayni sekme icin kapat + tekrar ac ekstra log URETMEMELI.
    await user.click(screen.getByText('Paneli kapat'))
    await user.click(screen.getByText('İpucu Göster'))
    expect(logPanelEvent).toHaveBeenCalledTimes(1)
  })

  it('Neden bu soru? sekmesine gecince dogru icerik gosterilir ve ayrica loglanir', async () => {
    const user = userEvent.setup()
    render(
      <HintGuidancePanel
        interviewId="iv-1"
        questionOrder={4}
        tip="Kisa ve net anlat."
        rationale="Ilanin deneyim gereksinimini olcuyor."
      />,
    )

    await user.click(screen.getByText('İpucu Göster'))
    await user.click(screen.getByText('Neden bu soru?'))

    expect(
      screen.getByText('Ilanin deneyim gereksinimini olcuyor.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Kisa ve net anlat.')).not.toBeInTheDocument()
    expect(logPanelEvent).toHaveBeenCalledTimes(2)
    expect(logPanelEvent).toHaveBeenNthCalledWith(2, 'iv-1', 4, 'rationale')
  })
})
