import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component, input } from '@angular/core';
import { ProgressManagerComponent } from './progress-manager.component';
import { CourseService } from '../../../core/services/course.service';
import { createMockCourseService, createMockUserProgressSummary } from '../../../__mocks__/course.mock';
import { LectureWithModules, UserProgressSummary } from '../../../core/models/course.model';

@Component({
  selector: 'app-test-host',
  imports: [ProgressManagerComponent],
  template: `
    <app-progress-manager [courseId]="courseId()" [lectures]="lectures()" />
  `,
})
class TestHostComponent {
  readonly courseId = input('course-1');
  readonly lectures = input<LectureWithModules[]>([
    {
      id: 'l1', title: 'Lecture 1', description: null, sort_order: 0,
      modules: [
        { id: 'mod-1', title: 'Video Module', module_type: 'video', sort_order: 0 },
        { id: 'mod-2', title: 'PDF Module', module_type: 'pdf', sort_order: 1 },
      ],
    },
  ]);
}

describe('ProgressManagerComponent', () => {
  let mockService: ReturnType<typeof createMockCourseService>;
  const user = userEvent.setup();

  async function renderComponent(progressData: UserProgressSummary[] = []) {
    mockService = createMockCourseService();
    mockService.loadCourseProgressAdmin = vi.fn().mockResolvedValue(progressData);

    const { fixture, container } = await render(TestHostComponent, {
      providers: [
        { provide: CourseService, useValue: mockService },
      ],
    });

    // Wait for ngOnInit async call
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    return { fixture, container };
  }

  it('should call loadCourseProgressAdmin on init', async () => {
    await renderComponent();
    expect(mockService.loadCourseProgressAdmin).toHaveBeenCalledWith('course-1');
  });

  it('should show loading spinner during load', async () => {
    mockService = createMockCourseService();
    mockService.loadCourseProgressAdmin = vi.fn().mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { fixture } = await render(TestHostComponent, {
      providers: [
        { provide: CourseService, useValue: mockService },
      ],
    });

    fixture.detectChanges();
    expect(screen.getByText('Loading progress data...')).toBeTruthy();
  });

  it('should show empty state when no enrolled users', async () => {
    await renderComponent([]);
    expect(screen.getByText('No enrolled users to show progress for.')).toBeTruthy();
  });

  it('should render user rows with email, name, and progress', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', completed: 1, total: 2,
      }),
      createMockUserProgressSummary({
        user_id: 'u2', email: 'bob@test.com', full_name: null, completed: 0, total: 2,
        modules: {},
      }),
    ];

    await renderComponent(users);

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('1/2')).toBeTruthy();

    expect(screen.getByText('bob@test.com')).toBeTruthy();
    expect(screen.getByText('0/2')).toBeTruthy();
  });

  it('should expand module list on user click', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', completed: 1, total: 2,
        modules: {
          'mod-1': { module_id: 'mod-1', status: 'completed', completed_at: '2026-01-15T10:00:00Z', marked_by: 'user' },
        },
      }),
    ];

    const { fixture } = await renderComponent(users);

    // Module list shouldn't be visible yet
    expect(screen.queryByText('Video Module')).toBeNull();

    // Click user row
    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    // Module list should now be visible
    expect(screen.getByText('Video Module')).toBeTruthy();
    expect(screen.getByText('PDF Module')).toBeTruthy();
  });

  it('should show status badges for modules', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', completed: 1, total: 2,
        modules: {
          'mod-1': { module_id: 'mod-1', status: 'completed', completed_at: '2026-01-15T10:00:00Z', marked_by: 'user' },
        },
      }),
    ];

    const { fixture } = await renderComponent(users);

    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Not Started')).toBeTruthy();
  });

  it('should show Mark Complete button for non-completed modules', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', completed: 0, total: 2,
        modules: {},
      }),
    ];

    const { fixture } = await renderComponent(users);

    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    const markButtons = screen.getAllByText('Mark Complete');
    expect(markButtons).toHaveLength(2);
  });

  it('should show Reset button for completed modules', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', completed: 1, total: 2,
        modules: {
          'mod-1': { module_id: 'mod-1', status: 'completed', completed_at: '2026-01-15T10:00:00Z', marked_by: 'user' },
        },
      }),
    ];

    const { fixture } = await renderComponent(users);

    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    expect(screen.getByText('Reset')).toBeTruthy();
  });

  it('should call adminMarkModuleComplete and reload on Mark Complete', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', tenant_id: 't1', email: 'alice@test.com', full_name: 'Alice', completed: 0, total: 2,
        modules: {},
      }),
    ];

    const { fixture } = await renderComponent(users);

    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    const markButtons = screen.getAllByText('Mark Complete');
    await user.click(markButtons[0]);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(mockService.adminMarkModuleComplete).toHaveBeenCalledWith('u1', 't1', 'course-1', 'l1', 'mod-1');
    // Should reload after action
    expect(mockService.loadCourseProgressAdmin).toHaveBeenCalledTimes(2);
  });

  it('should call adminResetModuleProgress and reload on Reset', async () => {
    const users = [
      createMockUserProgressSummary({
        user_id: 'u1', tenant_id: 't1', email: 'alice@test.com', full_name: 'Alice', completed: 1, total: 2,
        modules: {
          'mod-1': { module_id: 'mod-1', status: 'completed', completed_at: '2026-01-15T10:00:00Z', marked_by: 'user' },
        },
      }),
    ];

    const { fixture } = await renderComponent(users);

    await user.click(screen.getByText('alice@test.com'));
    fixture.detectChanges();

    await user.click(screen.getByText('Reset'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(mockService.adminResetModuleProgress).toHaveBeenCalledWith('u1', 'mod-1');
    expect(mockService.loadCourseProgressAdmin).toHaveBeenCalledTimes(2);
  });

  it('should show error on failure', async () => {
    mockService = createMockCourseService();
    mockService.loadCourseProgressAdmin = vi.fn().mockRejectedValue(new Error('Network error'));

    const { fixture } = await render(TestHostComponent, {
      providers: [
        { provide: CourseService, useValue: mockService },
      ],
    });

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Network error')).toBeTruthy();
  });
});
