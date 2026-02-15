import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmDialogService);
  });

  it('should start with null config', () => {
    expect(service.config()).toBeNull();
  });

  it('should set config when confirm is called', () => {
    service.confirm({
      title: 'Delete item?',
      message: 'This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
    });

    const cfg = service.config();
    expect(cfg).not.toBeNull();
    expect(cfg!.title).toBe('Delete item?');
    expect(cfg!.message).toBe('This action cannot be undone.');
    expect(cfg!.variant).toBe('danger');
    expect(cfg!.confirmLabel).toBe('Delete');
    expect(cfg!.cancelLabel).toBe('Cancel');
  });

  it('should resolve true on accept', async () => {
    const promise = service.confirm({
      title: 'Confirm?',
      message: 'Are you sure?',
    });

    service.accept();
    const result = await promise;
    expect(result).toBe(true);
  });

  it('should resolve false on dismiss', async () => {
    const promise = service.confirm({
      title: 'Confirm?',
      message: 'Are you sure?',
    });

    service.dismiss();
    const result = await promise;
    expect(result).toBe(false);
  });

  it('should clear config after accept', async () => {
    const promise = service.confirm({
      title: 'Confirm?',
      message: 'Are you sure?',
    });

    service.accept();
    await promise;
    expect(service.config()).toBeNull();
  });

  it('should clear config after dismiss', async () => {
    const promise = service.confirm({
      title: 'Confirm?',
      message: 'Are you sure?',
    });

    service.dismiss();
    await promise;
    expect(service.config()).toBeNull();
  });
});
