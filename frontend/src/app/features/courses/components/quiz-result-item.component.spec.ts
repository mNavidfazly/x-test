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

  it('shows question text and points', async () => {
    await renderResult({ points: 3 });

    expect(screen.getByText('What is 2 + 2?')).toBeTruthy();
    expect(screen.getByText('3 points')).toBeTruthy();
  });

  it('shows correct answer styling when user picked the correct option', async () => {
    // correct_answer is null for option-based questions (correctness via options.is_correct)
    // user_answer=o-2 which has is_correct=true in the default mock options
    await renderResult({ correct_answer: null, user_answer: 'o-2' });

    // Question number badge should have emerald (correct) styling
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-emerald-100');

    // The outer card should have emerald border
    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-emerald-200');

    // "Correct answer:" section should NOT appear (user got it right)
    expect(screen.queryByText('Correct answer:')).toBeNull();
  });

  it('shows incorrect styling when user picked the wrong option', async () => {
    // user_answer=o-1 (option "3") which has is_correct=false
    await renderResult({ correct_answer: null, user_answer: 'o-1' });

    // Question number badge should have rose (incorrect) styling
    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');

    // The outer card should have rose border
    const card = badge.closest('.rounded-xl')!;
    expect(card.className).toContain('border-rose-200');

    // The "Your answer:" label should be present
    expect(screen.getByText('Your answer:')).toBeTruthy();
  });

  it('shows "No answer" when user_answer is null', async () => {
    await renderResult({ user_answer: null });

    expect(screen.getByText('No answer')).toBeTruthy();
  });

  it('shows correct answer when correct_answer is non-null and user is wrong', async () => {
    await renderResult({ correct_answer: 'o-2', user_answer: 'o-1' });

    // The "Correct answer:" label should be visible
    expect(screen.getByText('Correct answer:')).toBeTruthy();

    // The correct answer text "4" appears in the correct answer section (emerald-700)
    // and in the option list. Verify at least one element with text "4" has correct styling.
    const allFours = screen.getAllByText('4');
    const correctAnswerSpan = allFours.find(el =>
      el.classList.contains('font-medium') && el.classList.contains('text-emerald-700')
    );
    expect(correctAnswerSpan).toBeTruthy();
  });

  it('hides correct answer when correct_answer is null (show_correct_answers=false)', async () => {
    // Default mock has correct_answer: null, simulating show_correct_answers=false
    await renderResult({ correct_answer: null, user_answer: 'o-1' });

    expect(screen.queryByText('Correct answer:')).toBeNull();
  });

  it('marks single_choice correct when correct_answer is null and option is_correct matches', async () => {
    // In the DB, single_choice questions have correct_answer=null;
    // correctness is determined by quiz_question_options.is_correct
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

  it('marks multiple_choice correct when correct_answer is null and all correct options selected', async () => {
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

  it('marks multiple_choice incorrect when only some correct options selected', async () => {
    await renderResult({
      question_type: 'multiple_choice',
      correct_answer: null,
      user_answer: 'mc-1',
      options: [
        { id: 'mc-1', option_text: 'A', is_correct: true },
        { id: 'mc-2', option_text: 'B', is_correct: false },
        { id: 'mc-3', option_text: 'C', is_correct: true },
      ],
    });

    const badge = screen.getByText('1');
    expect(badge.className).toContain('bg-rose-100');
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
});
