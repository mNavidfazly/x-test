import { render, screen } from '@testing-library/angular';
import { describe, it, expect } from 'vitest';
import { provideRouter, RouterLink } from '@angular/router';
import { DashboardActionCardComponent } from './dashboard-action-card.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { UserPlus } from 'lucide-angular';

describe('DashboardActionCardComponent', () => {
  async function setup(overrides?: Partial<{ count: number; label: string; route: string }>) {
    return render(DashboardActionCardComponent, {
      componentImports: [MockLucideIconComponent, RouterLink],
      componentInputs: {
        icon: UserPlus,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        count: overrides?.count ?? 3,
        label: overrides?.label ?? 'Pending Requests',
        route: overrides?.route ?? '/admin/access-requests',
      },
      providers: [provideRouter([])],
    });
  }

  it('should render count and label', async () => {
    await setup();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Pending Requests')).toBeTruthy();
  });

  it('should link to the correct route', async () => {
    await setup();
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/admin/access-requests');
  });

  it('should render zero count', async () => {
    await setup({ count: 0 });
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('should use custom label and route', async () => {
    await setup({ label: 'Open Issues', route: '/teaching/issues', count: 7 });
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Open Issues')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/teaching/issues');
  });
});
