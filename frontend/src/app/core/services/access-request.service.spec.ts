import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AccessRequestService } from './access-request.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockApiService } from '../../__mocks__/api.mock';

describe('AccessRequestService', () => {
  let service: AccessRequestService;
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
        AccessRequestService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(AccessRequestService);
  });

  it('should have empty initial state', () => {
    expect(service.requests()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadRequests', () => {
    it('should load requests with tenant_name and reviewer_name from FK joins', async () => {
      const mockRequests = [
        {
          id: 'r1',
          email: 'alice@client.com',
          full_name: 'Alice Requester',
          domain: 'client.com',
          tenant_id: 't1',
          tenant: { name: 'Client Corp' },
          status: 'pending',
          reviewed_by: null,
          reviewer: null,
          reviewed_at: null,
          review_notes: null,
          created_at: '2026-02-01T00:00:00Z',
        },
        {
          id: 'r2',
          email: 'bob@known.com',
          full_name: 'Bob',
          domain: 'known.com',
          tenant_id: 't1',
          tenant: { name: 'Client Corp' },
          status: 'approved',
          reviewed_by: 'pa-user-1',
          reviewer: { full_name: 'Admin User' },
          reviewed_at: '2026-02-10T00:00:00Z',
          review_notes: 'Approved for onboarding',
          created_at: '2026-01-15T00:00:00Z',
        },
      ];
      supabase._mockQueryResponse(mockRequests);

      await service.loadRequests();

      expect(service.requests().length).toBe(2);
      expect(service.requests()[0].email).toBe('alice@client.com');
      expect(service.requests()[0].tenant_name).toBe('Client Corp');
      expect(service.requests()[0].reviewer_name).toBeNull();
      expect(service.requests()[1].status).toBe('approved');
      expect(service.requests()[1].reviewer_name).toBe('Admin User');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'Permission denied' });

      await service.loadRequests();

      expect(service.error()).toBe('Permission denied');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      supabase._mockQueryResponse([]);

      await service.loadRequests();

      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AccessRequestService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(AccessRequestService);

      await service.loadRequests();

      expect(service.requests()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should map null tenant join to null', async () => {
      supabase._mockQueryResponse([
        {
          id: 'r1',
          email: 'unknown@foreign.com',
          full_name: null,
          domain: 'foreign.com',
          tenant_id: null,
          tenant: null,
          status: 'pending',
          reviewed_by: null,
          reviewer: null,
          reviewed_at: null,
          review_notes: null,
          created_at: '2026-02-01T00:00:00Z',
        },
      ]);

      await service.loadRequests();

      expect(service.requests()[0].tenant_name).toBeNull();
      expect(service.requests()[0].domain).toBe('foreign.com');
    });
  });

  describe('reviewRequest', () => {
    it('should call update with status, reviewed_by, and reviewed_at', async () => {
      supabase._mockQueryResponse(null);

      await service.reviewRequest('r1', { status: 'approved' }, 'pa-user-1');

      expect(supabase.client.from).toHaveBeenCalledWith('access_requests');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          reviewed_by: 'pa-user-1',
          review_notes: null,
        }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'r1');
    });

    it('should include review_notes for rejection', async () => {
      supabase._mockQueryResponse(null);

      await service.reviewRequest(
        'r1',
        { status: 'rejected', review_notes: 'Not eligible' },
        'pa-user-1',
      );

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'rejected',
          review_notes: 'Not eligible',
        }),
      );
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Update denied' });

      await expect(
        service.reviewRequest('r1', { status: 'approved' }, 'pa-user-1'),
      ).rejects.toThrow('Update denied');
    });

    it('should throw if not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AccessRequestService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(AccessRequestService);

      await expect(
        service.reviewRequest('r1', { status: 'approved' }, 'pa-user-1'),
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('approveAndInvite', () => {
    it('should call reviewRequest then ApiService.post', async () => {
      supabase._mockQueryResponse(null);
      api.post.mockReturnValue(of({ message: 'Invitation sent' }));

      await service.approveAndInvite('r1', 'alice@client.com', 't1', 'pa-user-1');

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      );
      expect(api.post).toHaveBeenCalledWith('/invite', {
        email: 'alice@client.com',
        tenant_id: 't1',
      });
    });

    it('should send email and tenant_id to invite endpoint', async () => {
      supabase._mockQueryResponse(null);
      api.post.mockReturnValue(of({ message: 'Sent' }));

      await service.approveAndInvite('r1', 'bob@test.com', 'tenant-2', 'pa-user-1');

      expect(api.post).toHaveBeenCalledWith('/invite', {
        email: 'bob@test.com',
        tenant_id: 'tenant-2',
      });
    });

    it('should throw if invite step fails (request already marked approved)', async () => {
      supabase._mockQueryResponse(null);
      api.post.mockReturnValue(throwError(() => new Error('409 Conflict')));

      await expect(
        service.approveAndInvite('r1', 'dup@test.com', 't1', 'pa-user-1'),
      ).rejects.toThrow();

      // Review step was still called
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('should throw if review step fails (invite not called)', async () => {
      supabase._mockQueryResponse(null, { message: 'RLS denied' });

      await expect(
        service.approveAndInvite('r1', 'alice@client.com', 't1', 'pa-user-1'),
      ).rejects.toThrow('RLS denied');

      expect(api.post).not.toHaveBeenCalled();
    });

    it('should throw if not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AccessRequestService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
          { provide: ApiService, useValue: api },
        ],
      });
      service = TestBed.inject(AccessRequestService);

      await expect(
        service.approveAndInvite('r1', 'alice@test.com', 't1', 'pa-user-1'),
      ).rejects.toThrow('Not authenticated');
    });
  });
});
