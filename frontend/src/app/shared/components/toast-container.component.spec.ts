import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { signal } from '@angular/core';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService, Toast } from '../../core/services/toast.service';
import { createMockToastService } from '../../__mocks__/toast.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

async function renderContainer(toasts: Toast[] = []) {
  const mock = createMockToastService();
  // Override the readonly signal with one containing our test data
  (mock as any).toasts = signal(toasts).asReadonly();

  await render(ToastContainerComponent, {
    componentImports: [MockLucideIconComponent],
    providers: [{ provide: ToastService, useValue: mock }],
  });

  return { mock };
}

describe('ToastContainerComponent', () => {
  it('should render nothing when queue is empty', async () => {
    await renderContainer([]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should render a success toast with correct text', async () => {
    await renderContainer([
      { id: '1', type: 'success', message: 'Item created' },
    ]);
    expect(screen.getByText('Item created')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('should render an error toast', async () => {
    await renderContainer([
      { id: '1', type: 'error', message: 'Something failed' },
    ]);
    expect(screen.getByText('Something failed')).toBeTruthy();
  });

  it('should render multiple toasts', async () => {
    await renderContainer([
      { id: '1', type: 'success', message: 'A' },
      { id: '2', type: 'error', message: 'B' },
      { id: '3', type: 'warning', message: 'C' },
    ]);
    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });

  it('should call dismiss when X button clicked', async () => {
    const { mock } = await renderContainer([
      { id: 'toast-1', type: 'info', message: 'Heads up' },
    ]);
    const user = userEvent.setup();

    await user.click(screen.getByLabelText('Dismiss'));
    expect(mock.dismiss).toHaveBeenCalledWith('toast-1');
  });

  it('should apply success styling classes', async () => {
    await renderContainer([
      { id: '1', type: 'success', message: 'Done' },
    ]);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-emerald-50');
    expect(alert.className).toContain('border-emerald-200');
    expect(alert.className).toContain('text-emerald-800');
  });

  it('should apply error styling classes', async () => {
    await renderContainer([
      { id: '1', type: 'error', message: 'Fail' },
    ]);
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('bg-rose-50');
  });
});
