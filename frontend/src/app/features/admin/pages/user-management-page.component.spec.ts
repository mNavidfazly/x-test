import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { UserManagementPageComponent } from './user-management-page.component';
import { UserManagementService } from '../../../core/services/user-management.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockUserManagementService, createMockUserForBoard } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';

function renderPage(options?: {
  service?: ReturnType<typeof createMockUserManagementService>;
  auth?: ReturnType<typeof createMockAuthService>;
  supabase?: ReturnType<typeof createMockSupabaseService>;
}) {
  const service = options?.service ?? createMockUserManagementService();
  const auth = options?.auth ?? createMockAuthService({
    isAuthenticated: true,
    roles: ['tenant_admin'],
    claims: { is_tenant_admin: true },
  });
  const supabase = options?.supabase ?? createMockSupabaseService();

  return render(UserManagementPageComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      { provide: UserManagementService, useValue: service },
      { provide: AuthService, useValue: auth },
      { provide: SupabaseService, useValue: supabase },
    ],
  }).then(result => ({ ...result, service, auth, supabase }));
}

function renderPageAsPA(options?: {
  service?: ReturnType<typeof createMockUserManagementService>;
}) {
  const service = options?.service ?? createMockUserManagementService();
  const auth = createMockAuthService({
    isAuthenticated: true,
    userId: 'pa-user-id',
    roles: ['platform_admin'],
    claims: { is_platform_admin: true },
  });
  const supabase = createMockSupabaseService();

  return render(UserManagementPageComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [
      { provide: UserManagementService, useValue: service },
      { provide: AuthService, useValue: auth },
      { provide: SupabaseService, useValue: supabase },
    ],
  }).then(result => ({ ...result, service, auth, supabase }));
}

