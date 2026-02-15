import { signal, effect, type Signal } from '@angular/core';

/**
 * Creates a debounced read-only signal that follows a source signal
 * with the specified delay. When the source changes rapidly, only
 * the last value is emitted after the delay period.
 *
 * Must be called in an injection context (component constructor, field initializer, or inject()).
 */
export function debouncedSignal(source: Signal<string>, delayMs = 300): Signal<string> {
  const debounced = signal(source());
  effect((onCleanup) => {
    const value = source();
    const timer = setTimeout(() => debounced.set(value), delayMs);
    onCleanup(() => clearTimeout(timer));
  });
  return debounced.asReadonly();
}
