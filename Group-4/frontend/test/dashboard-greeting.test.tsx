import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '@/pages/dashboard'
import { listInterviews } from '@/lib/interview-client'
import { getActivePreAssessment } from '@/lib/pre-assessment-client'

// Karsilamadaki ad, kullanicinin yazdigi haliyle degil ilk harfi buyutulmus
// haliyle gosterilir. TR locale sart: 'ismail' -> 'İsmail' (toUpperCase()
// olsaydi 'Ismail' cikardi).
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  )
  return { ...actual, listInterviews: vi.fn(), getInterview: vi.fn() }
})
vi.mock('@/lib/pre-assessment-client', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/pre-assessment-client')
  >('@/lib/pre-assessment-client')
  return { ...actual, getActivePreAssessment: vi.fn() }
})
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: { user: { name: 'ismail veli' } } }),
}))

describe('DashboardPage — karsilama adi', () => {
  beforeEach(() => {
    vi.mocked(listInterviews).mockResolvedValue([])
    vi.mocked(getActivePreAssessment).mockResolvedValue(null)
  })

  it('adin ilk harfini TR kurallarina gore buyutur, gerisine dokunmaz', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Merhaba, İsmail')).toBeInTheDocument()
  })
})
