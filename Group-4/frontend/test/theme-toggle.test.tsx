import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, useAppTheme } from '@/lib/theme/theme-provider'
import { THEME_STORAGE_KEY } from '@/lib/theme'

// Koyu tema: tercih localStorage'da tutulur ve <html data-theme> ile uygulanir.
// index.css'teki :root[data-theme="dark"] blogu tek tetikleyici olarak bu
// ozniteligi bekler — testin dogruladigi sozlesme budur.
function ThemeProbe() {
  const { theme, setTheme } = useAppTheme()
  return (
    <div>
      <span data-testid="current">{theme}</span>
      <button type="button" onClick={() => setTheme('dark')}>
        Koyu
      </button>
      <button type="button" onClick={() => setTheme('light')}>
        Acik
      </button>
    </div>
  )
}

describe('Tema tercihi', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('secim yapilmamissa acik temayla baslar', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('current')).toHaveTextContent('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('koyu secilince <html data-theme="dark"> olur ve tercih saklanir', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Koyu' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Acik' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('saklanan tercih yeni oturumda geri yuklenir', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('current')).toHaveTextContent('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('localStorage yazilamiyorsa tema yine de uygulanir', async () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    const user = userEvent.setup()

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Koyu' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    setItem.mockRestore()
  })
})
