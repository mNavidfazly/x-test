import { vi } from 'vitest';

export function createMockRouter() {
  return {
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
    url: '/',
    events: {
      pipe: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      subscribe: vi.fn(),
    },
  };
}

export type MockRouter = ReturnType<typeof createMockRouter>;
