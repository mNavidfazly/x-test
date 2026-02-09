import { signal, computed } from '@angular/core';
import { vi } from 'vitest';
import { AppUser, JwtClaims, UserRole } from '../core/models/auth.model';

const DEFAULT_CLAIMS: JwtClaims = {
  tenant_id: 'test-tenant-id',
  is_tenant_admin: false,
  is_platform_admin: false,
  csm_tenant_ids: [],
  lecturer_course_ids: [],
  lecturer_can_edit_course_ids: [],
  lecturer_can_grade_course_ids: [],
};

export function createMockAuthService(options?: {
  isAuthenticated?: boolean;
  userId?: string;
  email?: string;
  tenantId?: string;
  roles?: UserRole[];
  claims?: Partial<JwtClaims>;
  loading?: boolean;
}) {
  const claims: JwtClaims = { ...DEFAULT_CLAIMS, ...options?.claims };
  const roles = options?.roles ?? ['learner'];

  const user: AppUser | null = (options?.isAuthenticated ?? false)
    ? {
        id: options?.userId ?? 'test-user-id',
        email: options?.email ?? 'test@example.com',
        tenantId: options?.tenantId ?? claims.tenant_id,
        roles,
        claims,
      }
    : null;

  const currentUser = signal(user);
  const loading = signal(options?.loading ?? false);

  return {
    currentUser: currentUser.asReadonly(),
    loading: loading.asReadonly(),
    isAuthenticated: computed(() => currentUser() !== null),
    roles: computed(() => currentUser()?.roles ?? []),
    signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: {}, session: {} }, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    hasRole: vi.fn((role: UserRole) => roles.includes(role)),
    hasAnyRole: vi.fn((r: UserRole[]) => r.some((x) => roles.includes(x))),
    // Test helpers
    _setUser: currentUser.set.bind(currentUser),
    _setLoading: loading.set.bind(loading),
  };
}

export type MockAuthService = ReturnType<typeof createMockAuthService>;
