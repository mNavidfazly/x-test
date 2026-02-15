import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { ProgressDashboardPageComponent } from './progress-dashboard-page.component';
import { ProgressService } from '../../../core/services/progress.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockProgressService, createMockDashboardUserProgress } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { of, Subject } from 'rxjs';

function renderDashboard(options?: {
  progressService?: ReturnType<typeof createMockProgressService>;
  authService?: ReturnType<typeof createMockAuthService>;
}) {
  const progressService = options?.progressService ?? createMockProgressService();
  const authService = options?.authService ?? createMockAuthService({
    isAuthenticated: true,
    claims: { is_platform_admin: true },
  });
  const toast = createMockToastService();

  return render(ProgressDashboardPageComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      { provide: ProgressService, useValue: progressService },
      { provide: AuthService, useValue: authService },
      { provide: ToastService, useValue: toast },
    ],
  }).then(result => ({ ...result, progressService, authService, toast }));
}

describe('ProgressDashboardPageComponent', () => {
  it('should call loadDashboardData on init', async () => {
    const { progressService } = await renderDashboard();
    expect(progressService.loadDashboardData).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const progressService = createMockProgressService({ loading: true });
    await renderDashboard({ progressService });
    expect(screen.getByText('Loading progress data...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const progressService = createMockProgressService({ error: 'Permission denied' });
    await renderDashboard({ progressService });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no users match', async () => {
    await renderDashboard();
    expect(screen.getByText('No users match the current filters.')).toBeTruthy();
  });

  it('should render user rows with email and name', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', email: 'alice@test.com', full_name: 'Alice Smith' }),
        createMockDashboardUserProgress({ user_id: 'u2', email: 'bob@test.com', full_name: null }),
      ],
    });

    await renderDashboard({ progressService });

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
    // null full_name renders as dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter users by search term (email)', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', email: 'alice@test.com', full_name: 'Alice' }),
        createMockDashboardUserProgress({ user_id: 'u2', email: 'bob@test.com', full_name: 'Bob' }),
      ],
    });

    const { fixture } = await renderDashboard({ progressService });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    vi.useFakeTimers();
    fireEvent.input(searchInput, { target: { value: 'alice' } });
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    vi.useRealTimers();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter users by course', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({
          user_id: 'u1', email: 'alice@test.com',
          courses: [{ course_id: 'c1', course_title: 'Course A', completed: 1, total: 2, percent: 50 }],
        }),
        createMockDashboardUserProgress({
          user_id: 'u2', email: 'bob@test.com',
          courses: [{ course_id: 'c2', course_title: 'Course B', completed: 0, total: 3, percent: 0 }],
        }),
      ],
      courses: [{ id: 'c1', title: 'Course A' }, { id: 'c2', title: 'Course B' }],
    });

    const { fixture } = await renderDashboard({ progressService });

    const courseSelect = screen.getByRole('combobox');
    fireEvent.change(courseSelect, { target: { value: 'c1' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should filter users by progress range', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', email: 'alice@test.com', overallPercent: 80 }),
        createMockDashboardUserProgress({ user_id: 'u2', email: 'bob@test.com', overallPercent: 20 }),
      ],
    });

    const { fixture, container } = await renderDashboard({ progressService });

    // Set min to 50
    const numberInputs = container.querySelectorAll('input[type="number"]');
    fireEvent.input(numberInputs[0], { target: { value: '50' } });
    fixture.detectChanges();

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.queryByText('bob@test.com')).toBeFalsy();
  });

  it('should show tenant column for platform admin', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress({ tenant_name: 'Acme Corp' })],
    });

    await renderDashboard({
      progressService,
      authService: createMockAuthService({
        isAuthenticated: true,
        claims: { is_platform_admin: true },
      }),
    });

    expect(screen.getByText('Tenant')).toBeTruthy();
    expect(screen.getByText('Acme Corp')).toBeTruthy();
  });

  it('should hide tenant column for tenant admin', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress()],
    });

    await renderDashboard({
      progressService,
      authService: createMockAuthService({
        isAuthenticated: true,
        claims: { is_tenant_admin: true },
      }),
    });

    expect(screen.queryByText('Tenant')).toBeFalsy();
  });

  it('should toggle user selection via checkbox', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress({ user_id: 'u1' })],
    });

    const { fixture, container } = await renderDashboard({ progressService });

    // User row checkbox (skip header checkbox)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const userCheckbox = checkboxes[1]; // [0] is header select-all

    fireEvent.click(userCheckbox);
    fixture.detectChanges();

    // Send Reminder button should appear
    expect(screen.getByText(/Send Reminder/)).toBeTruthy();
  });

  it('should select all users via header checkbox', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', email: 'a@t.com' }),
        createMockDashboardUserProgress({ user_id: 'u2', email: 'b@t.com' }),
      ],
    });

    const { fixture, container } = await renderDashboard({ progressService });

    const headerCheckbox = container.querySelectorAll('input[type="checkbox"]')[0];
    fireEvent.click(headerCheckbox);
    fixture.detectChanges();

    // Button should show count of 2
    expect(screen.getByText(/Send Reminder \(2\)/)).toBeTruthy();
  });

  it('should not show Send Reminder button when no users selected', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress()],
    });

    await renderDashboard({ progressService });

    expect(screen.queryByText(/Send Reminder/)).toBeFalsy();
  });

  it('should send reminders and show success toast', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress({ user_id: 'u1' })],
    });
    progressService.sendReminders.mockReturnValue(of({ sent: 1, failed: 0 }));

    const { fixture, container, toast } = await renderDashboard({ progressService });

    // Select user
    const userCheckbox = container.querySelectorAll('input[type="checkbox"]')[1];
    fireEvent.click(userCheckbox);
    fixture.detectChanges();

    // Open reminder panel
    fireEvent.click(screen.getByText(/Send Reminder/));
    fixture.detectChanges();

    // Click Send in panel
    fireEvent.click(screen.getByText('Send'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(progressService.sendReminders).toHaveBeenCalledWith({
      user_ids: ['u1'],
      course_id: null,
      message: 'You have incomplete courses. Continue learning to stay on track!',
    });
    expect(toast.success).toHaveBeenCalledWith('Reminders sent: 1 delivered, 0 failed');
  });

  it('should show reminder error toast on failure', async () => {
    const progressService = createMockProgressService({
      users: [createMockDashboardUserProgress({ user_id: 'u1' })],
    });
    const errorSubject = new Subject();
    progressService.sendReminders.mockReturnValue(errorSubject.asObservable());

    const { fixture, container, toast } = await renderDashboard({ progressService });

    // Select user + open reminder panel
    fireEvent.click(container.querySelectorAll('input[type="checkbox"]')[1]);
    fixture.detectChanges();
    fireEvent.click(screen.getByText(/Send Reminder/));
    fixture.detectChanges();

    // Click Send — firstValueFrom subscribes, promise is pending
    fireEvent.click(screen.getByText('Send'));
    await new Promise(r => setTimeout(r));

    // Error the subject — rejection is caught by the component's try/catch
    errorSubject.error(new Error('SMTP down'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('SMTP down');
  });

  it('should compute summary stats correctly', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', overallPercent: 100 }),
        createMockDashboardUserProgress({ user_id: 'u2', overallPercent: 50 }),
        createMockDashboardUserProgress({ user_id: 'u3', overallPercent: 10 }),
        createMockDashboardUserProgress({ user_id: 'u4', overallPercent: 0 }),
      ],
    });

    await renderDashboard({ progressService });

    // Total Users = 4
    expect(screen.getByText('4')).toBeTruthy();
    // Avg Progress = (100+50+10+0)/4 = 40%
    expect(screen.getByText('40%')).toBeTruthy();
    // Completed (100%) = 1
    expect(screen.getByText('1')).toBeTruthy();
    // At Risk (<25% and <100) = 2 (10% and 0%)
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('should show pagination when more than 50 users', async () => {
    const users = Array.from({ length: 60 }, (_, i) =>
      createMockDashboardUserProgress({ user_id: `u${i}`, email: `user${i}@test.com` }),
    );
    const progressService = createMockProgressService({ users });

    await renderDashboard({ progressService });

    expect(screen.getByText(/Showing 1.50 of 60/)).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.getByText('Previous')).toBeTruthy();
  });

  it('should hide pagination when 50 or fewer users', async () => {
    const progressService = createMockProgressService({
      users: [
        createMockDashboardUserProgress({ user_id: 'u1', email: 'a@t.com' }),
        createMockDashboardUserProgress({ user_id: 'u2', email: 'b@t.com' }),
      ],
    });

    await renderDashboard({ progressService });

    expect(screen.queryByText('Next')).toBeFalsy();
    expect(screen.queryByText('Previous')).toBeFalsy();
  });

  it('should navigate to next page', async () => {
    const users = Array.from({ length: 60 }, (_, i) =>
      createMockDashboardUserProgress({ user_id: `u${i}`, email: `user${i}@test.com` }),
    );
    const progressService = createMockProgressService({ users });

    const { fixture } = await renderDashboard({ progressService });

    fireEvent.click(screen.getByText('Next'));
    fixture.detectChanges();

    expect(screen.getByText(/Showing 51.60 of 60/)).toBeTruthy();
  });

  it('should reset page to 1 on search filter change', async () => {
    const users = Array.from({ length: 60 }, (_, i) =>
      createMockDashboardUserProgress({ user_id: `u${i}`, email: `user${i}@test.com` }),
    );
    const progressService = createMockProgressService({ users });

    const { fixture } = await renderDashboard({ progressService });

    // Go to page 2
    fireEvent.click(screen.getByText('Next'));
    fixture.detectChanges();
    expect(screen.getByText(/Showing 51.60 of 60/)).toBeTruthy();

    // Search — should reset to page 1
    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    vi.useFakeTimers();
    fireEvent.input(searchInput, { target: { value: 'user1' } });
    fixture.detectChanges();
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    vi.useRealTimers();

    // Page should be reset (no "51-60" showing)
    expect(screen.queryByText(/Showing 51/)).toBeFalsy();
  });
});
