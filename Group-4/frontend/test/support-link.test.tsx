import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SupportEscape, SupportLink } from '@/components/support-link'
import { SUPPORT_EMAIL } from '@/lib/support'

// Issue #51 — destek adresi tek kaynaktan (lib/support.ts) gelmeli, mailto: dogru
// kurulmali ve pano izni reddedilse bile sessiz basarisizlik OLMAMALI.

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (m: string) => toastSuccess(m),
    error: (m: string) => toastError(m),
  },
}))

function setClipboard(impl: () => Promise<void>) {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(impl) } })
}

describe('SupportLink', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
  })

  it('adresi GORUNUR metin olarak ve mailto: linki olarak verir', () => {
    render(<SupportLink />)

    const link = screen.getByRole('link', { name: SUPPORT_EMAIL })
    expect(link).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('copyable verilmezse kopyala butonu render EDILMEZ', () => {
    render(<SupportLink />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('copyable ile adres panoya yazilir ve kullaniciya bildirilir', async () => {
    setClipboard(() => Promise.resolve())
    render(<SupportLink copyable />)

    await userEvent.click(screen.getByRole('button'))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SUPPORT_EMAIL)
    expect(toastSuccess).toHaveBeenCalled()
  })

  it('pano yazimi basarisiz olursa sessizce yutulmaz, hata bildirilir', async () => {
    setClipboard(() => Promise.reject(new Error('denied')))
    render(<SupportLink copyable />)

    await userEvent.click(screen.getByRole('button'))

    expect(toastError).toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})

describe('SupportEscape', () => {
  it('hata ekranlarinda adresi kopyala butonu OLMADAN sunar', () => {
    render(<SupportEscape />)

    expect(screen.getByRole('link', { name: SUPPORT_EMAIL })).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
