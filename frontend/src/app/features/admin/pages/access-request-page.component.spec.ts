import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { AccessRequestPageComponent } from './access-request-page.component';
import { AccessRequestService } from '../../../core/services/access-request.service';
import { AuthService } from '../../../core/services/auth.service';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockAccessRequestService, createMockAccessRequestForBoard, createMockTenantManagementService } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select.component';

function renderPage(options?: {
  service?: ReturnType<typeof createMockAccessRequestService>;
  auth?: ReturnType<typeof createMockAuthService>;
  tenantService?: ReturnType<typeof createMockTenantManagementService>;
}) {
  const service = options?.service ?? createMockAccessRequestService();
  const auth = options?.auth ?? createMockAuthService({
    isAuthenticated: true,
    roles: ['tenant_admin'],
    claims: { is_tenant_admin: true },
  });
  const tenantService = options?.tenantService ?? createMockTenantManagementService();
  const toast = createMockToastService();

  return render(AccessRequestPageComponent, {
    componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
    providers: [
      { provide: AccessRequestService, useValue: service },
      { provide: AuthService, useValue: auth },
      { provide: TenantManagementService, useValue: tenantService },
      { provide: ToastService, useValue: toast },
    ],
  }).then(result => ({ ...result, service, auth, tenantService, toast }));
}

function renderPageAsPA(options?: {
  service?: ReturnType<typeof createMockAccessRequestService>;
}) {
  const service = options?.service ?? createMockAccessRequestService();
  const auth = createMockAuthService({
    isAuthenticated: true,
    userId: 'pa-user-id',
    roles: ['platform_admin'],
    claims: { is_platform_admin: true },
  });
  const tenantService = createMockTenantManagementService();
  const toast = createMockToastService();

  return render(AccessRequestPageComponent, {
    componentImports: [MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent],
    providers: [
      { provide: AccessRequestService, useValue: service },
      { provide: AuthService, useValue: auth },
      { provide: TenantManagementService, useValue: tenantService },
      { provide: ToastService, useValue: toast },
    ],
  }).then(result => ({ ...result, service, auth, tenantService, toast }));
}

