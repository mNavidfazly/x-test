import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  persistent?: boolean;
}

const DURATIONS: Record<Toast['type'], number> = {
  success: 4000,
  info: 5000,
  warning: 6000,
  error: 8000,
};

const MAX_TOASTS = 5;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly #toasts = signal<Toast[]>([]);
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  readonly toasts = this.#toasts.asReadonly();

  success(message: string): void {
    this.#add('success', message);
  }

  error(message: string, opts?: { persistent?: boolean }): void {
    this.#add('error', message, opts);
  }

  info(message: string): void {
    this.#add('info', message);
  }

  warning(message: string): void {
    this.#add('warning', message);
  }

  dismiss(id: string): void {
    const timer = this.#timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.#timers.delete(id);
    }
    this.#toasts.update((toasts) => toasts.filter((t) => t.id !== id));
  }

  dismissAll(): void {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
    this.#toasts.set([]);
  }

  #add(
    type: Toast['type'],
    message: string,
    opts?: { persistent?: boolean },
  ): void {
    const id = crypto.randomUUID();
    const toast: Toast = { id, type, message, persistent: opts?.persistent };

    this.#toasts.update((toasts) => {
      const updated = [...toasts, toast];
      // Enforce max queue size — dismiss oldest
      while (updated.length > MAX_TOASTS) {
        const oldest = updated.shift()!;
        const timer = this.#timers.get(oldest.id);
        if (timer) {
          clearTimeout(timer);
          this.#timers.delete(oldest.id);
        }
      }
      return updated;
    });

    if (!opts?.persistent) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, DURATIONS[type]);
      this.#timers.set(id, timer);
    }
  }
}
