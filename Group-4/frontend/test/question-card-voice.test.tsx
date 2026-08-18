import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionCard } from '@/components/interview/question-card'
import type { Question } from '@/lib/interview-client'

// Sozlu modda transkript duz metin akar; duzenleme kalem ikonuyla acilir.
// ADR-0010/R2: metin gonderim oncesi GORUNUR ve duzenlenebilir kalmali —
// bu yuzden "yazi alani yok" testi kadar "metin ekranda" testi de sart.
const question: Question = {
  order: 1,
  text: 'Kendinden bahseder misin?',
  type: 'open_ended',
  options: [],
  tip: null,
  rationale: null,
} as unknown as Question

describe('QuestionCard — sozlu mod', () => {
  it('transkripti duz metin gosterir, yazi alani acmaz', () => {
    render(
      <QuestionCard question={question} value="soyledigim cevap" onChange={vi.fn()} voice />,
    )

    expect(screen.getByText('soyledigim cevap')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('kalem ikonu yazi alanini acar, metin korunur', async () => {
    render(
      <QuestionCard question={question} value="soyledigim cevap" onChange={vi.fn()} voice />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Düzenle' }))

    expect(screen.getByRole('textbox')).toHaveValue('soyledigim cevap')
  })

  it('yazili modda kalem ikonu HIC render edilmez', () => {
    render(<QuestionCard question={question} value="" onChange={vi.fn()} />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
