import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { EnrollmentManagerComponent } from './enrollment-manager.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { createMockCourseService, createMockEnrolledUser } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';

describe('EnrollmentManagerComponent', () => {
  const renderManager = async (options?: {
    enrolledUsers?: ReturnType<typeof createMockEnrolledUser>[];
    claims?: { is_platform_admin?: boolean; is_tenant_admin?: boolean };
  }) => {
    const mockCourseService = createMockCourseService();
    const users = options?.enrolledUsers ?? [];
    mockCourseService.loadEnrolledUsers = vi.fn().mockResolvedValue(users);

    const mockAuthService = createMockAuthService({
      isAuthenticated: true,
      claims: options?.claims ?? { is_platform_admin: true },
    });

    const result = await render(EnrollmentManagerComponent, {
      componentInputs: { courseId: 'course-1', enrollmentType: 'open' as const },
      providers: [
        { provide: CourseService, useValue: mockCourseService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });

    // Wait for ngOnInit async load
    await new Promise(r => setTimeout(r));
    result.fixture.detectChanges();

    return { ...result, mockCourseService, mockAuthService };
  };

  it('calls loadEnrolledUsers on init', async () => {
    const { mockCourseService } = await renderManager();
    expect(mockCourseService.loadEnrolledUsers).toHaveBeenCalledWith('course-1');
  });

  it('shows empty state when no users enrolled', async () => {
    await renderManager({ enrolledUsers: [] });
    expect(screen.getByText('No users enrolled yet.')).toBeTruthy();
  });

  it('renders enrolled users list', async () => {
    const users = [
      createMockEnrolledUser({ id: 'e1', email: 'alice@test.com', full_name: 'Alice Smith', enrolled_at: '2026-01-10T00:00:00Z' }),
      createMockEnrolledUser({ id: 'e2', email: 'bob@test.com', full_name: null, enrolled_at: '2026-01-12T00:00:00Z' }),
    ];
    await renderManager({ enrolledUsers: users });

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('shows enrollment count in header', async () => {
    const users = [
      createMockEnrolledUser({ id: 'e1' }),
      createMockEnrolledUser({ id: 'e2' }),
    ];
    await renderManager({ enrolledUsers: users });
    expect(screen.getByText(/enrolled users \(2\)/i)).toBeTruthy();
  });

  it('shows email input and Add button', async () => {
    await renderManager();
    expect(screen.getByPlaceholderText('Enter user email to enroll')).toBeTruthy();
    expect(screen.getByRole('button', { name: /add/i })).toBeTruthy();
  });

  it('calls lookupUserByEmail and adminEnrollUser on add', async () => {
    const { mockCourseService } = await renderManager({ enrolledUsers: [] });
    mockCourseService.lookupUserByEmail = vi.fn().mockResolvedValue({ id: 'new-user', full_name: 'New User' });
    mockCourseService.adminEnrollUser = vi.fn().mockResolvedValue(undefined);
    mockCourseService.loadEnrolledUsers = vi.fn().mockResolvedValue([
      createMockEnrolledUser({ user_id: 'new-user', email: 'new@test.com' }),
    ]);

    const input = screen.getByPlaceholderText('Enter user email to enroll') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'new@test.com' } });

    const button = screen.getByRole('button', { name: /add/i });
    await fireEvent.click(button);

    // Wait for async operations
    await new Promise(r => setTimeout(r));

    expect(mockCourseService.lookupUserByEmail).toHaveBeenCalledWith('new@test.com', 'test-tenant-id');
    expect(mockCourseService.adminEnrollUser).toHaveBeenCalledWith('new-user', 'test-tenant-id', 'course-1');
  });

  it('shows error for non-existent email', async () => {
    const { fixture, mockCourseService } = await renderManager({ enrolledUsers: [] });
    mockCourseService.lookupUserByEmail = vi.fn().mockResolvedValue(null);

    const input = screen.getByPlaceholderText('Enter user email to enroll');
    await fireEvent.input(input, { target: { value: 'missing@test.com' } });

    const button = screen.getByRole('button', { name: /add/i });
    await fireEvent.click(button);

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('No user found with this email in your tenant')).toBeTruthy();
  });

  it('shows error for already enrolled user', async () => {
    const users = [createMockEnrolledUser({ user_id: 'u1', email: 'existing@test.com' })];
    const { fixture, mockCourseService } = await renderManager({ enrolledUsers: users });
    mockCourseService.lookupUserByEmail = vi.fn().mockResolvedValue({ id: 'u1', full_name: 'Existing' });

    const input = screen.getByPlaceholderText('Enter user email to enroll');
    await fireEvent.input(input, { target: { value: 'existing@test.com' } });

    const button = screen.getByRole('button', { name: /add/i });
    await fireEvent.click(button);

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('This user is already enrolled')).toBeTruthy();
  });

  it('calls unenrollUser and reloads on unenroll click', async () => {
    const users = [createMockEnrolledUser({ id: 'e1', email: 'alice@test.com' })];
    const { mockCourseService } = await renderManager({ enrolledUsers: users });
    mockCourseService.unenrollUser = vi.fn().mockResolvedValue(undefined);
    mockCourseService.loadEnrolledUsers = vi.fn().mockResolvedValue([]);

    const unenrollBtn = screen.getByTitle('Unenroll user');
    await fireEvent.click(unenrollBtn);

    await new Promise(r => setTimeout(r));

    expect(mockCourseService.unenrollUser).toHaveBeenCalledWith('e1');
    expect(mockCourseService.loadEnrolledUsers).toHaveBeenCalled();
  });

  it('shows error when email is empty on add', async () => {
    const { fixture } = await renderManager({ enrolledUsers: [] });

    const button = screen.getByRole('button', { name: /add/i });
    await fireEvent.click(button);

    fixture.detectChanges();
    expect(screen.getByText('Please enter an email address')).toBeTruthy();
  });
});
