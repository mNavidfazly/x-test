import { render, screen } from '@testing-library/angular';
import { LoadingSpinnerComponent } from './loading-spinner.component';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

describe('LoadingSpinnerComponent', () => {
  it('should render with default message', async () => {
    await render(LoadingSpinnerComponent, {
      componentImports: [MockLucideIconComponent],
    });
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('should render with custom message', async () => {
    await render(LoadingSpinnerComponent, {
      componentImports: [MockLucideIconComponent],
      inputs: { message: 'Loading tenants...' },
    });
    expect(screen.getByText('Loading tenants...')).toBeTruthy();
  });

  it('should render a spinning icon', async () => {
    const { container } = await render(LoadingSpinnerComponent, {
      componentImports: [MockLucideIconComponent],
    });
    const icon = container.querySelector('.animate-spin');
    expect(icon).toBeTruthy();
  });
});