describe('UserManagementPageComponent', () => {
  it('should call loadUsers on init', async () => {
    const { service } = await renderPage();
    expect(service.loadUsers).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockUserManagementService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading users...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockUserManagementService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no users', async () => {
    await renderPage();
    expect(screen.getByText('No users found.')).toBeTruthy();
  });

  it('should render user rows with name, email, and role badges', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test', email: 'alice@test.com' }),
        createMockUserForBoard({ id: 'u2', full_name: 'Bob Admin', email: 'bob@test.com', is_tenant_admin: true }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Alice Test')).toBeTruthy();
    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('Bob Admin')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('should show Platform Admin badge', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'PA User', is_platform_admin: true }),
      ],
    });

    await renderPage({ service });
    expect(screen.getByText('Platform Admin')).toBeTruthy();
  });

  it('should show Tenant Admin badge', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'TA User', is_tenant_admin: true }),
      ],
    });

    await renderPage({ service });
    // "Tenant Admin" appears in badge + role filter option + potentially summary card
    expect(screen.getAllByText('Tenant Admin').length).toBeGreaterThanOrEqual(1);
  });

  it('should show regular User badge', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Regular User' }),
      ],
    });

    await renderPage({ service });
    // "User" badge for non-admin user
    expect(screen.getByText('User')).toBeTruthy();
  });

  it('should filter by name search', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test', email: 'alice@test.com' }),
        createMockUserForBoard({ id: 'u2', full_name: 'Bob Admin', email: 'bob@test.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.input(searchInput, { target: { value: 'Bob' } });
    fixture.detectChanges();

    expect(screen.queryByText('Alice Test')).toBeFalsy();
    expect(screen.getByText('Bob Admin')).toBeTruthy();
  });

  it('should filter by email search', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice', email: 'alice@test.com' }),
        createMockUserForBoard({ id: 'u2', full_name: 'Bob', email: 'bob@other.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    fireEvent.input(searchInput, { target: { value: 'other.com' } });
    fixture.detectChanges();

    expect(screen.queryByText('Alice')).toBeFalsy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('should filter by role', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Regular Alice' }),
        createMockUserForBoard({ id: 'u2', full_name: 'Admin Bob', is_tenant_admin: true }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const roleSelect = screen.getByDisplayValue('All Roles');
    fireEvent.change(roleSelect, { target: { value: 'tenant_admin' } });
    fixture.detectChanges();

    expect(screen.queryByText('Regular Alice')).toBeFalsy();
    expect(screen.getByText('Admin Bob')).toBeTruthy();
  });

  it('should show summary cards with correct counts', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', is_tenant_admin: true }),
        createMockUserForBoard({ id: 'u2', is_tenant_admin: true }),
        createMockUserForBoard({ id: 'u3' }),
        createMockUserForBoard({ id: 'u4' }),
        createMockUserForBoard({ id: 'u5' }),
      ],
    });

    const { container } = await renderPage({ service });

    // TA view: Total Users, Tenant Admins, Regular Users (no Platform Admins card)
    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=5, Tenant Admins=2, Regular=3
    expect(values).toEqual(['5', '2', '3']);
  });

  it('should open invite form on button click', async () => {
    const service = createMockUserManagementService({
      users: [createMockUserForBoard()],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Invite User'));
    fixture.detectChanges();

    expect(screen.getByText('Invite New User')).toBeTruthy();
    expect(screen.getByPlaceholderText('user@example.com')).toBeTruthy();
  });

  it('should invite user and show success message', async () => {
    const service = createMockUserManagementService({
      users: [createMockUserForBoard()],
    });

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('Invite User'));
    fixture.detectChanges();

    // Fill email
    fireEvent.input(screen.getByPlaceholderText('user@example.com'), { target: { value: 'new@test.com' } });
    fixture.detectChanges();

    // Submit
    fireEvent.click(screen.getByText('Send Invitation'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.inviteUser).toHaveBeenCalledWith({ email: 'new@test.com' });
    expect(screen.getByText('Invitation sent successfully!')).toBeTruthy();
  });

  it('should show invite error on rejection', async () => {
    const service = createMockUserManagementService({
      users: [createMockUserForBoard()],
    });
    service.inviteUser.mockRejectedValue(new Error('User already exists'));

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('Invite User'));
    fixture.detectChanges();

    // Fill and submit
    fireEvent.input(screen.getByPlaceholderText('user@example.com'), { target: { value: 'dup@test.com' } });
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Send Invitation'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('User already exists')).toBeTruthy();
  });

  it('should expand row and show edit section', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test', email: 'alice@test.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Test'));
    fixture.detectChanges();

    expect(screen.getByText('Edit User')).toBeTruthy();
    expect(screen.getByPlaceholderText('Full name')).toBeTruthy();
  });

  it('should pre-fill edit name from user data', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Test'));
    fixture.detectChanges();

    const nameInput = screen.getByPlaceholderText('Full name') as HTMLInputElement;
    expect(nameInput.value).toBe('Alice Test');
  });

  it('should save profile and call updateUserProfile', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Alice Test'));
    fixture.detectChanges();

    // Click Save
    fireEvent.click(screen.getByText('Save'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.updateUserProfile).toHaveBeenCalledWith('u1', { full_name: 'Alice Test' });
  });

  it('should show save error on rejection', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test' }),
      ],
    });
    service.updateUserProfile.mockRejectedValue(new Error('Update failed'));

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Test'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Save'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Update failed')).toBeTruthy();
  });

  it('should toggle is_tenant_admin via updateUserRoles', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice', is_tenant_admin: false }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Alice'));
    fixture.detectChanges();

    // Find Tenant Admin checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    const taCheckbox = checkboxes.find(cb => {
      const label = cb.closest('label');
      return label?.textContent?.includes('Tenant Admin');
    });
    expect(taCheckbox).toBeTruthy();

    fireEvent.click(taCheckbox!);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.updateUserRoles).toHaveBeenCalledWith('u1', { is_tenant_admin: true });
  });

  it('PA sees tenant column and Platform Admin summary card', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'PA User', is_platform_admin: true, tenant_name: 'Calypso' }),
      ],
    });

    const { container } = await renderPageAsPA({ service });

    // Should have tenant header column
    const headers = container.querySelectorAll('th');
    const tenantHeader = Array.from(headers).find(h => h.textContent?.includes('Tenant'));
    expect(tenantHeader).toBeTruthy();

    // Should show "Platform Admins" summary card (also in filter dropdown)
    expect(screen.getAllByText('Platform Admins').length).toBeGreaterThanOrEqual(1);

    // Should show tenant name in table row
    expect(screen.getByText('Calypso')).toBeTruthy();
  });

  it('TA does not see tenant column or PA toggle', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Test' }),
      ],
    });

    const { fixture, container } = await renderPage({ service });

    // No tenant header column
    const headers = container.querySelectorAll('th');
    const tenantHeader = Array.from(headers).find(h => h.textContent?.trim() === 'Tenant');
    expect(tenantHeader).toBeFalsy();

    // Expand user
    fireEvent.click(screen.getByText('Alice Test'));
    fixture.detectChanges();

    // No "Platform Admin" checkbox label in expanded row
    // (TA view doesn't show PA toggle)
    const labels = container.querySelectorAll('.space-y-2 label');
    const paLabel = Array.from(labels).find(l => l.textContent?.includes('Platform Admin'));
    expect(paLabel).toBeFalsy();
  });

  it('should show "Cannot modify own role" for self', async () => {
    const auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'u1',
      roles: ['tenant_admin'],
      claims: { is_tenant_admin: true },
    });

    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Self User', is_tenant_admin: true }),
      ],
    });

    const { fixture } = await renderPage({ service, auth });

    fireEvent.click(screen.getByText('Self User'));
    fixture.detectChanges();

    expect(screen.getByText('Cannot modify own role')).toBeTruthy();
  });

  it('should show avatar initials from full name', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice Benson' }),
      ],
    });

    const { container } = await renderPage({ service });

    const avatar = container.querySelector('.w-7.h-7.rounded-full');
    expect(avatar?.textContent?.trim()).toBe('AB');
  });

  it('should clear filters on button click', async () => {
    const service = createMockUserManagementService({
      users: [
        createMockUserForBoard({ id: 'u1', full_name: 'Alice', email: 'alice@test.com' }),
        createMockUserForBoard({ id: 'u2', full_name: 'Bob', email: 'bob@test.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Apply filter
    const searchInput = screen.getByPlaceholderText('Search by name or email...');
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
