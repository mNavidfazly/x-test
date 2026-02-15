import { render, screen } from '@testing-library/angular';
import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  it('should render projected content', async () => {
    await render(
      `<app-status-badge variant="success">Active</app-status-badge>`,
      { imports: [StatusBadgeComponent] },
    );
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('should apply badge-success class for success variant', async () => {
    await render(
      `<app-status-badge variant="success">OK</app-status-badge>`,
      { imports: [StatusBadgeComponent] },
    );
    expect(screen.getByText('OK').className).toContain('badge-success');
  });

  it('should apply badge-warning class for warning variant', async () => {
    await render(
      `<app-status-badge variant="warning">Pending</app-status-badge>`,
      { imports: [StatusBadgeComponent] },
    );
    expect(screen.getByText('Pending').className).toContain('badge-warning');
  });

  it('should apply badge-error class for error variant', async () => {
    await render(
      `<app-status-badge variant="error">Failed</app-status-badge>`,
      { imports: [StatusBadgeComponent] },
    );
    expect(screen.getByText('Failed').className).toContain('badge-error');
  });
});
