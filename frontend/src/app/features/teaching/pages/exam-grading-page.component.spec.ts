import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ExamGradingPageComponent } from './exam-grading-page.component';
import { ExamGradingService } from '../../../core/services/exam-grading.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockExamGradingService, createMockGradingSubmission } from '../../../__mocks__/course.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

function renderGrading(options?: {
  gradingService?: ReturnType<typeof createMockExamGradingService>;
  queryParams?: Record<string, string>;
}) {
  const gradingService = options?.gradingService ?? createMockExamGradingService();
  const toast = createMockToastService();

  return render(ExamGradingPageComponent, {
    componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
    providers: [
      { provide: ExamGradingService, useValue: gradingService },
      { provide: ToastService, useValue: toast },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(options?.queryParams ?? {}) } } },
    ],
  }).then(result => ({ ...result, gradingService, toast }));
}

describe('ExamGradingPageComponent', () => {
  it('should call loadGradingData on init', async () => {
    const { gradingService } = await renderGrading();
    expect(gradingService.loadGradingData).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const gradingService = createMockExamGradingService({ loading: true });
    await renderGrading({ gradingService });
    expect(screen.getByText('Loading submissions...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const gradingService = createMockExamGradingService({ error: 'Permission denied' });
    await renderGrading({ gradingService });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no submissions', async () => {
    await renderGrading();
    expect(screen.getByText('No submissions found.')).toBeTruthy();
  });

  it('should render submission rows', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', course_title: 'Course A', exam_title: 'Final Exam' }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com', course_title: 'Course B', exam_title: 'Midterm' }),
      ],
    });

    await renderGrading({ gradingService });

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
    expect(screen.getByText('Course A')).toBeTruthy();
    expect(screen.getByText('Course B')).toBeTruthy();
  });

  it('should filter by search term', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com' }),
      ],
    });

    const { fixture } = await renderGrading({ gradingService });

    const searchInput = screen.getByPlaceholderText('Search by learner or exam...');
    fireEvent.input(searchInput, { target: { value: 'alice' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by course', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', course_id: 'c1', course_title: 'Course A' }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com', course_id: 'c2', course_title: 'Course B' }),
      ],
      courses: [{ id: 'c1', title: 'Course A' }, { id: 'c2', title: 'Course B' }],
    });

    const { fixture } = await renderGrading({ gradingService });

    // Find the course dropdown (second <select>)
    const selects = screen.getAllByRole('combobox');
    const courseSelect = selects[0]; // first select is course dropdown
    fireEvent.change(courseSelect, { target: { value: 'c1' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by status (pending)', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', score: null }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com', score: 85 }),
      ],
    });

    const { fixture } = await renderGrading({ gradingService });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1]; // second select is status
    fireEvent.change(statusSelect, { target: { value: 'pending' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter by status (graded)', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', score: null }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com', score: 85 }),
      ],
    });

    const { fixture } = await renderGrading({ gradingService });

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects[1];
    fireEvent.change(statusSelect, { target: { value: 'graded' } });
    fixture.detectChanges();

    expect(screen.queryByText('alice@test.com')).toBeFalsy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should show summary stats', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', score: null }),
        createMockGradingSubmission({ id: 's2', score: 80 }),
        createMockGradingSubmission({ id: 's3', score: 60 }),
      ],
    });

    await renderGrading({ gradingService });

    // Total = 3
    expect(screen.getByText('3')).toBeTruthy();
    // Pending = 1
    expect(screen.getByText('1')).toBeTruthy();
    // Graded = 2
    expect(screen.getByText('2')).toBeTruthy();
    // Avg = (80+60)/2 = 70%
    expect(screen.getByText('70%')).toBeTruthy();
  });

  it('should show Pending badge for ungraded submissions', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', score: null })],
    });

    await renderGrading({ gradingService });
    // "Pending" appears in both summary card label and status badge
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2);
  });

  it('should show Passed badge when score >= passing_score', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', score: 85, passing_score: 70 })],
    });

    await renderGrading({ gradingService });
    expect(screen.getByText('Passed')).toBeTruthy();
  });

  it('should show Failed badge when score < passing_score', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', score: 50, passing_score: 70 })],
    });

    await renderGrading({ gradingService });
    expect(screen.getByText('Failed')).toBeTruthy();
  });

  it('should expand row to show grading form', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });

    const { fixture } = await renderGrading({ gradingService });

    // Click the row to expand
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    expect(screen.getByPlaceholderText('0–100')).toBeTruthy();
    expect(screen.getByPlaceholderText('Feedback for the learner...')).toBeTruthy();
    expect(screen.getByText('Grade Exam')).toBeTruthy();
  });

  it('should pre-fill score and feedback when re-grading', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', score: 85, feedback: 'Good work' })],
    });

    const { fixture } = await renderGrading({ gradingService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    const scoreInput = screen.getByPlaceholderText('0–100') as HTMLInputElement;
    const feedbackInput = screen.getByPlaceholderText('Feedback for the learner...') as HTMLTextAreaElement;
    expect(scoreInput.value).toBe('85');
    expect(feedbackInput.value).toBe('Good work');
    expect(screen.getByText('Update Grade')).toBeTruthy();
  });

  it('should call gradeSubmission on submit and show success toast', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });

    const { fixture, toast } = await renderGrading({ gradingService });

    // Expand row
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    // Enter score + feedback
    fireEvent.input(screen.getByPlaceholderText('0–100'), { target: { value: '85' } });
    fireEvent.input(screen.getByPlaceholderText('Feedback for the learner...'), { target: { value: 'Well done' } });
    fixture.detectChanges();

    // Click Grade
    fireEvent.click(screen.getByText('Grade Exam'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(gradingService.gradeSubmission).toHaveBeenCalledWith('s1', { score: 85, feedback: 'Well done' });
    expect(gradingService.loadGradingData).toHaveBeenCalledTimes(2); // init + after grade
    expect(toast.success).toHaveBeenCalledWith('Submission graded');
  });

  it('should show error toast on grading failure', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });
    gradingService.gradeSubmission.mockRejectedValue(new Error('Update failed'));

    const { fixture, toast } = await renderGrading({ gradingService });

    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();
    fireEvent.input(screen.getByPlaceholderText('0–100'), { target: { value: '85' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Grade Exam'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Update failed');
  });

  it('should show 2-step reset confirmation', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });

    const { fixture } = await renderGrading({ gradingService });

    // Expand the row first
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    // Click reset icon button in actions column
    const resetButtons = screen.getAllByTitle('Reset submission');
    fireEvent.click(resetButtons[0]);
    fixture.detectChanges();

    expect(screen.getByText('This will delete the submission and allow the learner to resubmit.')).toBeTruthy();
    expect(screen.getByText('Yes, Reset')).toBeTruthy();
  });

  it('should call resetSubmission on confirm and show success toast', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });

    const { fixture, toast } = await renderGrading({ gradingService });

    // Expand + trigger reset
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();
    const resetButtons = screen.getAllByTitle('Reset submission');
    fireEvent.click(resetButtons[0]);
    fixture.detectChanges();

    // Confirm
    fireEvent.click(screen.getByText('Yes, Reset'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(gradingService.resetSubmission).toHaveBeenCalledWith('s1');
    expect(gradingService.loadGradingData).toHaveBeenCalledTimes(2); // init + after reset
    expect(toast.success).toHaveBeenCalledWith('Submission reset');
  });

  it('should show error toast on reset failure', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' })],
    });
    gradingService.resetSubmission.mockRejectedValue(new Error('Reset failed'));

    const { fixture, toast } = await renderGrading({ gradingService });

    // Expand + trigger reset
    fireEvent.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();
    const resetButtons = screen.getAllByTitle('Reset submission');
    fireEvent.click(resetButtons[0]);
    fixture.detectChanges();

    // Confirm
    fireEvent.click(screen.getByText('Yes, Reset'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Reset failed');
  });

  it('should clear filters', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com' }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com' }),
      ],
    });

    const { fixture } = await renderGrading({ gradingService });

    // Apply search filter
    fireEvent.input(screen.getByPlaceholderText('Search by learner or exam...'), { target: { value: 'alice' } });
    fixture.detectChanges();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();

    // Clear filters
    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should pre-filter by courseId from query params', async () => {
    const gradingService = createMockExamGradingService({
      submissions: [
        createMockGradingSubmission({ id: 's1', learner_email: 'alice@test.com', course_id: 'c1' }),
        createMockGradingSubmission({ id: 's2', learner_email: 'bob@test.com', course_id: 'c2' }),
      ],
    });

    await renderGrading({ gradingService, queryParams: { courseId: 'c1' } });

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });
});
