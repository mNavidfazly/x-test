import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with empty toast queue', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('should add a success toast', () => {
    service.success('Item created');
    const toasts = service.toasts();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('Item created');
  });

  it('should add an error toast', () => {
    service.error('Something failed');
    expect(service.toasts()[0].type).toBe('error');
    expect(service.toasts()[0].message).toBe('Something failed');
  });

  it('should add an info toast', () => {
    service.info('FYI');
    expect(service.toasts()[0].type).toBe('info');
  });

  it('should add a warning toast', () => {
    service.warning('Be careful');
    expect(service.toasts()[0].type).toBe('warning');
  });

  it('should auto-dismiss success toast after 4s', () => {
    service.success('Done');
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(3999);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('should auto-dismiss error toast after 8s', () => {
    service.error('Oops');
    vi.advanceTimersByTime(7999);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('should NOT auto-dismiss persistent error toast', () => {
    service.error('Session expired', { persistent: true });
    vi.advanceTimersByTime(60000);
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].persistent).toBe(true);
  });

  it('should dismiss a specific toast by id', () => {
    service.success('A');
    service.error('B');
    const idA = service.toasts()[0].id;

    service.dismiss(idA);
    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0].message).toBe('B');
  });

  it('should dismiss all toasts', () => {
    service.success('A');
    service.error('B');
    service.warning('C');

    service.dismissAll();
    expect(service.toasts()).toHaveLength(0);
  });

  it('should enforce max 5 toasts by removing oldest', () => {
    for (let i = 0; i < 7; i++) {
      service.info(`Toast ${i}`);
    }
    const toasts = service.toasts();
    expect(toasts).toHaveLength(5);
    expect(toasts[0].message).toBe('Toast 2');
    expect(toasts[4].message).toBe('Toast 6');
  });

  it('should assign unique ids to each toast', () => {
    service.success('A');
    service.success('B');
    const ids = service.toasts().map((t) => t.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
