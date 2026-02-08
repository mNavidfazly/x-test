import { vi } from 'vitest';

export function createMockAuthService(options?: {
  isAuthenticated?: boolean;
  userId?: string;
  tenantId?: string;
  role?: 'learner' | 'tenant_admin' | 'platform_admin' | 'csm' | 'lecturer';
}) {
  return {
    isAuthenticated: vi.fn().mockReturnValue(options?.isAuthenticated ?? false),
    currentUser: vi.fn().mockReturnValue(
      options?.isAuthenticated
        ? {
            id: options?.userId ?? 'test-user-id',
            tenantId: options?.tenantId ?? 'test-tenant-id',
          }
        : null,
    ),
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getRole: vi.fn().mockReturnValue(options?.role ?? 'learner'),
  };
}

export type MockAuthService = ReturnType<typeof createMockAuthService>;
