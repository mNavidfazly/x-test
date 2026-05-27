import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ProgressService } from './progress.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { createMockApiService } from '../../__mocks__/api.mock';

describe('ProgressService', () => {
  let service: ProgressService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let apiService: ReturnType<typeof createMockApiService>;

  beforeEach(() => {
    supabase = createMockSupabaseService({ isPlatformAdmin: true });
    apiService = createMockApiService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ApiService, useValue: apiService },
      ],
    });
    service = TestBed.inject(ProgressService);
  });

  function mockRpc(rows: unknown[], error: unknown = null) {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
  }

  it('should have empty initial state', () => {
    expect(service.users()).toEqual([]);
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should call get_progress_dashboard_data RPC', async () => {
    mockRpc([]);
    await service.loadDashboardData();
    expect(supabase.client.rpc).toHaveBeenCalledWith('get_progress_dashboard_data');
  });

  it('should group RPC rows by user and compute weighted overall percent', async () => {
    mockRpc([
      { user_id: 'u1', tenant_id: 't1', tenant_name: 'T1', email: 'alice@test.com', full_name: 'Alice',
        course_id: 'c1', course_title: 'Course A', completed: 2, total: 2, last_updated: '2026-02-05T10:00:00Z' },
      { user_id: 'u1', tenant_id: 't1', tenant_name: 'T1', email: 'alice@test.com', full_name: 'Alice',
        course_id: 'c2', course_title: 'Course B', completed: 0, total: 2, last_updated: null },
      { user_id: 'u2', tenant_id: 't1', tenant_name: 'T1', email: 'bob@test.com', full_name: 'Bob',
        course_id: 'c1', course_title: 'Course A', completed: 0, total: 2, last_updated: null },
    ]);

    await service.loadDashboardData();

    const users = service.users();
    expect(users).toHaveLength(2);

    const alice = users.find(u => u.email === 'alice@test.com')!;
    expect(alice.courses).toHaveLength(2);
    expect(alice.overallPercent).toBe(50); // 2/4
    expect(alice.lastActive).toBe('2026-02-05T10:00:00Z');
    expect(alice.tenant_name).toBe('T1');

    const bob = users.find(u => u.email === 'bob@test.com')!;
    expect(bob.overallPercent).toBe(0);
    expect(bob.lastActive).toBeNull();
  });

  it('should populate courses list from RPC rows (deduplicated)', async () => {
    mockRpc([
      { user_id: 'u1', tenant_id: 't1', tenant_name: null, email: 'a@t', full_name: null,
        course_id: 'c1', course_title: 'Alpha', completed: 0, total: 0, last_updated: null },
      { user_id: 'u2', tenant_id: 't1', tenant_name: null, email: 'b@t', full_name: null,
        course_id: 'c1', course_title: 'Alpha', completed: 0, total: 0, last_updated: null },
      { user_id: 'u1', tenant_id: 't1', tenant_name: null, email: 'a@t', full_name: null,
        course_id: 'c2', course_title: 'Beta', completed: 0, total: 0, last_updated: null },
    ]);

    await service.loadDashboardData();

    expect(service.courses()).toEqual([
      { id: 'c1', title: 'Alpha' },
      { id: 'c2', title: 'Beta' },
    ]);
  });

  it('should leave tenant_name as null when RPC returns null', async () => {
    mockRpc([{
      user_id: 'u1', tenant_id: 't1', tenant_name: null, email: 'a@t', full_name: null,
      course_id: 'c1', course_title: 'X', completed: 1, total: 1, last_updated: null,
    }]);
    await service.loadDashboardData();
    expect(service.users()[0].tenant_name).toBeNull();
  });

  it('should set error on RPC failure', async () => {
    mockRpc(null, { message: 'forbidden' });
    await service.loadDashboardData();
    expect(service.error()).toBe('forbidden');
    expect(service.users()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should set loading during fetch', async () => {
    mockRpc([]);
    expect(service.loading()).toBe(false);
    const promise = service.loadDashboardData();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('should handle empty result', async () => {
    mockRpc([]);
    await service.loadDashboardData();
    expect(service.users()).toEqual([]);
    expect(service.courses()).toEqual([]);
    expect(service.error()).toBe('');
  });

  describe('sendReminders', () => {
    it('should delegate to ApiService.post', async () => {
      const req = { user_ids: ['u1'], message: 'hi', course_id: null };
      service.sendReminders(req);
      expect(apiService.post).toHaveBeenCalledWith('/reminders/send', req);
    });
  });
});
