import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../services/auth.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockRouter } from '../../__mocks__/router.mock';

function runGuard(
  mockAuth: ReturnType<typeof createMockAuthService>,
  ...roles: Parameters<typeof roleGuard>
) {
  const router = createMockRouter();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: mockAuth },
      { provide: Router, useValue: router },
    ],
  });
  const guard = roleGuard(...roles);
  return {
    result: TestBed.runInInjectionContext(() => guard({} as any, {} as any)),
    router,
  };
}

describe('roleGuard', () => {
  it('should allow users with matching role', () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true, roles: ['learner', 'tenant_admin'] });
    const { result } = runGuard(mockAuth, 'tenant_admin');
    expect(result).toBe(true);
  });

  it('should deny users without matching role', () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true, roles: ['learner'] });
    const { result, router } = runGuard(mockAuth, 'platform_admin');
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should work with multiple allowed roles (hasAnyRole)', () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true, roles: ['learner', 'csm'] });
    const { result } = runGuard(mockAuth, 'csm', 'lecturer');
    expect(result).toBe(true);
  });

  it('should wait for loading and then deny if no matching role', async () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true, roles: ['learner'], loading: true });
    const { result, router } = runGuard(mockAuth, 'platform_admin');

    expect(typeof result).not.toBe('boolean');

    mockAuth._setLoading(false);

    const { firstValueFrom } = await import('rxjs');
    const value = await firstValueFrom(result as any);
    expect(value).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
