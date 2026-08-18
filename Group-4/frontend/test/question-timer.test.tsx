import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InterviewSessionPage from '@/pages/interview/session';
import { getInterview, submitAnswer } from '@/lib/interview-client';
import { QUESTION_TIME_LIMIT_SECONDS } from '@/lib/interview-config';

// FR-027/SC-015: sure sadece istemci UI'sinda calisir, sunucuya guvenilmez —
// bu yuzden burada sahte zamanlayici ile SADECE istemci davranisi (zaman
// dolunca otomatik gonderim) test edilir; sunucu tarafi zaten
// backend/test/integration/us5-*.spec.ts'te kanitlandi.
vi.mock('@/lib/interview-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/interview-client')>(
    '@/lib/interview-client',
  );
  return {
    ...actual,
    getInterview: vi.fn(),
    submitAnswer: vi.fn(),
  };
});

function renderSession(id = 'iv-1') {
  return render(
    <MemoryRouter initialEntries={[`/interview/${id}`]}>
      <Routes>
        <Route path="/interview/:id" element={<InterviewSessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Ilk soruda "Baslamadan once" uyari diyalogu acilir ve ONAYLANANA KADAR
// zamanlayici baslamaz (session.tsx timerBlocked). Zamanlayici davranisini
// test edebilmek icin once bu diyalog kapatilmali.
async function dismissFirstQuestionNotice() {
  fireEvent.click(screen.getByRole('button', { name: 'Anladım, başla' }));
  await act(() => vi.advanceTimersByTimeAsync(0));
}

const baseQuestion = {
  id: 'q1',
  order: 1,
  type: 'open_ended' as const,
  text: 'Birinci soru',
  options: [],
};

const baseInterview = {
  id: 'iv-1',
  status: 'in_progress' as const,
  reportStatus: 'not_applicable' as const,
  currentQuestionOrder: 1,
  questionCount: 2,
  position: null,
  level: 'junior' as const,
  language: 'tr' as const,
  mode: 'written' as const,
  completedAt: null,
};

describe('Soru zamanlayicisi (QuestionTimer entegrasyonu)', () => {
  beforeEach(() => {
    vi.mocked(getInterview).mockReset();
    vi.mocked(submitAnswer).mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sure dolunca yazilmis metin varsa OTOMATIK gonderilir, sonraki soruya gecilir', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      ...baseInterview,
      currentQuestion: baseQuestion,
      answeredPairs: [],
      report: null,
    } as never);
    vi.mocked(submitAnswer).mockResolvedValue({
      interview: { ...baseInterview, currentQuestionOrder: 2 },
      currentQuestion: {
        ...baseQuestion,
        id: 'q2',
        order: 2,
        text: 'Ikinci soru',
      },
    } as never);

    renderSession();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText('Birinci soru')).toBeInTheDocument();
    await dismissFirstQuestionNotice();

    fireEvent.change(screen.getByPlaceholderText('Cevabınızı yazın'), {
      target: { value: 'yazilmis cevap' },
    });

    await act(() =>
      vi.advanceTimersByTimeAsync(QUESTION_TIME_LIMIT_SECONDS * 1000),
    );

    expect(submitAnswer).toHaveBeenCalledWith('iv-1', 1, 'yazilmis cevap');
    expect(screen.getByText('Ikinci soru')).toBeInTheDocument();
  });

  it('sure dolunca hic girdi yoksa BOS cevap gonderilir, akis takilmaz', async () => {
    vi.mocked(getInterview).mockResolvedValue({
      ...baseInterview,
      currentQuestion: baseQuestion,
      answeredPairs: [],
      report: null,
    } as never);
    vi.mocked(submitAnswer).mockResolvedValue({
      interview: { ...baseInterview, currentQuestionOrder: 2 },
      currentQuestion: {
        ...baseQuestion,
        id: 'q2',
        order: 2,
        text: 'Ikinci soru',
      },
    } as never);

    renderSession();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(screen.getByText('Birinci soru')).toBeInTheDocument();
    await dismissFirstQuestionNotice();

    await act(() =>
      vi.advanceTimersByTimeAsync(QUESTION_TIME_LIMIT_SECONDS * 1000),
    );

    expect(submitAnswer).toHaveBeenCalledWith('iv-1', 1, '');
    expect(screen.getByText('Ikinci soru')).toBeInTheDocument();
  });
});
