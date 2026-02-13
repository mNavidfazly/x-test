import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { QuizQuestionComponent } from './quiz-question.component';
import { QuizTakingQuestion } from '../../../core/models/course.model';

describe('QuizQuestionComponent', () => {
  const createQuestion = (overrides?: Partial<QuizTakingQuestion>): QuizTakingQuestion => ({
    id: 'q-1',
    question_text: 'Test question?',
    question_type: 'single_choice',
    points: 1,
    sort_order: 0,
    options: [
      { id: 'o-1', option_text: 'Option A', sort_order: 0 },
      { id: 'o-2', option_text: 'Option B', sort_order: 1 },
    ],
    ...overrides,
  });

  const renderQuestion = async (
    question: QuizTakingQuestion,
    opts?: { answer?: string; disabled?: boolean; questionNumber?: number },
  ) => {
    const answerChange = vi.fn();
    const result = await render(QuizQuestionComponent, {
      componentInputs: {
        question,
        questionNumber: opts?.questionNumber ?? 1,
        answer: opts?.answer ?? '',
        disabled: opts?.disabled ?? false,
      },
      on: { answerChange },
    });
    return { ...result, answerChange };
  };

  it('should render question text and points', async () => {
    await renderQuestion(createQuestion({ question_text: 'What is 2+2?', points: 3 }));

    expect(screen.getByText('What is 2+2?')).toBeTruthy();
    expect(screen.getByText('3 points')).toBeTruthy();
  });

  it('should render singular point label for 1 point', async () => {
    await renderQuestion(createQuestion({ points: 1 }));

    expect(screen.getByText('1 point')).toBeTruthy();
  });

  it('should render the question number', async () => {
    await renderQuestion(createQuestion(), { questionNumber: 7 });

    expect(screen.getByText('7')).toBeTruthy();
  });

  it('should render radio buttons for single_choice questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'single_choice',
      options: [
        { id: 'o-1', option_text: 'Alpha', sort_order: 0 },
        { id: 'o-2', option_text: 'Beta', sort_order: 1 },
        { id: 'o-3', option_text: 'Gamma', sort_order: 2 },
      ],
    }));

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('should emit option id when a single_choice radio is clicked', async () => {
    const { answerChange } = await renderQuestion(createQuestion({
      question_type: 'single_choice',
      options: [
        { id: 'o-1', option_text: 'Alpha', sort_order: 0 },
        { id: 'o-2', option_text: 'Beta', sort_order: 1 },
      ],
    }));

    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);

    expect(answerChange).toHaveBeenCalledWith('o-2');
  });

  it('should render two radio options for true_false questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'true_false',
      options: [
        { id: 'o-tf-1', option_text: 'True', sort_order: 0 },
        { id: 'o-tf-2', option_text: 'False', sort_order: 1 },
      ],
    }));

    expect(screen.getByText('True')).toBeTruthy();
    expect(screen.getByText('False')).toBeTruthy();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
  });

  it('should render checkboxes for multiple_choice questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'multiple_choice',
      options: [
        { id: 'o-1', option_text: 'Apple', sort_order: 0 },
        { id: 'o-2', option_text: 'Banana', sort_order: 1 },
        { id: 'o-3', option_text: 'Cherry', sort_order: 2 },
      ],
    }));

    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText('Cherry')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('should emit comma-separated ids when toggling multiple_choice checkboxes', async () => {
    const { answerChange } = await renderQuestion(
      createQuestion({
        question_type: 'multiple_choice',
        options: [
          { id: 'o-1', option_text: 'Apple', sort_order: 0 },
          { id: 'o-2', option_text: 'Banana', sort_order: 1 },
          { id: 'o-3', option_text: 'Cherry', sort_order: 2 },
        ],
      }),
      { answer: 'o-1' },
    );

    // Toggle o-2 on (o-1 is already selected via answer input)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    expect(answerChange).toHaveBeenCalledWith('o-1,o-2');
  });

  it('should render a text input for fill_blank questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'fill_blank',
      options: [],
    }));

    const input = screen.getByPlaceholderText('Type your answer...');
    expect(input).toBeTruthy();
    expect(input.tagName).toBe('INPUT');
  });

  it('should emit text value on fill_blank input', async () => {
    const { answerChange } = await renderQuestion(createQuestion({
      question_type: 'fill_blank',
      options: [],
    }));

    const input = screen.getByPlaceholderText('Type your answer...');
    fireEvent.input(input, { target: { value: 'Paris' } });

    expect(answerChange).toHaveBeenCalledWith('Paris');
  });

  it('should render a textarea for short_answer questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'short_answer',
      options: [],
    }));

    const textarea = screen.getByPlaceholderText('Type your answer...');
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('should render select dropdowns for matching questions', async () => {
    await renderQuestion(createQuestion({
      question_type: 'matching',
      options: [],
      matchingLeft: ['Capital of France', 'Capital of Germany'],
      matchingRight: ['Paris', 'Berlin', 'Madrid'],
    }));

    expect(screen.getByText('Capital of France')).toBeTruthy();
    expect(screen.getByText('Capital of Germany')).toBeTruthy();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);

    // Each select should contain the right-side options plus a placeholder
    const firstSelect = selects[0] as HTMLSelectElement;
    const optionElements = firstSelect.querySelectorAll('option');
    expect(optionElements).toHaveLength(4); // "Select a match..." + 3 right options
    expect(optionElements[1].textContent).toContain('Paris');
    expect(optionElements[2].textContent).toContain('Berlin');
    expect(optionElements[3].textContent).toContain('Madrid');
  });

  it('should emit JSON pairs when a matching dropdown is changed', async () => {
    const { answerChange } = await renderQuestion(createQuestion({
      question_type: 'matching',
      options: [],
      matchingLeft: ['A', 'B'],
      matchingRight: ['X', 'Y'],
    }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'X' } });

    expect(answerChange).toHaveBeenCalledWith(
      JSON.stringify([
        { left: 'A', right: 'X' },
        { left: 'B', right: '' },
      ]),
    );
  });

  it('should disable all inputs when disabled is true', async () => {
    await renderQuestion(
      createQuestion({
        question_type: 'single_choice',
        options: [
          { id: 'o-1', option_text: 'Option A', sort_order: 0 },
          { id: 'o-2', option_text: 'Option B', sort_order: 1 },
        ],
      }),
      { disabled: true },
    );

    const radios = screen.getAllByRole('radio');
    radios.forEach(radio => {
      expect((radio as HTMLInputElement).disabled).toBe(true);
    });
  });

  it('should disable checkboxes in multiple_choice when disabled', async () => {
    await renderQuestion(
      createQuestion({
        question_type: 'multiple_choice',
        options: [
          { id: 'o-1', option_text: 'A', sort_order: 0 },
          { id: 'o-2', option_text: 'B', sort_order: 1 },
        ],
      }),
      { disabled: true },
    );

    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => {
      expect((cb as HTMLInputElement).disabled).toBe(true);
    });
  });

  it('should disable text input in fill_blank when disabled', async () => {
    await renderQuestion(
      createQuestion({ question_type: 'fill_blank', options: [] }),
      { disabled: true },
    );

    const input = screen.getByPlaceholderText('Type your answer...') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('should disable select dropdowns in matching when disabled', async () => {
    await renderQuestion(
      createQuestion({
        question_type: 'matching',
        options: [],
        matchingLeft: ['A'],
        matchingRight: ['X'],
      }),
      { disabled: true },
    );

    const selects = screen.getAllByRole('combobox');
    selects.forEach(sel => {
      expect((sel as HTMLSelectElement).disabled).toBe(true);
    });
  });
});
