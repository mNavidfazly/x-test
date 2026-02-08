import { vi } from 'vitest';

export function createMockToastService() {
  return {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
}

export type MockToastService = ReturnType<typeof createMockToastService>;
