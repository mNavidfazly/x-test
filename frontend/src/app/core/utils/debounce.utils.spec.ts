import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { debouncedSignal } from './debounce.utils';

describe('debouncedSignal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with source value', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('hello');
      const debounced = debouncedSignal(source, 300);
      expect(debounced()).toBe('hello');
    });
  });

  it('should not update immediately when source changes', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('initial');
      const debounced = debouncedSignal(source, 300);

      source.set('updated');
      TestBed.flushEffects();

      // Before delay, should still be initial
      expect(debounced()).toBe('initial');
    });
  });

  it('should update after delay', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('initial');
      const debounced = debouncedSignal(source, 300);

      source.set('updated');
      TestBed.flushEffects();

      vi.advanceTimersByTime(300);

      expect(debounced()).toBe('updated');
    });
  });

  it('should only emit last value when source changes rapidly', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('');
      const debounced = debouncedSignal(source, 300);

      source.set('a');
      TestBed.flushEffects();
      vi.advanceTimersByTime(100);

      source.set('ab');
      TestBed.flushEffects();
      vi.advanceTimersByTime(100);

      source.set('abc');
      TestBed.flushEffects();
      vi.advanceTimersByTime(300);

      expect(debounced()).toBe('abc');
    });
  });

  it('should use custom delay', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('initial');
      const debounced = debouncedSignal(source, 500);

      source.set('updated');
      TestBed.flushEffects();

      vi.advanceTimersByTime(300);
      expect(debounced()).toBe('initial');

      vi.advanceTimersByTime(200);
      expect(debounced()).toBe('updated');
    });
  });

  it('should return a readonly signal', () => {
    TestBed.runInInjectionContext(() => {
      const source = signal('test');
      const debounced = debouncedSignal(source, 300);
      // Should not have a .set method (it's readonly)
      expect((debounced as any).set).toBeUndefined();
    });
  });
});
