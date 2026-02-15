import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, RouterLink } from '@angular/router';
import { TeachingOverviewPageComponent } from './teaching-overview-page.component';
import { TeachingOverviewService, TeachingCourseOverview } from '../../../core/services/teaching-overview.service';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

function createMockOverviewService(options?: {
  courses?: TeachingCourseOverview[];
  loading?: boolean;
  error?: string;
}) {
  return {
    courses: signal(options?.courses ?? []),
    loading: signal(options?.loading ?? false),
    error: signal(options?.error ?? ''),
    loadOverview: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockCourse(overrides?: Partial<TeachingCourseOverview>): TeachingCourseOverview {
  return {
    id: 'c1',
    title: 'Test Course',
    canEdit: false,
    canGrade: false,
    enrolledCount: 0,
    pendingExams: 0,
    pendingQuestions: 0,
    openIssues: 0,
    staleModules: 0,
    totalModules: 5,
    totalActionItems: 0,
    ...overrides,
  };
}

function renderPage(options?: {
  service?: ReturnType<typeof createMockOverviewService>;
}) {
  const service = options?.service ?? createMockOverviewService();

  return render(TeachingOverviewPageComponent, {
    componentImports: [MockLucideIconComponent, RouterLink, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
    providers: [
      { provide: TeachingOverviewService, useValue: service },
      provideRouter([]),
    ],
  }).then(result => ({ ...result, service }));
}

describe('TeachingOverviewPageComponent', () => {
  it('should call loadOverview on init', async () => {
    const { service } = await renderPage();
    expect(service.loadOverview).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockOverviewService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading teaching overview...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockOverviewService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no courses', async () => {
    await renderPage();
    expect(screen.getByText('No courses found.')).toBeTruthy();
  });

  it('should display page title with course count badge', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1' }), createMockCourse({ id: 'c2', title: 'Course B' })],
    });
    await renderPage({ service });
    expect(screen.getByText('Teaching Overview')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // badge count
  });

  it('should render course rows with correct data', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          id: 'c1',
          title: 'LNG Fundamentals',
          canEdit: true,
          canGrade: true,
          enrolledCount: 42,
          pendingExams: 3,
          pendingQuestions: 2,
          openIssues: 1,
          staleModules: 0,
          totalModules: 10,
          totalActionItems: 6,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // pending exams (also in stat card)
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('Grade')).toBeTruthy();
  });

  it('should show Read badge when no edit/grade permissions', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ canEdit: false, canGrade: false })],
    });

    await renderPage({ service });

    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeFalsy();
    expect(screen.queryByText('Grade')).toBeFalsy();
  });

  it('should show em-dash for exams when course is not gradable', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ canGrade: false, pendingExams: 0 })],
    });

    const { container } = await renderPage({ service });

    // \u2014 is em-dash
    const emDashes = container.querySelectorAll('.text-slate-400');
    const hasEmDash = Array.from(emDashes).some(el => el.textContent?.trim() === '\u2014');
    expect(hasEmDash).toBe(true);
  });

  it('should highlight counts > 0 with amber color', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          pendingQuestions: 5,
          openIssues: 3,
          totalActionItems: 8,
        }),
      ],
    });

    const { container } = await renderPage({ service });

    const amberElements = container.querySelectorAll('.text-amber-600.font-semibold');
    expect(amberElements.length).toBeGreaterThanOrEqual(2); // questions + issues
  });

  it('should show staleness badges correctly', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'Stale Course', staleModules: 3, totalModules: 10 }),
        createMockCourse({ id: 'c2', title: 'Fresh Course', staleModules: 0, totalModules: 5 }),
        createMockCourse({ id: 'c3', title: 'Empty Course', staleModules: 0, totalModules: 0 }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('3 stale')).toBeTruthy();
    expect(screen.getByText('All fresh')).toBeTruthy();
    expect(screen.getByText('No modules')).toBeTruthy();
  });

  it('should compute stat card values from filtered courses', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', pendingExams: 2, pendingQuestions: 1, openIssues: 3, staleModules: 1, totalActionItems: 7 }),
        createMockCourse({ id: 'c2', title: 'Course B', pendingExams: 1, pendingQuestions: 4, openIssues: 0, staleModules: 2, totalActionItems: 7 }),
      ],
    });

    const { container } = await renderPage({ service });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Pending Exams=3, Open Questions=5, Open Issues=3, Stale Modules=3
    expect(values).toEqual(['3', '5', '3', '3']);
  });

  // --- Filter tests ---

  it('should filter by search term', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'LNG Fundamentals' }),
        createMockCourse({ id: 'c2', title: 'Risk Management' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by course title...');
    fireEvent.input(searchInput, { target: { value: 'lng' } });
    fixture.detectChanges();

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.queryByText('Risk Management')).toBeFalsy();
  });

  it('should filter by needs_attention status', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'Busy Course', totalActionItems: 5 }),
        createMockCourse({ id: 'c2', title: 'Clean Course', totalActionItems: 0 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'needs_attention' } });
    fixture.detectChanges();

    expect(screen.getByText('Busy Course')).toBeTruthy();
    expect(screen.queryByText('Clean Course')).toBeFalsy();
  });

  it('should filter by all_clear status', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'Busy Course', totalActionItems: 5 }),
        createMockCourse({ id: 'c2', title: 'Clean Course', totalActionItems: 0 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'all_clear' } });
    fixture.detectChanges();

    expect(screen.queryByText('Busy Course')).toBeFalsy();
    expect(screen.getByText('Clean Course')).toBeTruthy();
  });

  it('should clear filters', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'LNG Fundamentals' }),
        createMockCourse({ id: 'c2', title: 'Risk Management' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.input(screen.getByPlaceholderText('Search by course title...'), { target: { value: 'lng' } });
    fixture.detectChanges();
    expect(screen.queryByText('Risk Management')).toBeFalsy();

    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.getByText('Risk Management')).toBeTruthy();
  });

  // --- Expanded row tests ---

  it('should expand course row on click', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({ id: 'c1', title: 'My Course', enrolledCount: 15, canEdit: true, canGrade: true }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expanded content not visible initially
    expect(screen.queryByText('Quick Actions')).toBeFalsy();

    fireEvent.click(screen.getByText('My Course'));
    fixture.detectChanges();

    // Expanded content now visible
    expect(screen.getByText('Quick Actions')).toBeTruthy();
    expect(screen.getByText('15 enrolled learners')).toBeTruthy();
    expect(screen.getByText('You can edit content and grade exams for this course.')).toBeTruthy();
  });

  it('should show correct permission text for edit-only', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'Edit Course', canEdit: true, canGrade: false })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Edit Course'));
    fixture.detectChanges();

    expect(screen.getByText('You can edit content for this course.')).toBeTruthy();
  });

  it('should show correct permission text for grade-only', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'Grade Course', canEdit: false, canGrade: true })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Grade Course'));
    fixture.detectChanges();

    expect(screen.getByText('You can grade exams for this course.')).toBeTruthy();
  });

  it('should show correct permission text for read-only', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'Read Course', canEdit: false, canGrade: false })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Read Course'));
    fixture.detectChanges();

    expect(screen.getByText('You have read-only access to this course.')).toBeTruthy();
  });

  it('should show action links with counts in expanded row', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          id: 'c1',
          title: 'Active Course',
          canEdit: true,
          canGrade: true,
          pendingExams: 3,
          pendingQuestions: 2,
          openIssues: 1,
          staleModules: 4,
          totalActionItems: 10,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Active Course'));
    fixture.detectChanges();

    expect(screen.getByText('3 pending exams')).toBeTruthy();
    expect(screen.getByText('2 unanswered questions')).toBeTruthy();
    expect(screen.getByText('1 open issue')).toBeTruthy();
    expect(screen.getByText('4 stale modules')).toBeTruthy();
    expect(screen.getByText('View learner progress')).toBeTruthy();
    expect(screen.getByText('Edit course')).toBeTruthy();
  });

  it('should not show grading link when canGrade is false', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'No Grade', canGrade: false })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('No Grade'));
    fixture.detectChanges();

    expect(screen.queryByText('Exam grading')).toBeFalsy();
    expect(screen.queryByText(/pending exam/)).toBeFalsy();
  });

  it('should not show staleness and edit links when canEdit is false', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'No Edit', canEdit: false })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('No Edit'));
    fixture.detectChanges();

    expect(screen.queryByText('Content staleness')).toBeFalsy();
    expect(screen.queryByText('Edit course')).toBeFalsy();
  });

  it('should show generic link text when counts are 0', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          id: 'c1',
          title: 'Clean Course',
          canEdit: true,
          canGrade: true,
          pendingExams: 0,
          pendingQuestions: 0,
          openIssues: 0,
          staleModules: 0,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Clean Course'));
    fixture.detectChanges();

    expect(screen.getByText('Exam grading')).toBeTruthy();
    expect(screen.getByText('Questions board')).toBeTruthy();
    expect(screen.getByText('Issue management')).toBeTruthy();
    expect(screen.getByText('Content staleness')).toBeTruthy();
  });

  it('should collapse expanded row on second click', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'c1', title: 'Collapsible Course' })],
    });

    const { fixture } = await renderPage({ service });

    // Click to expand — use getAllByText since title appears in table row
    fireEvent.click(screen.getByText('Collapsible Course'));
    fixture.detectChanges();
    expect(screen.getByText('Quick Actions')).toBeTruthy();

    // Click the table row title (first occurrence) to collapse
    fireEvent.click(screen.getAllByText('Collapsible Course')[0]);
    fixture.detectChanges();
    expect(screen.queryByText('Quick Actions')).toBeFalsy();
  });

  it('should use singular form for count of 1', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          id: 'c1',
          title: 'Singular Course',
          canGrade: true,
          pendingExams: 1,
          pendingQuestions: 1,
          openIssues: 1,
          staleModules: 1,
          canEdit: true,
          totalActionItems: 4,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Singular Course'));
    fixture.detectChanges();

    expect(screen.getByText('1 pending exam')).toBeTruthy();
    expect(screen.getByText('1 unanswered question')).toBeTruthy();
    expect(screen.getByText('1 open issue')).toBeTruthy();
    expect(screen.getByText('1 stale module')).toBeTruthy();
  });

  it('should have edit course link pointing to correct route', async () => {
    const service = createMockOverviewService({
      courses: [createMockCourse({ id: 'course-abc', title: 'Editable', canEdit: true })],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Editable'));
    fixture.detectChanges();

    const editLink = screen.getByText('Edit course').closest('a');
    expect(editLink?.getAttribute('href')).toBe('/courses/course-abc/edit');
  });

  it('should pass courseId query param on action links', async () => {
    const service = createMockOverviewService({
      courses: [
        createMockCourse({
          id: 'course-xyz',
          title: 'Linked Course',
          canEdit: true,
          canGrade: true,
          pendingQuestions: 1,
          openIssues: 2,
          pendingExams: 1,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Linked Course'));
    fixture.detectChanges();

    const questionsLink = screen.getByText('1 unanswered question').closest('a');
    expect(questionsLink?.getAttribute('href')).toBe('/teaching/questions?courseId=course-xyz');

    const issuesLink = screen.getByText('2 open issues').closest('a');
    expect(issuesLink?.getAttribute('href')).toBe('/teaching/issues?courseId=course-xyz');

    const gradingLink = screen.getByText('1 pending exam').closest('a');
    expect(gradingLink?.getAttribute('href')).toBe('/teaching/grading?courseId=course-xyz');
  });
});
