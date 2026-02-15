import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/angular';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { QuestionsBoardPageComponent } from './questions-board-page.component';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockExpertQuestionService, createMockExpertQuestionForBoard } from '../../../__mocks__/course.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select.component';

function renderBoard(options?: {
  questionService?: ReturnType<typeof createMockExpertQuestionService>;
  queryParams?: Record<string, string>;
}) {
  const questionService = options?.questionService ?? createMockExpertQuestionService();
  const toast = createMockToastService();

  return render(QuestionsBoardPageComponent, {
    componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
    providers: [
      { provide: ExpertQuestionService, useValue: questionService },
      { provide: ToastService, useValue: toast },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(options?.queryParams ?? {}) } } },
    ],
  }).then(result => ({ ...result, questionService, toast }));
}

describe('QuestionsBoardPageComponent', () => {
  it('should call loadBoardQuestions on init', async () => {
    const { questionService } = await renderBoard();
    expect(questionService.loadBoardQuestions).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const questionService = createMockExpertQuestionService({ boardLoading: true });
    await renderBoard({ questionService });
    expect(screen.getByText('Loading questions...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const questionService = createMockExpertQuestionService({ boardError: 'Permission denied' });
    await renderBoard({ questionService });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no questions', async () => {
    await renderBoard();
    expect(screen.getByText('No questions found.')).toBeTruthy();
  });

  it('should render question rows with correct data', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({
          id: 'eq-1',
          asker: { full_name: 'Bob Santos', email: 'bob@santos.com' },
          course: { title: 'X-LNG Advanced' },
          module: { title: 'Module 3' },
          question_text: 'I dont understand the formula for LNG pricing.',
        }),
      ],
    });

    await renderBoard({ questionService });

    expect(screen.getByText('bob@santos.com')).toBeTruthy();
    expect(screen.getByText('Bob Santos')).toBeTruthy();
    expect(screen.getByText('X-LNG Advanced')).toBeTruthy();
    expect(screen.getByText('Module 3')).toBeTruthy();
  });

  it('should show [Unknown] for null asker', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', asker: null }),
      ],
    });

    await renderBoard({ questionService });

    expect(screen.getByText('[Unknown]')).toBeTruthy();
  });

  it('should show Pending badge for pending questions', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending' }),
      ],
    });

    await renderBoard({ questionService });
    // "Pending" appears in both summary card label and status badge + header badge
    expect(screen.getAllByText(/Pending|pending/).length).toBeGreaterThanOrEqual(2);
  });

  it('should show Answered badge for answered questions', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'answered', response_text: 'The answer is...' }),
      ],
    });

    await renderBoard({ questionService });
    // "Answered" appears in both summary card label and status badge
    expect(screen.getAllByText('Answered').length).toBeGreaterThanOrEqual(2);
  });

  it('should show Closed badge for closed questions', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'closed' }),
      ],
    });

    await renderBoard({ questionService });
    // "Closed" appears in both summary card label and status badge
    expect(screen.getAllByText('Closed').length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by search term (email match)', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', asker: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    const searchInput = screen.getByPlaceholderText('Search by learner or question...');
    fireEvent.input(searchInput, { target: { value: 'alice' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by course', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', course_id: 'c1', asker: { full_name: 'Alice', email: 'alice@test.com' }, course: { title: 'Course A' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', course_id: 'c2', asker: { full_name: 'Bob', email: 'bob@test.com' }, course: { title: 'Course B' } }),
      ],
      boardCourses: [{ id: 'c1', title: 'Course A' }, { id: 'c2', title: 'Course B' }],
    });

    const { fixture } = await renderBoard({ questionService });

    const selects = screen.getAllByRole('combobox');
    const courseSelect = selects[0]; // first combobox is course dropdown
    fireEvent.click(courseSelect);
    fixture.detectChanges();
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Course A'));
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by status (pending)', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', status: 'answered', asker: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1]; // second combobox is status
    fireEvent.click(statusSelect);
    fixture.detectChanges();
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Pending'));
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by status (answered)', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', status: 'answered', asker: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1];
    fireEvent.click(statusSelect);
    fixture.detectChanges();
    const listbox = screen.getByRole('listbox');
    fireEvent.click(within(listbox).getByText('Answered'));
    fixture.detectChanges();

    expect(screen.queryByText('alice@test.com')).toBeFalsy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should show summary stats', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending' }),
        createMockExpertQuestionForBoard({ id: 'eq-2', status: 'answered' }),
        createMockExpertQuestionForBoard({ id: 'eq-3', status: 'answered' }),
        createMockExpertQuestionForBoard({ id: 'eq-4', status: 'closed' }),
      ],
    });

    const { container } = await renderBoard({ questionService });

    // Summary cards show counts as bold 2xl numbers — query by the card structure
    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=4, Pending=1, Answered=2, Closed=1
    expect(values).toEqual(['4', '1', '2', '1']);
  });

  it('should expand row to show response form', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending', asker: { full_name: 'Alice', email: 'alice@test.com' }, question_text: 'How does LNG pricing work?' }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    expect(screen.getByPlaceholderText('Type your response...')).toBeTruthy();
    expect(screen.getByText('Submit Response')).toBeTruthy();
    // Question text appears in both truncated table cell and expanded detail
    expect(screen.getAllByText('How does LNG pricing work?').length).toBeGreaterThanOrEqual(2);
  });

  it('should pre-fill response for answered question', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({
          id: 'eq-1', status: 'answered',
          asker: { full_name: 'Alice', email: 'alice@test.com' },
          response_text: 'The formula uses market benchmarks.',
        }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    const textarea = screen.getByPlaceholderText('Update your response...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('The formula uses market benchmarks.');
    expect(screen.getByText('Update Response')).toBeTruthy();
    expect(screen.getByText('Close Question')).toBeTruthy();
  });

  it('should call respondToQuestion on submit and show success toast', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
      ],
    });

    const { fixture, toast } = await renderBoard({ questionService });

    // Expand
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    // Type response
    fireEvent.input(screen.getByPlaceholderText('Type your response...'), { target: { value: 'Here is the answer' } });
    fixture.detectChanges();

    // Submit
    fireEvent.click(screen.getByText('Submit Response'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(questionService.respondToQuestion).toHaveBeenCalledWith('eq-1', 'Here is the answer');
    expect(questionService.loadBoardQuestions).toHaveBeenCalledTimes(2); // init + after respond
    expect(toast.success).toHaveBeenCalledWith('Response submitted');
  });

  it('should show error toast on response failure', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', status: 'pending', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
      ],
    });
    questionService.respondToQuestion.mockRejectedValue(new Error('Update failed'));

    const { fixture, toast } = await renderBoard({ questionService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();
    fireEvent.input(screen.getByPlaceholderText('Type your response...'), { target: { value: 'answer' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Submit Response'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Update failed');
  });

  it('should call closeQuestion on close and show success toast', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({
          id: 'eq-1', status: 'answered',
          asker: { full_name: 'Alice', email: 'alice@test.com' },
          response_text: 'Already answered.',
        }),
      ],
    });

    const { fixture, toast } = await renderBoard({ questionService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Close Question'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(questionService.closeQuestion).toHaveBeenCalledWith('eq-1');
    expect(questionService.loadBoardQuestions).toHaveBeenCalledTimes(2); // init + after close
    expect(toast.success).toHaveBeenCalledWith('Question closed');
  });

  it('should show error toast on close failure', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({
          id: 'eq-1', status: 'answered',
          asker: { full_name: 'Alice', email: 'alice@test.com' },
          response_text: 'Already answered.',
        }),
      ],
    });
    questionService.closeQuestion.mockRejectedValue(new Error('Close failed'));

    const { fixture, toast } = await renderBoard({ questionService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Close Question'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Close failed');
  });

  it('should clear filters', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', asker: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    const { fixture } = await renderBoard({ questionService });

    // Apply search filter
    fireEvent.input(screen.getByPlaceholderText('Search by learner or question...'), { target: { value: 'alice' } });
    fixture.detectChanges();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();

    // Clear filters
    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should pre-filter by courseId from query params', async () => {
    const questionService = createMockExpertQuestionService({
      boardQuestions: [
        createMockExpertQuestionForBoard({ id: 'eq-1', course_id: 'c1', asker: { full_name: 'Alice', email: 'alice@test.com' } }),
        createMockExpertQuestionForBoard({ id: 'eq-2', course_id: 'c2', asker: { full_name: 'Bob', email: 'bob@test.com' } }),
      ],
    });

    await renderBoard({ questionService, queryParams: { courseId: 'c1' } });

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });
});
