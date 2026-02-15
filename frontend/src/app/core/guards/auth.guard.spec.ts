import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockRouter } from '../../__mocks__/router.mock';

function runGuard(mockAuth: ReturnType<typeof createMockAuthService>, mockRouter?: ReturnType<typeof createMockRouter>) {
  const router = mockRouter ?? createMockRouter();
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: mockAuth },
      { provide: Router, useValue: router },
    ],
  });
  return {
    result: TestBed.runInInjectionContext(() => authGuard({} as any, {} as any)),
    router,
  };
}

describe('authGuard', () => {
  it('should allow authenticated users', () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true });
    const { result } = runGuard(mockAuth);
    expect(result).toBe(true);
  });

  it('should redirect unauthenticated users to /login', () => {
    const mockAuth = createMockAuthService({ isAuthenticated: false });
    const { result, router } = runGuard(mockAuth);
    expect(result).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });

  it('should wait for loading to complete before deciding', async () => {
    const mockAuth = createMockAuthService({ isAuthenticated: true, loading: true });
    const { result } = runGuard(mockAuth);

    // Should return an observable when loading
    expect(typeof result).not.toBe('boolean');

    // Resolve loading → should allow
    mockAuth._setLoading(false);

    const { firstValueFrom } = await import('rxjs');
    const value = await firstValueFrom(result as any);
    expect(value).toBe(true);
  });
});
