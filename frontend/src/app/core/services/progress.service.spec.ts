import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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

  it('should have empty initial state', () => {
    expect(service.users()).toEqual([]);
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadDashboardData', () => {
    function mockQueries(options: {
      courses?: unknown[];
      enrollments?: unknown[];
      progress?: unknown[];
      modules?: unknown[];
      tenants?: unknown[];
    }) {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        switch (callCount) {
          case 1: // courses
            return resolve({ data: options.courses ?? [], error: null });
          case 2: // course_enrollments
            return resolve({ data: options.enrollments ?? [], error: null });
          case 3: // user_progress
            return resolve({ data: options.progress ?? [], error: null });
          case 4: // modules
            return resolve({ data: options.modules ?? [], error: null });
          case 5: // tenants (PA/CSM only)
            return resolve({ data: options.tenants ?? [], error: null });
          default:
            return resolve({ data: [], error: null });
        }
      });
    }

    it('should aggregate per-user per-course progress correctly', async () => {
      mockQueries({
        courses: [
          { id: 'c1', title: 'Course A' },
          { id: 'c2', title: 'Course B' },
        ],
        enrollments: [
          { user_id: 'u1', tenant_id: 't1', course_id: 'c1', profiles: { email: 'alice@test.com', full_name: 'Alice' } },
          { user_id: 'u1', tenant_id: 't1', course_id: 'c2', profiles: { email: 'alice@test.com', full_name: 'Alice' } },
          { user_id: 'u2', tenant_id: 't1', course_id: 'c1', profiles: { email: 'bob@test.com', full_name: 'Bob' } },
        ],
        progress: [
          { user_id: 'u1', course_id: 'c1', module_id: 'm1', status: 'completed', updated_at: '2026-02-01T10:00:00Z' },
          { user_id: 'u1', course_id: 'c1', module_id: 'm2', status: 'completed', updated_at: '2026-02-05T10:00:00Z' },
          { user_id: 'u1', course_id: 'c2', module_id: 'm3', status: 'in_progress', updated_at: '2026-02-03T10:00:00Z' },
        ],
        modules: [
          { id: 'm1', course_id: 'c1' },
          { id: 'm2', course_id: 'c1' },
          { id: 'm3', course_id: 'c2' },
          { id: 'm4', course_id: 'c2' },
        ],
        tenants: [{ id: 't1', name: 'Tenant 1' }],
      });

      await service.loadDashboardData();

      expect(service.error()).toBe('');
      expect(service.loading()).toBe(false);

      const users = service.users();
      expect(users).toHaveLength(2);

      // Alice (sorted by email)
      const alice = users.find(u => u.email === 'alice@test.com')!;
      expect(alice.courses).toHaveLength(2);
      expect(alice.courses.find(c => c.course_id === 'c1')).toEqual({
        course_id: 'c1', course_title: 'Course A', completed: 2, total: 2, percent: 100,
      });
      expect(alice.courses.find(c => c.course_id === 'c2')).toEqual({
        course_id: 'c2', course_title: 'Course B', completed: 0, total: 2, percent: 0,
      });
      // Overall: 2 completed / 4 total = 50%
      expect(alice.overallPercent).toBe(50);
      expect(alice.lastActive).toBe('2026-02-05T10:00:00Z');
      expect(alice.tenant_name).toBe('Tenant 1');

      // Bob (no progress)
      const bob = users.find(u => u.email === 'bob@test.com')!;
      expect(bob.overallPercent).toBe(0);
      expect(bob.lastActive).toBeNull();
    });

    it('should handle users with no progress rows', async () => {
      mockQueries({
        courses: [{ id: 'c1', title: 'Course A' }],
        enrollments: [
          { user_id: 'u1', tenant_id: 't1', course_id: 'c1', profiles: { email: 'new@test.com', full_name: null } },
        ],
        progress: [],
        modules: [{ id: 'm1', course_id: 'c1' }, { id: 'm2', course_id: 'c1' }],
        tenants: [{ id: 't1', name: 'Test' }],
      });

      await service.loadDashboardData();

      const users = service.users();
      expect(users).toHaveLength(1);
      expect(users[0].overallPercent).toBe(0);
      expect(users[0].lastActive).toBeNull();
      expect(users[0].courses[0].percent).toBe(0);
    });

    it('should set error on query failure', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: unknown }) => void) => {
        callCount++;
        if (callCount === 1) {
          return resolve({ data: null, error: { message: 'Permission denied' } });
        }
        return resolve({ data: [], error: null });
      });

      await service.loadDashboardData();

      expect(service.error()).toBe('Permission denied');
      expect(service.loading()).toBe(false);
    });

    it('should set loading signal during load', async () => {
      mockQueries({});

      expect(service.loading()).toBe(false);
      const promise = service.loadDashboardData();
      // Loading is set synchronously at the start
      expect(service.loading()).toBe(true);
      await promise;
      expect(service.loading()).toBe(false);
    });

    it('should populate courses list', async () => {
      mockQueries({
        courses: [
          { id: 'c1', title: 'Alpha Course' },
          { id: 'c2', title: 'Beta Course' },
        ],
        tenants: [],
      });

      await service.loadDashboardData();

      expect(service.courses()).toEqual([
        { id: 'c1', title: 'Alpha Course' },
        { id: 'c2', title: 'Beta Course' },
      ]);
    });

    it('should handle empty data gracefully', async () => {
      mockQueries({});

      await service.loadDashboardData();

      expect(service.users()).toEqual([]);
      expect(service.courses()).toEqual([]);
      expect(service.error()).toBe('');
    });

    it('should skip tenant names for non-PA/CSM roles', async () => {
      // Re-create service with TA role
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ProgressService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_tenant_admin: true } }) },
          { provide: ApiService, useValue: apiService },
        ],
      });
      service = TestBed.inject(ProgressService);

      // Only 4 queries expected (no tenants query)
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        switch (callCount) {
          case 1:
            return resolve({ data: [{ id: 'c1', title: 'Course A' }], error: null });
          case 2:
            return resolve({ data: [{ user_id: 'u1', tenant_id: 't1', course_id: 'c1', profiles: { email: 'test@t.com', full_name: null } }], error: null });
          case 3:
            return resolve({ data: [], error: null });
          case 4:
            return resolve({ data: [{ id: 'm1', course_id: 'c1' }], error: null });
          default:
            return resolve({ data: [], error: null });
        }
      });

      await service.loadDashboardData();

      const users = service.users();
      expect(users).toHaveLength(1);
      expect(users[0].tenant_name).toBeNull();
      // 5th call (tenants) should not happen for TA
      expect(callCount).toBe(4);
    });
  });

  describe('sendReminders', () => {
    it('should call ApiService.post with correct payload', () => {
      const mockResponse = of({ sent: 3, failed: 0 });
      apiService.post.mockReturnValue(mockResponse);

      const request = { user_ids: ['u1', 'u2', 'u3'], course_id: 'c1', message: 'Keep going!' };
      const result = service.sendReminders(request);

      expect(apiService.post).toHaveBeenCalledWith('/reminders/send', request);
      result.subscribe(res => {
        expect(res).toEqual({ sent: 3, failed: 0 });
      });
    });
  });
});