describe('AccessRequestPageComponent', () => {
  it('should call loadRequests on init', async () => {
    const { service } = await renderPage();
    expect(service.loadRequests).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockAccessRequestService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading access requests...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockAccessRequestService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no requests', async () => {
    await renderPage();
    expect(screen.getByText('No access requests found.')).toBeTruthy();
  });

  it('should render request rows with name, email, domain, and status badge', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice Requester',
          email: 'alice@client.com',
          domain: 'client.com',
          status: 'pending',
        }),
        createMockAccessRequestForBoard({
          id: 'r2',
          full_name: 'Bob Applicant',
          email: 'bob@other.com',
          domain: 'other.com',
          status: 'approved',
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Alice Requester')).toBeTruthy();
    expect(screen.getByText('alice@client.com')).toBeTruthy();
    expect(screen.getByText('client.com')).toBeTruthy();
    expect(screen.getByText('Bob Applicant')).toBeTruthy();
    expect(screen.getByText('bob@other.com')).toBeTruthy();
  });

  it('should show pending badge', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', status: 'pending' }),
      ],
    });

    await renderPage({ service });
    // "Pending" appears in badge + filter dropdown + summary card
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
  });

  it('should show approved badge', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', status: 'approved' }),
      ],
    });

    await renderPage({ service });
    expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
  });

  it('should show rejected badge', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', status: 'rejected' }),
      ],
    });

    await renderPage({ service });
    expect(screen.getAllByText('Rejected').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by name/email search', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', full_name: 'Alice', email: 'alice@a.com', domain: 'a.com' }),
        createMockAccessRequestForBoard({ id: 'r2', full_name: 'Bob', email: 'bob@b.com', domain: 'b.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name, email, or domain...');
    fireEvent.input(searchInput, { target: { value: 'Bob' } });
    fixture.detectChanges();

    expect(screen.queryByText('Alice')).toBeFalsy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('should filter by domain search', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', full_name: 'Alice', email: 'alice@a.com', domain: 'a.com' }),
        createMockAccessRequestForBoard({ id: 'r2', full_name: 'Bob', email: 'bob@b.com', domain: 'b.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by name, email, or domain...');
    fireEvent.input(searchInput, { target: { value: 'b.com' } });
    fixture.detectChanges();

    // Alice's email also contains "a.com" not "b.com", but Bob's domain is "b.com" and his email contains "b.com"
    expect(screen.queryByText('Alice')).toBeFalsy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('should filter by status', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', full_name: 'Pending Alice', status: 'pending' }),
        createMockAccessRequestForBoard({ id: 'r2', full_name: 'Approved Bob', status: 'approved' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('All Statuses'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'Pending' }));
    fixture.detectChanges();

    expect(screen.getByText('Pending Alice')).toBeTruthy();
    expect(screen.queryByText('Approved Bob')).toBeFalsy();
  });

  it('should show summary cards with correct counts', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', status: 'pending' }),
        createMockAccessRequestForBoard({ id: 'r2', status: 'pending' }),
        createMockAccessRequestForBoard({ id: 'r3', status: 'approved' }),
        createMockAccessRequestForBoard({ id: 'r4', status: 'rejected' }),
      ],
    });

    const { container } = await renderPage({ service });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total=4, Pending=2, Approved=1, Rejected=1
    expect(values).toEqual(['4', '2', '1', '1']);
  });

  it('should expand row and show review section for pending request', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice Requester',
          email: 'alice@client.com',
          status: 'pending',
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Requester'));
    fixture.detectChanges();

    expect(screen.getByText('Approve & Invite')).toBeTruthy();
    expect(screen.getByText('Reject')).toBeTruthy();
    expect(screen.getByPlaceholderText('Optional notes about this decision...')).toBeTruthy();
  });

  it('should show request details in expanded row', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice Requester',
          email: 'alice@client.com',
          domain: 'client.com',
          status: 'pending',
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Alice Requester'));
    fixture.detectChanges();

    // Details are shown
    expect(screen.getAllByText('alice@client.com').length).toBeGreaterThanOrEqual(1);
  });

  it('should call approveAndInvite on approve and show success toast', async () => {
    const auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'ta-user-1',
      roles: ['tenant_admin'],
      claims: { is_tenant_admin: true },
    });

    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice',
          email: 'alice@client.com',
          tenant_id: 'tenant-1',
          status: 'pending',
        }),
      ],
    });

    const { fixture, toast } = await renderPage({ service, auth });

    fireEvent.click(screen.getByText('Alice'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Approve & Invite'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.approveAndInvite).toHaveBeenCalledWith(
      'r1', 'alice@client.com', 'tenant-1', 'ta-user-1',
    );
    expect(toast.success).toHaveBeenCalledWith('Request approved and invitation sent');
  });

  it('should show approve error toast on rejection', async () => {
    const auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'ta-user-1',
      roles: ['tenant_admin'],
      claims: { is_tenant_admin: true },
    });

    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice',
          email: 'alice@client.com',
          tenant_id: 'tenant-1',
          status: 'pending',
        }),
      ],
    });
    service.approveAndInvite.mockRejectedValue(new Error('User already exists'));

    const { fixture, toast } = await renderPage({ service, auth });

    fireEvent.click(screen.getByText('Alice'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Approve & Invite'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('User already exists');
  });

  it('should call reviewRequest with rejected status on reject and show success toast', async () => {
    const auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'ta-user-1',
      roles: ['tenant_admin'],
      claims: { is_tenant_admin: true },
    });

    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice',
          email: 'alice@client.com',
          status: 'pending',
        }),
      ],
    });

    const { fixture, toast } = await renderPage({ service, auth });

    fireEvent.click(screen.getByText('Alice'));
    fixture.detectChanges();

    // Add review notes
    const notesInput = screen.getByPlaceholderText('Optional notes about this decision...');
    fireEvent.input(notesInput, { target: { value: 'Not eligible' } });
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Reject'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.reviewRequest).toHaveBeenCalledWith(
      'r1',
      { status: 'rejected', review_notes: 'Not eligible' },
      'ta-user-1',
    );
    expect(toast.success).toHaveBeenCalledWith('Request rejected');
  });

  it('should show reject error toast on rejection', async () => {
    const auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'ta-user-1',
      roles: ['tenant_admin'],
      claims: { is_tenant_admin: true },
    });

    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Alice',
          status: 'pending',
        }),
      ],
    });
    service.reviewRequest.mockRejectedValue(new Error('Update denied'));

    const { fixture, toast } = await renderPage({ service, auth });

    fireEvent.click(screen.getByText('Alice'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Reject'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Update denied');
  });

  it('should show read-only info for already-reviewed requests', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Bob Reviewed',
          status: 'approved',
          reviewer_name: 'Admin User',
          reviewed_at: '2026-02-10T00:00:00Z',
          review_notes: 'Looks good',
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Bob Reviewed'));
    fixture.detectChanges();

    expect(screen.getByText('Admin User')).toBeTruthy();
    expect(screen.getByText('Looks good')).toBeTruthy();
    // No action buttons for already-reviewed
    expect(screen.queryByText('Approve & Invite')).toBeFalsy();
    expect(screen.queryByText('Reject')).toBeFalsy();
  });

  it('PA sees tenant column and unknown-domain indicator', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({
          id: 'r1',
          full_name: 'Known User',
          tenant_id: 'tenant-1',
          tenant_name: 'Client Corp',
          status: 'pending',
        }),
        createMockAccessRequestForBoard({
          id: 'r2',
          full_name: 'Unknown User',
          tenant_id: null,
          tenant_name: null,
          domain: 'foreign.com',
          status: 'pending',
        }),
      ],
    });

    const { container } = await renderPageAsPA({ service });

    // Should have tenant header column
    const headers = container.querySelectorAll('th');
    const tenantHeader = Array.from(headers).find(h => h.textContent?.includes('Tenant'));
    expect(tenantHeader).toBeTruthy();

    // Should show tenant name for known request
    expect(screen.getByText('Client Corp')).toBeTruthy();

    // Should show "Unknown domain" badge for unknown request
    expect(screen.getByText('Unknown domain')).toBeTruthy();
  });

  it('TA does not see tenant column', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', full_name: 'Alice' }),
      ],
    });

    const { container } = await renderPage({ service });

    // No tenant header column
    const headers = container.querySelectorAll('th');
    const tenantHeader = Array.from(headers).find(h => h.textContent?.trim() === 'Tenant');
    expect(tenantHeader).toBeFalsy();
  });

  it('should clear filters on button click', async () => {
    const service = createMockAccessRequestService({
      requests: [
        createMockAccessRequestForBoard({ id: 'r1', full_name: 'Alice', email: 'alice@a.com', domain: 'a.com' }),
        createMockAccessRequestForBoard({ id: 'r2', full_name: 'Bob', email: 'bob@b.com', domain: 'b.com' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Apply filter
    const searchInput = screen.getByPlaceholderText('Search by name, email, or domain...');
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
