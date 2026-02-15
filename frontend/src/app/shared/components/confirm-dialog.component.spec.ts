import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';

async function renderDialog() {
  const result = await render(ConfirmDialogComponent, {
    componentImports: [MockLucideIconComponent],
  });
  const service = result.fixture.debugElement.injector.get(ConfirmDialogService);
  return { service, fixture: result.fixture };
}

describe('ConfirmDialogComponent', () => {
  it('should not render when config is null', async () => {
    await renderDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('should render dialog when config is set', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({
      title: 'Delete course?',
      message: 'This will permanently remove the course.',
    });
    fixture.detectChanges();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Delete course?')).toBeTruthy();
    expect(
      screen.getByText('This will permanently remove the course.'),
    ).toBeTruthy();
  });

  it('should show default labels', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({ title: 'Confirm action', message: 'Sure?' });
    fixture.detectChanges();

    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('should show custom labels', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({
      title: 'Remove user?',
      message: 'They will lose access.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
    });
    fixture.detectChanges();

    expect(screen.getByText('Remove')).toBeTruthy();
    expect(screen.getByText('Keep')).toBeTruthy();
  });

  it('should use danger variant button', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({
      title: 'Delete?',
      message: 'Gone forever.',
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    fixture.detectChanges();

    const deleteBtn = screen.getByText('Delete');
    expect(deleteBtn.className).toContain('btn-danger-solid');
  });

  it('should use primary variant button by default', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({
      title: 'Save?',
      message: 'Save changes.',
      confirmLabel: 'Save',
    });
    fixture.detectChanges();

    const saveBtn = screen.getByText('Save');
    expect(saveBtn.className).toContain('btn-primary');
  });

  it('should call accept on confirm click', async () => {
    const { service, fixture } = await renderDialog();
    const acceptSpy = vi.spyOn(service, 'accept');

    service.confirm({
      title: 'Proceed?',
      message: 'Continue?',
      confirmLabel: 'Yes',
    });
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByText('Yes'));

    expect(acceptSpy).toHaveBeenCalled();
  });

  it('should call dismiss on cancel click', async () => {
    const { service, fixture } = await renderDialog();
    const dismissSpy = vi.spyOn(service, 'dismiss');

    service.confirm({ title: 'Sure?', message: 'Think again.' });
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByText('Cancel'));

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('should call dismiss on backdrop click', async () => {
    const { service, fixture } = await renderDialog();
    const dismissSpy = vi.spyOn(service, 'dismiss');

    service.confirm({ title: 'Sure?', message: 'Think again.' });
    fixture.detectChanges();

    const user = userEvent.setup();
    await user.click(screen.getByRole('presentation'));

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('should have ARIA attributes', async () => {
    const { service, fixture } = await renderDialog();

    service.confirm({ title: 'Accessible dialog', message: 'Check a11y.' });
    fixture.detectChanges();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(
      'confirm-dialog-title',
    );

    const title = dialog.querySelector('#confirm-dialog-title');
    expect(title).toBeTruthy();
    expect(title!.textContent).toContain('Accessible dialog');
  });
});
