import { vi } from 'vitest';

export function createMockPosthogService() {
  return {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  };
}

export type MockPosthogService = ReturnType<typeof createMockPosthogService>;
