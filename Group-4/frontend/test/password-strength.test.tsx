import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PasswordStrength } from '@/components/auth/password-strength'

// 5 kural x %20. Sembol kurali puana katilir ama listede GOSTERILMEZ.
function seviye(parola: string) {
  const { unmount } = render(<PasswordStrength value={parola} />)
  const metin = screen.getByText(/Parola Güvenlik Seviyesi/).textContent ?? ''
  unmount()
  return metin
}

describe('PasswordStrength', () => {
  it('her kural %20 ekler', () => {
    expect(seviye('')).toContain('%0')
    expect(seviye('abc')).toContain('%20') // yalnizca kucuk harf
    expect(seviye('parola12')).toContain('%60') // 8 karakter + rakam + kucuk
    expect(seviye('Parola12')).toContain('%80') // + buyuk harf
    expect(seviye('Parola12!')).toContain('%100') // + sembol
  })

  it('Turkce harf sembol SAYILMAZ', () => {
    // Kontrol grubu: 'ç' A-Za-z0-9 disinda kaliyor ama harftir; naif bir
    // sembol testi burayi yanlislikla %100 gosterirdi.
    expect(seviye('Parolaç12')).toContain('%80')
  })

  it('%80 ve uzeri yesil, altinda degil', () => {
    const cubuk = (parola: string) => {
      const { container, unmount } = render(<PasswordStrength value={parola} />)
      const renk = (container.querySelector('[style*="width"]') as HTMLElement)
        .style.backgroundColor
      unmount()
      return renk
    }
    expect(cubuk('Parola12')).toContain('--color-success')
    expect(cubuk('parola12')).not.toContain('--color-success')
  })

  it('sembol kurali listede gosterilmez (4 madde)', () => {
    render(<PasswordStrength value="Parola12!" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByText(/sembol/i)).toBeNull()
  })
})
