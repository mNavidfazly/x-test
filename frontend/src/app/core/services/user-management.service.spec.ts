import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UserManagementService } from './user-management.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockApiService } from '../../__mocks__/api.mock';

describe('UserManagementService', () => {
  let service: UserManagementService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;
  let api: ReturnType<typeof createMockApiService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'pa-user-1',
      tenantId: 'master-tenant-id',
      roles: ['platform_admin'],
      claims: { tenant_id: 'master-tenant-id', is_platform_admin: true },
    });
    api = createMockApiService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        UserManagementService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(UserManagementService);
  });

  it('should have empty initial state', () => {
    expect(service.users()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadUsers', () => {
    function mockRpc(rows: unknown[], error: unknown = null) {
      supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
    }

    it('should call get_user_management_data RPC and map rows', async () => {
      mockRpc([
        { user_id: 'u1', email: 'alice@test.com', full_name: 'Alice', avatar_url: null,
          is_tenant_admin: false, is_platform_admin: false, tenant_id: 't1', tenant_name: 'Calypso',
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
        { user_id: 'u2', email: 'bob@test.com', full_name: 'Bob', avatar_url: null,
          is_tenant_admin: true, is_platform_admin: false, tenant_id: 't1', tenant_name: 'Calypso',
          created_at: '2026-01-15T00:00:00Z', updated_at: '2026-02-10T00:00:00Z' },
      ]);

      await service.loadUsers();

      expect(supabase.client.rpc).toHaveBeenCalledWith('get_user_management_data');
      expect(service.users().length).toBe(2);
      expect(service.users()[0].email).toBe('alice@test.com');
      expect(service.users()[0].tenant_name).toBe('Calypso');
      expect(service.users()[1].is_tenant_admin).toBe(true);
      expect(service.error()).toBe('');
    });

    it('should set error on RPC failure', async () => {
      mockRpc(null, { message: 'DB error' });
      await service.loadUsers();
      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      mockRpc([]);
      await service.loadUsers();
      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserManagementService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(UserManagementService);

      await service.loadUsers();

      expect(service.users()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should map null tenant_name to Unknown', async () => {
      mockRpc([{
        user_id: 'u1', email: 'orphan@test.com', full_name: null, avatar_url: null,
        is_tenant_admin: false, is_platform_admin: false, tenant_id: 't1', tenant_name: null,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
      }]);

      await service.loadUsers();

      expect(service.users()[0].tenant_name).toBe('Unknown');
    });
  });

  describe('inviteUser', () => {
    it('should call ApiService.post with email and tenant_id', async () => {
      api.post.mockReturnValue(of({ message: 'Invitation sent' }));

      await service.inviteUser({ email: 'new@test.com', tenant_id: 'tenant-1' });

      expect(api.post).toHaveBeenCalledWith('/invite', {
        email: 'new@test.com',
        tenant_id: 'tenant-1',
      });
    });

    it('should call ApiService.post with email only for TA flow', async () => {
      api.post.mockReturnValue(of({ message: 'Invitation sent' }));

      await service.inviteUser({ email: 'new@test.com' });

      expect(api.post).toHaveBeenCalledWith('/invite', { email: 'new@test.com' });
    });

    it('should throw on API error', async () => {
      api.post.mockReturnValue(throwError(() => new Error('409 Conflict')));

      await expect(service.inviteUser({ email: 'dup@test.com' })).rejects.toThrow();
    });

    it('should throw if not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserManagementService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(UserManagementService);

      await expect(service.inviteUser({ email: 'new@test.com' })).rejects.toThrow('Not authenticated');
    });
  });

  describe('updateUserRoles', () => {
    it('should call update with is_tenant_admin', async () => {
      supabase._mockQueryResponse(null);

      await service.updateUserRoles('u1', { is_tenant_admin: true });

      expect(supabase.client.from).toHaveBeenCalledWith('profiles');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ is_tenant_admin: true });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('should call update with is_platform_admin', async () => {
      supabase._mockQueryResponse(null);

      await service.updateUserRoles('u1', { is_platform_admin: true });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ is_platform_admin: true });
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Trigger error' });

      await expect(service.updateUserRoles('u1', { is_tenant_admin: true })).rejects.toThrow('Trigger error');
    });

    it('should throw if not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          UserManagementService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(UserManagementService);

      await expect(service.updateUserRoles('u1', { is_tenant_admin: true })).rejects.toThrow('Not authenticated');
    });
  });

  describe('updateUserProfile', () => {
    it('should call update with full_name', async () => {
      supabase._mockQueryResponse(null);

      await service.updateUserProfile('u1', { full_name: 'New Name' });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ full_name: 'New Name' });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'u1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Update failed' });

      await expect(service.updateUserProfile('u1', { full_name: 'New' })).rejects.toThrow('Update failed');
    });
  });
});
