import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { TenantManagementPageComponent } from './tenant-management-page.component';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockTenantManagementService, createMockTenantForBoard } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

function renderPage(options?: {
  service?: ReturnType<typeof createMockTenantManagementService>;
}) {
  const service = options?.service ?? createMockTenantManagementService();
  const toast = createMockToastService();

  return render(TenantManagementPageComponent, {
    componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
    providers: [
      { provide: TenantManagementService, useValue: service },
      { provide: ToastService, useValue: toast },
    ],
  }).then(result => ({ ...result, service, toast }));
}

describe('TenantManagementPageComponent', () => {
  it('should call loadTenants on init', async () => {
    const { service } = await renderPage();
    expect(service.loadTenants).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockTenantManagementService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading tenants...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockTenantManagementService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no tenants', async () => {
    await renderPage();
    expect(screen.getByText('No tenants found.')).toBeTruthy();
  });

  it('should render tenant rows with correct data', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({
          id: 't1', name: 'Calypso', domain: 'calypso.com',
          is_master: true, courseCount: 5, csmCount: 2,
          settings: { auth_methods: ['keycloak_sso'] },
        }),
        createMockTenantForBoard({
          id: 't2', name: 'Santos', domain: 'santos.com',
          is_master: false, courseCount: 3, csmCount: 0,
          settings: { auth_methods: ['email_password', 'magic_link'] },
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Calypso')).toBeTruthy();
    expect(screen.getByText('calypso.com')).toBeTruthy();
    expect(screen.getByText('Santos')).toBeTruthy();
    expect(screen.getByText('santos.com')).toBeTruthy();
  });

  it('should show Master badge on master tenant', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Calypso', is_master: true }),
      ],
    });

    await renderPage({ service });
    // "Master" appears in both badge and summary card label
    expect(screen.getAllByText('Master').length).toBeGreaterThanOrEqual(2);
  });

  it('should show auth method pills', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({
          id: 't1', name: 'Test',
          settings: { auth_methods: ['email_password', 'keycloak_sso'] },
        }),
      ],
    });

    await renderPage({ service });
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Keycloak SSO').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by name search', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Calypso', domain: 'calypso.com' }),
        createMockTenantForBoard({ id: 't2', name: 'Santos', domain: 'santos.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name or domain...');
    fireEvent.input(searchInput, { target: { value: 'Santos' } });
    fixture.detectChanges();

    expect(screen.queryByText('Calypso')).toBeFalsy();
    expect(screen.getByText('Santos')).toBeTruthy();
  });

  it('should filter by domain search', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Calypso', domain: 'calypso.com' }),
        createMockTenantForBoard({ id: 't2', name: 'Santos', domain: 'santos.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name or domain...');
    fireEvent.input(searchInput, { target: { value: 'calypso.com' } });
    fixture.detectChanges();

    expect(screen.getByText('Calypso')).toBeTruthy();
    expect(screen.queryByText('Santos')).toBeFalsy();
  });

  it('should show summary cards with correct counts', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', is_master: true, courseCount: 5, csmCount: 2 }),
        createMockTenantForBoard({ id: 't2', is_master: false, courseCount: 3, csmCount: 1 }),
        createMockTenantForBoard({ id: 't3', is_master: false, courseCount: 2, csmCount: 0 }),
      ],
    });

    const { container } = await renderPage({ service });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=3, Master=1, Course Assignments=10, CSM Assignments=3
    expect(values).toEqual(['3', '1', '10', '3']);
  });

  it('should open create form on button click', async () => {
    const service = createMockTenantManagementService({
      tenants: [createMockTenantForBoard()],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Add Tenant'));
    fixture.detectChanges();

    expect(screen.getByText('Create New Tenant')).toBeTruthy();
    expect(screen.getByPlaceholderText('Tenant name')).toBeTruthy();
  });

  it('should create tenant and close form', async () => {
    const service = createMockTenantManagementService({
      tenants: [createMockTenantForBoard()],
    });

    const { fixture } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('Add Tenant'));
    fixture.detectChanges();

    // Fill form
    fireEvent.input(screen.getByPlaceholderText('Tenant name'), { target: { value: 'New Tenant' } });
    fireEvent.input(screen.getByPlaceholderText('example.com'), { target: { value: 'new.com' } });
    fixture.detectChanges();

    // Submit
    fireEvent.click(screen.getByText('Create'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.createTenant).toHaveBeenCalledWith({
      name: 'New Tenant',
      domain: 'new.com',
      auth_methods: ['email_password'],
    });
    expect(service.loadTenants).toHaveBeenCalledTimes(2); // init + after create
  });

  it('should show create error toast on rejection', async () => {
    const service = createMockTenantManagementService({
      tenants: [createMockTenantForBoard()],
    });
    service.createTenant.mockRejectedValue(new Error('Duplicate domain'));

    const { fixture, toast } = await renderPage({ service });

    // Open form
    fireEvent.click(screen.getByText('Add Tenant'));
    fixture.detectChanges();

    // Fill and submit
    fireEvent.input(screen.getByPlaceholderText('Tenant name'), { target: { value: 'Test' } });
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Create'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Duplicate domain');
  });

  it('should expand row and show details tab', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({
          id: 't1', name: 'Calypso', domain: 'calypso.com',
          settings: { auth_methods: ['keycloak_sso'] },
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Calypso'));
    fixture.detectChanges();

    // Should show tabs
    expect(screen.getByText('Details')).toBeTruthy();
    // "Courses" appears in header + tab
    expect(screen.getAllByText(/Courses/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/CSMs/).length).toBeGreaterThanOrEqual(1);
  });

  it('should pre-fill edit fields from tenant data', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({
          id: 't1', name: 'Calypso', domain: 'calypso.com',
          settings: { auth_methods: ['keycloak_sso'] },
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Calypso'));
    fixture.detectChanges();

    // Check that name input is pre-filled — find input with value "Calypso" in the expanded row
    const nameInputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const nameInput = nameInputs.find(i => i.value === 'Calypso');
    expect(nameInput).toBeTruthy();

    const domainInput = nameInputs.find(i => i.value === 'calypso.com');
    expect(domainInput).toBeTruthy();
  });

  it('should save tenant details via updateTenant', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({
          id: 't1', name: 'Old Name', domain: 'old.com',
          settings: { auth_methods: ['email_password'] },
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Old Name'));
    fixture.detectChanges();

    // Click save
    fireEvent.click(screen.getByText('Save'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.updateTenant).toHaveBeenCalledWith('t1', {
      name: 'Old Name',
      domain: 'old.com',
      auth_methods: ['email_password'],
    });
  });

  it('should show save error toast on rejection', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Test Tenant' }),
      ],
    });
    service.updateTenant.mockRejectedValue(new Error('Update failed'));

    const { fixture, toast } = await renderPage({ service });

    fireEvent.click(screen.getByText('Test Tenant'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Save'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Update failed');
  });

  it('should show delete confirmation two-click pattern', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Client Tenant', is_master: false }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Client Tenant'));
    fixture.detectChanges();

    // First click — shows "Delete" button
    expect(screen.getByText('Delete')).toBeTruthy();

    // Click Delete
    fireEvent.click(screen.getByText('Delete'));
    fixture.detectChanges();

    // Second click — shows "Confirm Delete"
    expect(screen.getByText('Confirm Delete')).toBeTruthy();
  });

  it('should call deleteTenant on confirm', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Client Tenant', is_master: false }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Client Tenant'));
    fixture.detectChanges();

    // First click: Delete
    fireEvent.click(screen.getByText('Delete'));
    fixture.detectChanges();

    // Second click: Confirm Delete
    fireEvent.click(screen.getByText('Confirm Delete'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.deleteTenant).toHaveBeenCalledWith('t1');
  });

  it('should show master tenant cannot be deleted', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Calypso', is_master: true }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Calypso'));
    fixture.detectChanges();

    expect(screen.getByText('Master tenant cannot be deleted')).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeFalsy();
  });

  it('should switch to courses tab and call loadTenantCourses', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Test Tenant', courseCount: 2 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Test Tenant'));
    fixture.detectChanges();

    // Click "Courses" tab
    const coursesTab = screen.getAllByText(/Courses/).find(el =>
      el.closest('button'),
    );
    fireEvent.click(coursesTab!);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.loadTenantCourses).toHaveBeenCalledWith('t1');
    expect(service.loadAvailableCourses).toHaveBeenCalledWith('t1');
  });

  it('should switch to CSMs tab and call loadCsmAssignments', async () => {
    const service = createMockTenantManagementService({
      tenants: [
        createMockTenantForBoard({ id: 't1', name: 'Test Tenant', csmCount: 1 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Test Tenant'));
    fixture.detectChanges();

    // Click "CSMs" tab
    const csmsTab = screen.getAllByText(/CSMs/).find(el =>
      el.closest('button'),
    );
    fireEvent.click(csmsTab!);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.loadCsmAssignments).toHaveBeenCalledWith('t1');
    expect(service.loadAvailableCsms).toHaveBeenCalledWith('t1');
  });
});
