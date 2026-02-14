import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { LecturerAssignmentPageComponent } from './lecturer-assignment-page.component';
import { LecturerAssignmentService } from '../../../core/services/lecturer-assignment.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  createMockLecturerAssignment,
  createMockLecturerAssignmentService,
} from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

function renderPage(options?: {
  service?: ReturnType<typeof createMockLecturerAssignmentService>;
  auth?: ReturnType<typeof createMockAuthService>;
}) {
  const service = options?.service ?? createMockLecturerAssignmentService();
  const auth = options?.auth ?? createMockAuthService({
    isAuthenticated: true,
    userId: 'pa-user-id',
    roles: ['platform_admin'],
    claims: { is_platform_admin: true },
  });

  return render(LecturerAssignmentPageComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      { provide: LecturerAssignmentService, useValue: service },
      { provide: AuthService, useValue: auth },
    ],
  }).then(result => ({ ...result, service, auth }));
}

describe('LecturerAssignmentPageComponent', () => {
  it('should call loadAssignments on init', async () => {
    const { service } = await renderPage();
    expect(service.loadAssignments).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockLecturerAssignmentService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading assignments...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockLecturerAssignmentService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no assignments', async () => {
    await renderPage();
    expect(screen.getByText('No lecturer assignments yet. Click "New Assignment" to add one.')).toBeTruthy();
  });

  it('should render assignment rows with lecturer info and course title', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({
          id: 'a1',
          full_name: 'Alice Lecturer',
          email: 'alice@master.com',
          course_title: 'Course Alpha',
        }),
        createMockLecturerAssignment({
          id: 'a2',
          full_name: 'Bob Lecturer',
          email: 'bob@master.com',
          course_title: 'Course Beta',
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Alice Lecturer')).toBeTruthy();
    expect(screen.getByText('alice@master.com')).toBeTruthy();
    expect(screen.getByText('Course Alpha')).toBeTruthy();
    expect(screen.getByText('Bob Lecturer')).toBeTruthy();
    expect(screen.getByText('bob@master.com')).toBeTruthy();
    expect(screen.getByText('Course Beta')).toBeTruthy();
  });

  it('should show "Edit" badge for can_edit=true', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', can_edit: true, can_grade: false }),
      ],
    });

    await renderPage({ service });
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.queryByText('Grade')).toBeFalsy();
  });

  it('should show "Grade" badge for can_grade=true', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', can_edit: false, can_grade: true }),
      ],
    });

    await renderPage({ service });
    expect(screen.getByText('Grade')).toBeTruthy();
    expect(screen.queryByText('Edit')).toBeFalsy();
  });

  it('should show "View Only" badge when both permissions are false', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', can_edit: false, can_grade: false }),
      ],
    });

    await renderPage({ service });
    expect(screen.getByText('View Only')).toBeTruthy();
  });

  it('should filter by lecturer name search', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', full_name: 'Alice', email: 'alice@m.com', course_title: 'Course X' }),
        createMockLecturerAssignment({ id: 'a2', full_name: 'Bob', email: 'bob@m.com', course_title: 'Course Y' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name, email, or course...');
    fireEvent.input(searchInput, { target: { value: 'Alice' } });
    fixture.detectChanges();

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.queryByText('Bob')).toBeFalsy();
  });

  it('should filter by course title search', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', full_name: 'Alice', email: 'alice@m.com', course_title: 'Intro to Finance' }),
        createMockLecturerAssignment({ id: 'a2', full_name: 'Bob', email: 'bob@m.com', course_title: 'Advanced Python' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name, email, or course...');
    fireEvent.input(searchInput, { target: { value: 'Python' } });
    fixture.detectChanges();

    expect(screen.queryByText('Alice')).toBeFalsy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('should show summary cards with correct counts', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', user_id: 'u1', can_edit: true, can_grade: true }),
        createMockLecturerAssignment({ id: 'a2', user_id: 'u1', can_edit: true, can_grade: false }),
        createMockLecturerAssignment({ id: 'a3', user_id: 'u2', can_edit: false, can_grade: true }),
      ],
    });

    const { container } = await renderPage({ service });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=3, Lecturers=2 (u1, u2), Edit=2 (a1, a2), Grade=2 (a1, a3)
    expect(values).toEqual(['3', '2', '2', '2']);
  });

  it('should show JWT warning banner', async () => {
    await renderPage();
    expect(screen.getByText(/Permission changes take effect when the lecturer next logs in/)).toBeTruthy();
  });

  it('should toggle new assignment form visibility', async () => {
    const { fixture } = await renderPage();

    // Form hidden initially
    expect(screen.queryByText('New Assignment', { selector: 'h2' })).toBeFalsy();

    // Click to open
    fireEvent.click(screen.getByText('New Assignment', { selector: 'button' }));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Lecturer', { selector: 'label' })).toBeTruthy();
    expect(screen.getByText('Course', { selector: 'label' })).toBeTruthy();
  });

  it('should have course dropdown disabled until lecturer selected', async () => {
    const service = createMockLecturerAssignmentService();
    service.loadAvailableLecturers.mockResolvedValue([
      { id: 'l1', email: 'lect@m.com', full_name: 'Lect One' },
    ]);

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('New Assignment', { selector: 'button' }));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Course dropdown should be disabled
    const courseSelect = screen.getByDisplayValue('Select a course...');
    expect((courseSelect as HTMLSelectElement).disabled).toBe(true);
  });

  it('should call addAssignment with correct args', async () => {
    const service = createMockLecturerAssignmentService();
    service.loadAvailableLecturers.mockResolvedValue([
      { id: 'l1', email: 'lect@m.com', full_name: 'Lect One' },
    ]);
    service.loadAvailableCourses.mockResolvedValue([
      { id: 'c1', title: 'Course A' },
    ]);

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('New Assignment', { selector: 'button' }));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Select lecturer
    const lecturerSelect = screen.getByDisplayValue('Select a lecturer...');
    fireEvent.change(lecturerSelect, { target: { value: 'l1' } });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Select course
    const courseSelect = screen.getByDisplayValue('Select a course...');
    fireEvent.change(courseSelect, { target: { value: 'c1' } });
    fixture.detectChanges();

    // Click add
    fireEvent.click(screen.getByText('Add Assignment'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.addAssignment).toHaveBeenCalledWith('l1', 'c1');
  });

  it('should show add assignment error', async () => {
    const service = createMockLecturerAssignmentService();
    service.loadAvailableLecturers.mockResolvedValue([
      { id: 'l1', email: 'lect@m.com', full_name: 'Lect One' },
    ]);
    service.loadAvailableCourses.mockResolvedValue([
      { id: 'c1', title: 'Course A' },
    ]);
    service.addAssignment.mockRejectedValue(new Error('Already assigned to this course'));

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('New Assignment', { selector: 'button' }));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Select lecturer
    const lecturerSelect = screen.getByDisplayValue('Select a lecturer...');
    fireEvent.change(lecturerSelect, { target: { value: 'l1' } });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Select course
    const courseSelect = screen.getByDisplayValue('Select a course...');
    fireEvent.change(courseSelect, { target: { value: 'c1' } });
    fixture.detectChanges();

    // Click add
    fireEvent.click(screen.getByText('Add Assignment'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Already assigned to this course')).toBeTruthy();
  });

  it('should expand row and show permission checkboxes and remove button', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({
          id: 'a1',
          full_name: 'Alice Lecturer',
          can_edit: true,
          can_grade: false,
          assigned_by_name: 'Platform Admin',
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Lecturer'));
    fixture.detectChanges();

    expect(screen.getByText('Can Edit Content')).toBeTruthy();
    expect(screen.getByText('Can Grade Exams')).toBeTruthy();
    expect(screen.getByText('Remove Assignment')).toBeTruthy();
    expect(screen.getByText('Platform Admin')).toBeTruthy();
  });

  it('should call updatePermissions when toggling can_edit', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({
          id: 'a1',
          full_name: 'Alice Lecturer',
          can_edit: false,
          can_grade: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Alice Lecturer'));
    fixture.detectChanges();

    // Toggle can_edit checkbox (first checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.change(checkboxes[0], { target: { checked: true } });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.updatePermissions).toHaveBeenCalledWith('a1', { can_edit: true });
  });

  it('should call updatePermissions when toggling can_grade', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({
          id: 'a1',
          full_name: 'Alice Lecturer',
          can_edit: true,
          can_grade: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Alice Lecturer'));
    fixture.detectChanges();

    // Toggle can_grade checkbox (second checkbox)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.change(checkboxes[1], { target: { checked: false } });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.updatePermissions).toHaveBeenCalledWith('a1', { can_grade: false });
  });

  it('should call removeAssignment and reload on remove', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({
          id: 'a1',
          full_name: 'Alice Lecturer',
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Alice Lecturer'));
    fixture.detectChanges();

    // Remove
    fireEvent.click(screen.getByText('Remove Assignment'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.removeAssignment).toHaveBeenCalledWith('a1');
    // loadAssignments called: once on init + once after remove
    expect(service.loadAssignments).toHaveBeenCalledTimes(2);
  });

  it('should clear search filter on button click', async () => {
    const service = createMockLecturerAssignmentService({
      assignments: [
        createMockLecturerAssignment({ id: 'a1', full_name: 'Alice', email: 'alice@m.com' }),
        createMockLecturerAssignment({ id: 'a2', full_name: 'Bob', email: 'bob@m.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Apply filter
    const searchInput = screen.getByPlaceholderText('Search by name, email, or course...');
    fireEvent.input(searchInput, { target: { value: 'Alice' } });
    fixture.detectChanges();

    expect(screen.queryByText('Bob')).toBeFalsy();

    // Clear
    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });
});
