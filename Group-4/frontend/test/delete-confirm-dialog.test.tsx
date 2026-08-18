import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteConfirmDialog } from '@/components/interview/delete-confirm-dialog'

// T036 (004-history US4, FR-010): geri donusu olmayan silme islemi oncesi
// onay adimi — onaylarsa cagrilir, vazgecerse cagrilmaz.
describe('DeleteConfirmDialog', () => {
  it('onaylanirsa onConfirm cagrilir', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DeleteConfirmDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Sil' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Sil' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('vazgecilirse onConfirm cagrilmaz', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<DeleteConfirmDialog onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: 'Sil' }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Vazgeç' }))

    expect(onConfirm).not.toHaveBeenCalled()
  })
})
