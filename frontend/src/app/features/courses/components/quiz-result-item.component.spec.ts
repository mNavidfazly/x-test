import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { QuizResultItemComponent } from './quiz-result-item.component';
import { createMockQuizQuestionResult } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('QuizResultItemComponent', () => {
  const renderResult = async (overrides?: Parameters<typeof createMockQuizQuestionResult>[0]) => {
    return render(QuizResultItemComponent, {
      componentInputs: {
        result: createMockQuizQuestionResult(overrides),
        questionNumber: 1,
      },
      componentImports: [MockLucideIconComponent],
    });
  };

  it('shows question text and earned/max points', async () => {
    await renderResult({ points: 3, correct_answer: null, user_answer: 'o-2' });

    expect(screen.getByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByText('3 / 3 points')).toBeTruthy();
  });

  it('shows correct answer styling when user picked the correct option', async () => {
    await renderResult({ correct_answer: null, user_answer: 'o-2' });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');

    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-emerald-200');

    expect(screen.queryByText('Correct answer:')).toBeNull();
  });

  it('shows incorrect styling when user picked the wrong option', async () => {
    await renderResult({ correct_answer: null, user_answer: 'o-1' });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');

    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-rose-200');

    expect(screen.getByText('Your answer:')).toBeTruthy();
  });

  it('shows "No answer" when user_answer is null', async () => {
    await renderResult({ user_answer: null });

    expect(screen.getByText('No answer')).toBeTruthy();
  });

  it('shows correct answer when correct_answer is non-null and user is wrong', async () => {
    await renderResult({ correct_answer: 'o-2', user_answer: 'o-1' });

    expect(screen.getByText('Correct answer:')).toBeTruthy();

    const allFours = screen.getAllByText('4');
    const correctAnswerSpan = allFours.find(el =>
      el.classList.contains('font-medium') && el.classList.contains('text-emerald-700')
    );
    expect(correctAnswerSpan).toBeTruthy();
  });

  it('hides correct answer when correct_answer is null (show_correct_answers=false)', async () => {
    await renderResult({ correct_answer: null, user_answer: 'o-1' });

    expect(screen.queryByText('Correct answer:')).toBeNull();
  });

  it('marks single_choice correct when correct_answer is null and option is_correct matches', async () => {
    await renderResult({
      question_type: 'single_choice',
      correct_answer: null,
      user_answer: 'o-2',
      options: [
        { id: 'o-1', option_text: 'Wrong', is_correct: false },
        { id: 'o-2', option_text: 'Right', is_correct: true },
      ],
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');
    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-emerald-200');
  });

  it('marks true_false correct when correct_answer is null and option is_correct matches', async () => {
    await renderResult({
      question_type: 'true_false',
      correct_answer: null,
      user_answer: 'tf-true',
      options: [
        { id: 'tf-true', option_text: 'True', is_correct: true },
        { id: 'tf-false', option_text: 'False', is_correct: false },
      ],
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('marks multiple_choice correct when all correct options selected', async () => {
    await renderResult({
      question_type: 'multiple_choice',
      correct_answer: null,
      user_answer: 'mc-1,mc-3',
      options: [
        { id: 'mc-1', option_text: 'A', is_correct: true },
        { id: 'mc-2', option_text: 'B', is_correct: false },
        { id: 'mc-3', option_text: 'C', is_correct: true },
      ],
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('shows partial styling for multiple_choice with some correct options', async () => {
    await renderResult({
      question_type: 'multiple_choice',
      correct_answer: null,
      user_answer: 'mc-1',
      points: 3,
      options: [
        { id: 'mc-1', option_text: 'A', is_correct: true },
        { id: 'mc-2', option_text: 'B', is_correct: false },
        { id: 'mc-3', option_text: 'C', is_correct: true },
      ],
    });

    // 1 correct, 0 incorrect, 2 total correct → (1-0)/2 * 3 = 1.5 points → partial (amber)
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-amber-100');
    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-amber-200');
    expect(screen.getByText('1.5 / 3 points')).toBeTruthy();
  });

  it('shows partial styling for multiple_choice with correct and incorrect selections', async () => {
    await renderResult({
      question_type: 'multiple_choice',
      correct_answer: null,
      user_answer: 'mc-1,mc-3,mc-2',
      points: 3,
      options: [
        { id: 'mc-1', option_text: 'A', is_correct: true },
        { id: 'mc-2', option_text: 'B', is_correct: false },
        { id: 'mc-3', option_text: 'C', is_correct: true },
      ],
    });

    // 2 correct, 1 incorrect, 2 total correct → max(0, (2-1)/2) * 3 = 1.5 points → partial
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-amber-100');
    expect(screen.getByText('1.5 / 3 points')).toBeTruthy();
  });

  it('shows zero points for multiple_choice when penalty zeroes out score', async () => {
    await renderResult({
      question_type: 'multiple_choice',
      correct_answer: null,
      user_answer: 'mc-1,mc-2',
      points: 3,
      options: [
        { id: 'mc-1', option_text: 'A', is_correct: true },
        { id: 'mc-2', option_text: 'B', is_correct: false },
        { id: 'mc-3', option_text: 'C', is_correct: true },
      ],
    });

    // 1 correct, 1 incorrect, 2 total correct → max(0, (1-1)/2) = 0 → rose
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');
    expect(screen.getByText('0 / 3 points')).toBeTruthy();
  });

  it('shows partial styling for matching with some correct pairs', async () => {
    await renderResult({
      question_type: 'matching',
      correct_answer: JSON.stringify([
        { left: 'A', right: '1' },
        { left: 'B', right: '2' },
        { left: 'C', right: '3' },
      ]),
      user_answer: JSON.stringify([
        { left: 'A', right: '1' },
        { left: 'B', right: '3' },
        { left: 'C', right: '3' },
      ]),
      points: 3,
      options: null,
    });

    // 2 of 3 pairs correct → (2/3) * 3 = 2 points → partial
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-amber-100');
    expect(screen.getByText('2 / 3 points')).toBeTruthy();
  });

  it('marks fill_blank correct via correct_answer text comparison', async () => {
    await renderResult({
      question_type: 'fill_blank',
      correct_answer: 'Paris',
      user_answer: 'paris',
      options: null,
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('marks fill_blank incorrect when correct_answer is null', async () => {
    await renderResult({
      question_type: 'fill_blank',
      correct_answer: null,
      user_answer: 'paris',
      options: null,
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');
  });

  it('shows 0 earned points when no answer given', async () => {
    await renderResult({ user_answer: null, points: 5 });

    expect(screen.getByText('0 / 5 points')).toBeTruthy();
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');
  });

  // --- Explanation ---

  it('shows explanation when provided', async () => {
    await renderResult({ explanation: 'Because 2 + 2 equals 4.' });

    expect(screen.getByText('Because 2 + 2 equals 4.')).toBeTruthy();
  });

  it('hides explanation when null', async () => {
    await renderResult({ explanation: null });

    expect(screen.queryByText('Because')).toBeNull();
  });

  it('hides explanation when empty string', async () => {
    await renderResult({ explanation: '' });

    const explanationBlocks = document.querySelectorAll('.bg-amber-50');
    expect(explanationBlocks.length).toBe(0);
  });

  // --- AI Grading ---

  it('shows AI accepted badge when ai_accepted is true', async () => {
    await renderResult({
      question_type: 'short_answer',
      correct_answer: 'Liquefied Natural Gas',
      user_answer: 'liquid natural gas',
      ai_accepted: true,
      options: null,
    });

    expect(screen.getByText('AI accepted')).toBeTruthy();
  });

  it('awards full points when ai_accepted is true for fill_blank', async () => {
    await renderResult({
      question_type: 'fill_blank',
      correct_answer: 'Paris',
      user_answer: 'paris, france',
      points: 5,
      ai_accepted: true,
      options: null,
    });

    // Exact match would fail ('paris, france' !== 'paris'), but AI accepted → full points
    expect(screen.getByText('5 / 5 points')).toBeTruthy();
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');
  });

  it('does not show AI badge when ai_accepted is false', async () => {
    await renderResult({
      question_type: 'short_answer',
      correct_answer: 'LNG',
      user_answer: 'LNG',
      ai_accepted: false,
      options: null,
    });

    expect(screen.queryByText('AI accepted')).toBeNull();
  });
});
