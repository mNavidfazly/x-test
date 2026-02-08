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
      auth_methods: ['email_password', 'azure_sso'],
    };
    mockApi.post.mockReturnValue(of(resolution));

    const result = await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('user@acme.com').subscribe(resolve);
    });

    expect(result.tenant_name).toBe('Acme Corp');
    expect(result.auth_methods).toEqual(['email_password', 'azure_sso']);
    expect(mockApi.post).toHaveBeenCalledWith('/auth/resolve-tenant', { email: 'user@acme.com' });
  });

  it('should return empty for unknown domain', async () => {
    const resolution: TenantResolution = { tenant_name: null, auth_methods: [] };
    mockApi.post.mockReturnValue(of(resolution));

    const result = await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('user@unknown.com').subscribe(resolve);
    });

    expect(result.tenant_name).toBeNull();
    expect(result.auth_methods).toEqual([]);
  });

  it('should cache results per domain', async () => {
    const resolution: TenantResolution = {
      tenant_name: 'Acme',
      auth_methods: ['email_password'],
    };
    mockApi.post.mockReturnValue(of(resolution));

    // First call
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('a@acme.com').subscribe(resolve);
    });

    // Second call with same domain
    await new Promise<TenantResolution>((resolve) => {
      service.resolveTenant('b@acme.com').subscribe(resolve);
    });

    // Should only call API once (second was cached)
    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });

  it('should call API after cache miss for different domain', async () => {
    const resolution1: TenantResolution = { tenant_name: 'Acme', auth_methods: ['email_password'] };
    const resolution2: TenantResolution = { tenant_name: 'Beta', auth_methods: ['magic_link'] };
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
    const resolution: TenantResolution = { tenant_name: 'Acme', auth_methods: ['email_password'] };
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
