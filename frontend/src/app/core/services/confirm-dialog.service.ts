import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly #config = signal<ConfirmDialogConfig | null>(null);
  readonly config = this.#config.asReadonly();

  #resolve: ((value: boolean) => void) | null = null;

  confirm(config: ConfirmDialogConfig): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.#resolve = resolve;
      this.#config.set({
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'default',
        ...config,
      });
    });
  }

  accept(): void {
    this.#resolve?.(true);
    this.#close();
  }

  dismiss(): void {
    this.#resolve?.(false);
    this.#close();
  }

  #close(): void {
    this.#resolve = null;
    this.#config.set(null);
  }
}
