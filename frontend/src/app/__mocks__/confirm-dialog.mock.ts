import { signal } from '@angular/core';
import { vi } from 'vitest';

export function createMockConfirmDialogService() {
  return {
    config: signal(null),
    confirm: vi.fn().mockResolvedValue(true),
    accept: vi.fn(),
    dismiss: vi.fn(),
  };
}

export type MockConfirmDialogService = ReturnType<
  typeof createMockConfirmDialogService
>;
