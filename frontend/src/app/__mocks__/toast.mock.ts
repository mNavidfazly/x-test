import { signal } from '@angular/core';
import { vi } from 'vitest';
import type { Toast } from '../core/services/toast.service';

export function createMockToastService() {
  return {
    toasts: signal<Toast[]>([]).asReadonly(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  };
}

export type MockToastService = ReturnType<typeof createMockToastService>;
