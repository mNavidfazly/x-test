import { render, screen } from '@testing-library/angular';
import { ErrorAlertComponent } from './error-alert.component';

describe('ErrorAlertComponent', () => {
  it('should render the error message', async () => {
    await render(ErrorAlertComponent, {
      inputs: { message: 'Something went wrong' },
    });
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should have alert role with correct text', async () => {
    await render(ErrorAlertComponent, {
      inputs: { message: 'Network error' },
    });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Network error');
  });

  it('should apply alert-error class', async () => {
    await render(ErrorAlertComponent, {
      inputs: { message: 'Error' },
    });
    expect(screen.getByRole('alert').className).toContain('alert-error');
  });
});
