import { vi } from 'vitest';
import { of } from 'rxjs';
import { AuthMethod, TenantResolution } from '../core/models/tenant.model';

export function createMockTenantService(options?: {
  tenantName?: string | null;
  authMethods?: AuthMethod[];
}) {
  const defaultResolution: TenantResolution = {
    tenant_name: options?.tenantName ?? 'Test Corp',
    auth_methods: options?.authMethods ?? ['email_password', 'magic_link'],
  };

  return {
    resolveTenant: vi.fn().mockReturnValue(of(defaultResolution)),
    clearCache: vi.fn(),
  };
}

export type MockTenantService = ReturnType<typeof createMockTenantService>;
