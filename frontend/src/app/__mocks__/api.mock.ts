import { vi } from 'vitest';
import { of } from 'rxjs';

export function createMockApiService() {
  return {
    get: vi.fn().mockReturnValue(of(null)),
    post: vi.fn().mockReturnValue(of(null)),
  };
}

export type MockApiService = ReturnType<typeof createMockApiService>;
