import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../../core/services/auth.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';
import { UserRole } from '../../core/models/auth.model';

async function renderSidebar(options?: {
  roles?: UserRole[];
  open?: boolean;
}) {
  const auth = createMockAuthService({
    isAuthenticated: true,
    roles: options?.roles ?? ['learner'],
  });

  const openChangeSpy = vi.fn();

  const { fixture } = await render(SidebarComponent, {
    componentImports: [MockLucideIconComponent, RouterLink, RouterLinkActive],
    componentInputs: { open: options?.open ?? false },
    componentOutputs: { openChange: { emit: openChangeSpy } as any },
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
    ],
  });

  return { auth, openChangeSpy, fixture };
}

describe('SidebarComponent', () => {
  it('should show base nav for learner role', async () => {
    await renderSidebar({ roles: ['learner'] });

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('My Courses')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.queryByText('Teaching')).toBeNull();
    expect(screen.queryByText('User Management')).toBeNull();
  });

  it('should show tenant admin section for tenant_admin role', async () => {
    await renderSidebar({ roles: ['learner', 'tenant_admin'] });

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('User Management')).toBeTruthy();
    expect(screen.getByText('Progress Dashboard')).toBeTruthy();
  });

  it('should show CSM section for csm role', async () => {
    await renderSidebar({ roles: ['learner', 'csm'] });

    expect(screen.getByText('Assigned Tenants')).toBeTruthy();
    expect(screen.getByText('Expert Questions')).toBeTruthy();
    expect(screen.getByText('Progress Dashboard')).toBeTruthy();
  });

  it('should show teaching section for lecturer role', async () => {
    await renderSidebar({ roles: ['learner', 'lecturer'] });

    expect(screen.getByText('Teaching')).toBeTruthy();
    expect(screen.getByText('Questions Board')).toBeTruthy();
    expect(screen.getByText('Exam Grading')).toBeTruthy();
    expect(screen.getByText('Progress Dashboard')).toBeTruthy();
  });

  it('should show all sections for platform_admin role', async () => {
    await renderSidebar({ roles: ['learner', 'platform_admin'] });

    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Tenant Management')).toBeTruthy();
    expect(screen.getByText('Content Management')).toBeTruthy();
    expect(screen.getByText('Staleness Dashboard')).toBeTruthy();
  });

  it('should show union of sections for multi-role user', async () => {
    await renderSidebar({ roles: ['learner', 'tenant_admin', 'csm'] });

    expect(screen.getByText('User Management')).toBeTruthy();
    expect(screen.getByText('Assigned Tenants')).toBeTruthy();
    expect(screen.getByText('Progress Dashboard')).toBeTruthy();
  });

  it('should show backdrop when open on mobile', async () => {
    const { fixture } = await renderSidebar({ open: true });
    const backdrop = fixture.nativeElement.querySelector('.bg-black\\/50');
    expect(backdrop).toBeTruthy();
  });

  it('should emit openChange(false) when backdrop clicked', async () => {
    const { openChangeSpy, fixture } = await renderSidebar({ open: true });
    const user = userEvent.setup();

    const backdrop = fixture.nativeElement.querySelector('.bg-black\\/50');
    await user.click(backdrop);

    expect(openChangeSpy).toHaveBeenCalledWith(false);
  });

  it('should show X-Course brand', async () => {
    await renderSidebar();
    expect(screen.getByText('X-Course')).toBeTruthy();
  });
});
