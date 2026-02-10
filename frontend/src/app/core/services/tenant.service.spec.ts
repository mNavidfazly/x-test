import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TenantService } from './tenant.service';
import { ApiService } from './api.service';
import { createMockApiService } from '../../__mocks__/api.mock';
import { TenantResolution } from '../models/tenant.model';

describe('TenantService', () => {
  let service: TenantService;
  let mockApi: ReturnType<typeof createMockApiService>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    mockApi = createMockApiService();
    TestBed.configureTestingModule({
      providers: [
        TenantService,
        { provide: ApiService, useValue: mockApi },
      ],
    });
    service = TestBed.inject(TenantService);
  });

  it('should resolve a known domain', async () => {
    const resolution: TenantResolution = {
      tenant_name: 'Acme Corp',
      auth_methods: ['email_password', 'keycloak_sso'],
      idp_hint: null,
    };
    mockApi.post.mockReturnValue(of(resolution));

    const result = await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('user@acme.com').subscribe(resolve);
    });

    expect(result.tenant_name).toBe('Acme Corp');
    expect(result.auth_methods).toEqual(['email_password', 'keycloak_sso']);
    expect(mockApi.post).toHaveBeenCalledWith('/auth/resolve-tenant', { email: 'user@acme.com' });
  });

  it('should return empty for unknown domain', async () => {
    const resolution: TenantResolution = { tenant_name: null, auth_methods: [], idp_hint: null };
    mockApi.post.mockReturnValue(of(resolution));

    const result = await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('user@unknown.com').subscribe(resolve);
    });

    expect(result.tenant_name).toBeNull();
    expect(result.auth_methods).toEqual([]);
  });

  it('should cache results per email', async () => {
    const resolution: TenantResolution = {
      tenant_name: 'Acme',
      auth_methods: ['email_password'],
      idp_hint: null,
    };
    mockApi.post.mockReturnValue(of(resolution));

    // First call
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });

    // Second call with same email
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });

    // Should only call API once (second was cached)
    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });

  it('should call API for different emails even on same domain', async () => {
    const resolution: TenantResolution = { tenant_name: 'Acme', auth_methods: ['keycloak_sso'], idp_hint: 'acme-entraid' };
    mockApi.post.mockReturnValue(of(resolution));

    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('b@acme.com').subscribe(resolve);
    });

    // Different emails = different cache keys (idp_hint is per-user)
    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });

  it('should call API after cache miss for different domain', async () => {
    const resolution1: TenantResolution = { tenant_name: 'Acme', auth_methods: ['email_password'], idp_hint: null };
    const resolution2: TenantResolution = { tenant_name: 'Beta', auth_methods: ['magic_link'], idp_hint: null };
    mockApi.post.mockReturnValueOnce(of(resolution1)).mockReturnValueOnce(of(resolution2));

    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@beta.com').subscribe(resolve);
    });

    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });

  it('should return empty for invalid email (no @)', async () => {
    const result = await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('not-an-email').subscribe(resolve);
    });

    expect(result.tenant_name).toBeNull();
    expect(result.auth_methods).toEqual([]);
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('should clear cache', async () => {
    const resolution: TenantResolution = { tenant_name: 'Acme', auth_methods: ['email_password'], idp_hint: null };
    mockApi.post.mockReturnValue(of(resolution));

    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });

    service.clearCache();

    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });

    expect(mockApi.post).toHaveBeenCalledTimes(2);
  });
});
