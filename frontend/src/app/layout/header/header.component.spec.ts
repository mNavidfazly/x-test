import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Component } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { CourseService } from '../../core/services/course.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockProfileService } from '../../__mocks__/profile.mock';
import { createMockNotificationService, createMockCourseService } from '../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';
import { UserRole } from '../../core/models/auth.model';

@Component({ standalone: true, template: '' })
class DummyComponent {}

async function renderHeader(options?: {
  email?: string;
  fullName?: string | null;
  avatarUrl?: string | null;
  unreadCount?: number;
  roles?: UserRole[];
  url?: string;
}) {
  const auth = createMockAuthService({
    isAuthenticated: true,
    email: options?.email ?? 'test@example.com',
    roles: options?.roles ?? ['learner'],
  });
  const profile = createMockProfileService({
    profile: options?.fullName !== undefined || options?.avatarUrl !== undefined
      ? { full_name: options?.fullName ?? null, avatar_url: options?.avatarUrl ?? null }
      : null,
  });
  const notifications = createMockNotificationService({
    unreadCount: options?.unreadCount ?? 0,
  });

  const menuToggleSpy = vi.fn();

  const { fixture } = await render(HeaderComponent, {
    componentImports: [MockLucideIconComponent, UserAvatarComponent],
    componentOutputs: { menuToggle: { emit: menuToggleSpy } as any },
    providers: [
      provideRouter([{ path: '**', component: DummyComponent }]),
      { provide: AuthService, useValue: auth },
      { provide: ProfileService, useValue: profile },
      { provide: NotificationService, useValue: notifications },
      { provide: CourseService, useValue: createMockCourseService() },
    ],
  });

  if (options?.url) {
    const router = TestBed.inject(Router);
    await router.navigateByUrl(options.url);
    fixture.detectChanges();
  }

  return { fixture, auth, profile, notifications, menuToggleSpy };
}

describe('HeaderComponent', () => {
  it('should render hamburger button', async () => {
    await renderHeader();
    expect(screen.getByLabelText('Toggle menu')).toBeTruthy();
  });

  it('should emit menuToggle when hamburger clicked', async () => {
    const { menuToggleSpy } = await renderHeader();
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Toggle menu'));
    expect(menuToggleSpy).toHaveBeenCalled();
  });

  it('should show notification bell', async () => {
    await renderHeader();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it('should show profile display name', async () => {
    await renderHeader({ fullName: 'John Doe' });
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('should fall back to email when no profile name', async () => {
    await renderHeader({ email: 'user@test.com' });
    expect(screen.getByText('user@test.com')).toBeTruthy();
  });

  it('should show initials when no avatar', async () => {
    await renderHeader({ fullName: 'John Doe' });
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('should call auth.signOut on sign out', async () => {
    const { auth } = await renderHeader({ fullName: 'Test' });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    await user.click(screen.getByText('Sign out'));

    expect(auth.signOut).toHaveBeenCalled();
  });

  it('should show unread badge when count > 0', async () => {
    await renderHeader({ fullName: 'Test', unreadCount: 5 });
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('should hide badge when count is 0', async () => {
    await renderHeader({ fullName: 'Test', unreadCount: 0 });
    expect(screen.queryByText('0')).toBeNull();
  });

  it('should show 99+ when count > 99', async () => {
    await renderHeader({ fullName: 'Test', unreadCount: 150 });
    expect(screen.getByText('99+')).toBeTruthy();
  });

  // Breadcrumb tests
  it('should show breadcrumb for /dashboard', async () => {
    await renderHeader({ fullName: 'Test', url: '/dashboard' });
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByLabelText('Breadcrumb')).toBeTruthy();
  });

  it('should show breadcrumb "Courses" for /courses/some-id', async () => {
    await renderHeader({ fullName: 'Test', url: '/courses/abc-123' });
    expect(screen.getByText('Courses')).toBeTruthy();
  });

  it('should show breadcrumb "Exam Grading" for /teaching/grading', async () => {
    await renderHeader({ fullName: 'Test', url: '/teaching/grading' });
    expect(screen.getByText('Exam Grading')).toBeTruthy();
  });

  it('should not show breadcrumb for unknown route /', async () => {
    await renderHeader({ fullName: 'Test' });
    expect(screen.queryByLabelText('Breadcrumb')).toBeNull();
  });

  // Role label tests
  it('should show "Platform Admin" role label for PA', async () => {
    await renderHeader({ fullName: 'Admin', roles: ['platform_admin', 'learner'] });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getAllByText('Platform Admin').length).toBeGreaterThan(0);
  });

  it('should show "Tenant Admin" role label for TA', async () => {
    await renderHeader({ fullName: 'Admin', roles: ['tenant_admin', 'learner'] });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getAllByText('Tenant Admin').length).toBeGreaterThan(0);
  });

  it('should show "Lecturer" role label for lecturer', async () => {
    await renderHeader({ fullName: 'Prof', roles: ['lecturer', 'learner'] });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getAllByText('Lecturer').length).toBeGreaterThan(0);
  });

  it('should show "Learner" role label by default', async () => {
    await renderHeader({ fullName: 'Student', roles: ['learner'] });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getAllByText('Learner').length).toBeGreaterThan(0);
  });

  // ARIA tests
  it('should have aria-haspopup on user menu button', async () => {
    await renderHeader({ fullName: 'Test' });
    const button = screen.getByLabelText('User menu');
    expect(button.getAttribute('aria-haspopup')).toBe('true');
  });

  it('should toggle aria-expanded on user menu', async () => {
    await renderHeader({ fullName: 'Test' });
    const user = userEvent.setup();
    const button = screen.getByLabelText('User menu');

    expect(button.getAttribute('aria-expanded')).toBe('false');
    await user.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('should have role="menu" on dropdown', async () => {
    await renderHeader({ fullName: 'Test' });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('should have role="menuitem" on dropdown items', async () => {
    await renderHeader({ fullName: 'Test' });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    const items = screen.getAllByRole('menuitem');
    expect(items.length).toBe(2); // Profile + Sign out
  });

  // Dropdown info tests
  it('should show email in dropdown', async () => {
    await renderHeader({ fullName: 'Test User', email: 'test@calypso.com' });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('test@calypso.com')).toBeTruthy();
  });

  it('should show role badge in dropdown', async () => {
    await renderHeader({ fullName: 'Test', roles: ['csm', 'learner'] });
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('User menu'));
    expect(screen.getAllByText('CSM').length).toBeGreaterThan(0);
  });
});
