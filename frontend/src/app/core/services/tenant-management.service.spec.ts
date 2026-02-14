import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TenantManagementService } from './tenant-management.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({
      isAuthenticated: true,
      userId: 'pa-user-1',
      tenantId: 'master-tenant-id',
      roles: ['platform_admin'],
      claims: { tenant_id: 'master-tenant-id', is_platform_admin: true },
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TenantManagementService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(TenantManagementService);
  });

  it('should have empty initial state', () => {
    expect(service.tenants()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadTenants', () => {
    it('should load tenants with courseCount and csmCount', async () => {
      const mockTenants = [
        {
          id: 't1', name: 'Calypso', domain: 'calypso.com', is_master: true,
          settings: { auth_methods: ['keycloak_sso'] },
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z',
          tenant_courses: [{ count: 5 }],
          csm_tenant_assignments: [{ count: 0 }],
        },
        {
          id: 't2', name: 'Santos', domain: 'santos.com', is_master: false,
          settings: { auth_methods: ['email_password', 'magic_link'] },
          created_at: '2026-01-15T00:00:00Z', updated_at: '2026-02-10T00:00:00Z',
          tenant_courses: [{ count: 3 }],
          csm_tenant_assignments: [{ count: 2 }],
        },
      ];
      supabase._mockQueryResponse(mockTenants);

      await service.loadTenants();

      expect(service.tenants().length).toBe(2);
      expect(service.tenants()[0].name).toBe('Calypso');
      expect(service.tenants()[0].courseCount).toBe(5);
      expect(service.tenants()[0].csmCount).toBe(0);
      expect(service.tenants()[1].courseCount).toBe(3);
      expect(service.tenants()[1].csmCount).toBe(2);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'DB error' });

      await service.loadTenants();

      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      supabase._mockQueryResponse([]);

      await service.loadTenants();

      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          TenantManagementService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(TenantManagementService);

      await service.loadTenants();

      expect(service.tenants()).toEqual([]);
      expect(supabase.client.from).not.toHaveBeenCalled();
    });

    it('should query tenants table', async () => {
      supabase._mockQueryResponse([]);

      await service.loadTenants();

      expect(supabase.client.from).toHaveBeenCalledWith('tenants');
    });
  });

  describe('createTenant', () => {
    it('should insert with correct fields', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.createTenant({
        name: 'New Tenant',
        domain: 'newtenant.com',
        auth_methods: ['email_password', 'magic_link'],
      });

      expect(supabase.client.from).toHaveBeenCalledWith('tenants');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Tenant',
          domain: 'newtenant.com',
          settings: { auth_methods: ['email_password', 'magic_link'] },
        }),
      );
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: { message: string } }) => void) =>
          resolve({ data: null, error: { message: 'Duplicate domain' } }),
      );

      await expect(
        service.createTenant({ name: 'Test', domain: 'dup.com', auth_methods: ['email_password'] }),
      ).rejects.toThrow('Duplicate domain');
    });
  });

  describe('updateTenant', () => {
    it('should update with correct payload', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.updateTenant('t1', {
        name: 'Updated Name',
        auth_methods: ['keycloak_sso'],
      });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          settings: { auth_methods: ['keycloak_sso'] },
        }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 't1');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: { message: string } }) => void) =>
          resolve({ data: null, error: { message: 'Update failed' } }),
      );

      await expect(
        service.updateTenant('t1', { name: 'X' }),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteTenant', () => {
    it('should delete by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.deleteTenant('t1');

      expect(supabase.client.from).toHaveBeenCalledWith('tenants');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 't1');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: { message: string } }) => void) =>
          resolve({ data: null, error: { message: 'Cannot delete master' } }),
      );

      await expect(service.deleteTenant('t1')).rejects.toThrow('Cannot delete master');
    });
  });

  describe('loadTenantCourses', () => {
    it('should return course assignments with joined title', async () => {
      supabase._mockQueryResponse([
        { id: 'tc-1', course_id: 'c1', course: { title: 'X-LNG Advanced' } },
        { id: 'tc-2', course_id: 'c2', course: { title: 'X-Crude Basics' } },
      ]);

      const result = await service.loadTenantCourses('t1');

      expect(result.length).toBe(2);
      expect(result[0].course_title).toBe('X-LNG Advanced');
      expect(result[1].course_id).toBe('c2');
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('tenant_id', 't1');
    });
  });

  describe('loadAvailableCourses', () => {
    it('should filter out already-assigned courses', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown[]; error: null }) => void) => {
          callCount++;
          if (callCount === 1) {
            // All courses
            return resolve({
              data: [
                { id: 'c1', title: 'Course A' },
                { id: 'c2', title: 'Course B' },
                { id: 'c3', title: 'Course C' },
              ],
              error: null,
            });
          }
          // Assigned course IDs
          return resolve({
            data: [{ course_id: 'c1' }],
            error: null,
          });
        },
      );

      const result = await service.loadAvailableCourses('t1');

      expect(result.length).toBe(2);
      expect(result[0].title).toBe('Course B');
      expect(result[1].title).toBe('Course C');
    });
  });

  describe('assignCourseToTenant', () => {
    it('should insert into tenant_courses', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.assignCourseToTenant('t1', 'c1');

      expect(supabase.client.from).toHaveBeenCalledWith('tenant_courses');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 't1', course_id: 'c1' }),
      );
    });
  });

  describe('removeCourseFromTenant', () => {
    it('should delete from tenant_courses', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.removeCourseFromTenant('t1', 'c1');

      expect(supabase.client.from).toHaveBeenCalledWith('tenant_courses');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });

  describe('loadCsmAssignments', () => {
    it('should return CSMs with profile join', async () => {
      supabase._mockQueryResponse([
        {
          id: 'csa-1', user_id: 'u1', assigned_at: '2026-02-01T00:00:00Z',
          user: { email: 'csm@calypso.com', full_name: 'CSM User' },
        },
      ]);

      const result = await service.loadCsmAssignments('t1');

      expect(result.length).toBe(1);
      expect(result[0].email).toBe('csm@calypso.com');
      expect(result[0].full_name).toBe('CSM User');
    });
  });

  describe('assignCsm', () => {
    it('should insert into csm_tenant_assignments with assigned_by', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.assignCsm('t1', 'csm-user-1');

      expect(supabase.client.from).toHaveBeenCalledWith('csm_tenant_assignments');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 't1',
          user_id: 'csm-user-1',
          assigned_by: 'pa-user-1',
        }),
      );
    });
  });

  describe('removeCsm', () => {
    it('should delete assignment by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.removeCsm('csa-1');

      expect(supabase.client.from).toHaveBeenCalledWith('csm_tenant_assignments');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'csa-1');
    });
  });
});
