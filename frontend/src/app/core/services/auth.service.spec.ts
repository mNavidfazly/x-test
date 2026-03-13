import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';
import { ToastService } from './toast.service';
import { PosthogService } from './posthog.service';
import { createMockToastService } from '../../__mocks__/toast.mock';
import { createMockPosthogService } from '../../__mocks__/posthog.mock';
import { JwtClaims } from '../models/auth.model';

function buildJwt(claims: Partial<JwtClaims> & Record<string, unknown> = {}): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'test-user-id',
      email: 'test@example.com',
      tenant_id: 'tid-1',
      is_tenant_admin: false,
      is_platform_admin: false,
      csm_tenant_ids: [],
      lecturer_course_ids: [],
      lecturer_can_edit_course_ids: [],
      lecturer_can_grade_course_ids: [],
      ...claims,
    }),
  );
  return `${header}.${payload}.fake-signature`;
}

function buildSession(claimOverrides: Partial<JwtClaims> & Record<string, unknown> = {}) {
  return {
    user: { id: 'test-user-id', email: 'test@example.com' },
    access_token: buildJwt(claimOverrides),
    refresh_token: 'refresh',
    expires_in: 3600,
    token_type: 'bearer',
  };
}

describe('AuthService', () => {
  let authStateCallback: (event: string, session: unknown) => void;
  let mockGetSession: ReturnType<typeof vi.fn>;
  let mockSignInWithPassword: ReturnType<typeof vi.fn>;
  let mockSignInWithOtp: ReturnType<typeof vi.fn>;
  let mockVerifyOtp: ReturnType<typeof vi.fn>;
  let mockSignOut: ReturnType<typeof vi.fn>;
  let mockSignInWithOAuth: ReturnType<typeof vi.fn>;
  let mockToast: ReturnType<typeof createMockToastService>;

  function createService(initialSession: unknown = null) {
    mockGetSession = vi.fn().mockResolvedValue({ data: { session: initialSession } });
    mockSignInWithPassword = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockSignInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockVerifyOtp = vi.fn().mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    mockSignOut = vi.fn().mockResolvedValue({ error: null });
    mockSignInWithOAuth = vi.fn().mockResolvedValue({ data: {}, error: null });

    mockToast = createMockToastService();

    const mockSupabase = {
      client: {
        auth: {
          getSession: mockGetSession,
          signInWithPassword: mockSignInWithPassword,
          signInWithOtp: mockSignInWithOtp,
          verifyOtp: mockVerifyOtp,
          signOut: mockSignOut,
          signInWithOAuth: mockSignInWithOAuth,
          onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
            authStateCallback = cb;
            return { data: { subscription: { unsubscribe: vi.fn() } } };
          }),
        },
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        AuthService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: mockToast },
        { provide: PosthogService, useValue: createMockPosthogService() },
      ],
    });

    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should initialize with loading=true', () => {
    const service = createService();
    // Before getSession resolves, loading is true
    expect(service.loading()).toBe(true);
  });

  it('should restore existing session on creation', async () => {
    const session = buildSession();
    const service = createService(session);

    // Wait for getSession promise to resolve
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe('test-user-id');
    expect(service.currentUser()?.email).toBe('test@example.com');
    expect(service.currentUser()?.tenantId).toBe('tid-1');
  });

  it('should set currentUser on SIGNED_IN event', async () => {
    const service = createService();
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.isAuthenticated()).toBe(false);

    authStateCallback('SIGNED_IN', buildSession());
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.id).toBe('test-user-id');
  });

  it('should clear currentUser on SIGNED_OUT event', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.isAuthenticated()).toBe(true);

    authStateCallback('SIGNED_OUT', null);
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should compute learner role for basic user', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.roles()).toEqual(['learner']);
  });

  it('should compute tenant_admin role', async () => {
    const service = createService(buildSession({ is_tenant_admin: true }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.roles()).toContain('tenant_admin');
    expect(service.roles()).toContain('learner');
  });

  it('should compute platform_admin role', async () => {
    const service = createService(buildSession({ is_platform_admin: true }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.roles()).toContain('platform_admin');
  });

  it('should compute csm role from csm_tenant_ids', async () => {
    const service = createService(buildSession({ csm_tenant_ids: ['t1', 't2'] }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.roles()).toContain('csm');
  });

  it('should compute lecturer role from lecturer_course_ids', async () => {
    const service = createService(buildSession({ lecturer_course_ids: ['c1'] }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.roles()).toContain('lecturer');
  });

  it('should call signInWithPassword correctly', async () => {
    const service = createService();
    await service.signInWithPassword('a@b.com', 'pass');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' });
  });

  it('should call signInWithOtp with shouldCreateUser false', async () => {
    const service = createService();
    await service.signInWithOtp('a@b.com');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      options: { shouldCreateUser: false },
    });
  });

  it('should call verifyOtp correctly', async () => {
    const service = createService();
    await service.verifyOtp('a@b.com', '123456');
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'a@b.com',
      token: '123456',
      type: 'email',
    });
  });

  it('should propagate verifyOtp error', async () => {
    const service = createService();
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' },
    });
    const result = await service.verifyOtp('a@b.com', '000000');
    expect(result.error?.message).toBe('Token has expired or is invalid');
  });

  it('should call signOut correctly', async () => {
    const service = createService();
    await service.signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should call signInWithOAuth for keycloak with scopes', async () => {
    const service = createService();
    await service.signInWithOAuth();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'keycloak',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
        scopes: 'openid',
      },
    });
  });

  it('should pass kc_idp_hint when hint provided', async () => {
    const service = createService();
    await service.signInWithOAuth('equinor-entraid');
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'keycloak',
      options: {
        redirectTo: expect.stringContaining('/auth/callback'),
        scopes: 'openid',
        queryParams: { kc_idp_hint: 'equinor-entraid' },
      },
    });
  });

  it('hasRole returns true for matching role', async () => {
    const service = createService(buildSession({ is_tenant_admin: true }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.hasRole('tenant_admin')).toBe(true);
    expect(service.hasRole('platform_admin')).toBe(false);
  });

  it('hasAnyRole returns true if any role matches', async () => {
    const service = createService(buildSession({ is_platform_admin: true }));
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.hasAnyRole(['platform_admin', 'csm'])).toBe(true);
    expect(service.hasAnyRole(['csm', 'lecturer'])).toBe(false);
  });

  it('should handle malformed JWT gracefully', async () => {
    const toast = createMockToastService();
    const mockSupabase = {
      client: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: {
                user: { id: 'u1', email: 'e@e.com' },
                access_token: 'not-a-jwt',
                refresh_token: 'r',
                expires_in: 3600,
                token_type: 'bearer',
              },
            },
          }),
          onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
          signInWithPassword: vi.fn(),
          signInWithOtp: vi.fn(),
          signOut: vi.fn(),
        },
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        AuthService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: PosthogService, useValue: createMockPosthogService() },
      ],
    });

    const service = TestBed.inject(AuthService);
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    // Should still create user with default claims, not crash
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.claims.tenant_id).toBe('');
  });

  // --- Session expiry / sign-out handling ---

  it('should redirect to /login on user-initiated signOut (no toast)', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await service.signOut();
    authStateCallback('SIGNED_OUT', null);

    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('should show toast and redirect with returnUrl on involuntary session expiry', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    // Simulate being on a deep page
    vi.spyOn(router, 'url', 'get').mockReturnValue('/courses/123/modules');

    // Involuntary sign-out (no signOut() called)
    authStateCallback('SIGNED_OUT', null);

    expect(mockToast.error).toHaveBeenCalledWith(
      'Your session has expired. Please sign in again.',
      { persistent: true },
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/courses/123/modules' },
    });
  });

  it('should not include returnUrl when on root page during session expiry', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/');

    authStateCallback('SIGNED_OUT', null);

    expect(navigateSpy).toHaveBeenCalledWith(['/login'], { queryParams: {} });
  });

  it('should not redirect or toast when SIGNED_OUT fires but user was not authenticated', async () => {
    const service = createService(); // no initial session
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    authStateCallback('SIGNED_OUT', null);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('signOut sets flag before calling supabase signOut', async () => {
    const service = createService(buildSession());
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(mockSignOut).not.toHaveBeenCalled();
    await service.signOut();
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('should recover from getSession rejection (IndexedDB corruption)', async () => {
    mockToast = createMockToastService();
    const mockSupabase = {
      client: {
        auth: {
          getSession: vi.fn().mockRejectedValue(new Error('IndexedDB error')),
          onAuthStateChange: vi.fn(() => ({
            data: { subscription: { unsubscribe: vi.fn() } },
          })),
          signInWithPassword: vi.fn(),
          signInWithOtp: vi.fn(),
          signOut: vi.fn(),
        },
      },
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        AuthService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: mockToast },
        { provide: PosthogService, useValue: createMockPosthogService() },
      ],
    });

    const service = TestBed.inject(AuthService);
    await vi.waitFor(() => expect(service.loading()).toBe(false));

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
