import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';
import { AppNotification } from '../models/notification.model';

function createNotification(overrides?: Partial<AppNotification>): AppNotification {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    type: 'course_assigned',
    title: 'New course assigned',
    body: 'You have been assigned to Test Course',
    data: { course_id: 'course-1' },
    read_at: null,
    created_at: '2026-02-10T10:00:00Z',
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    vi.useFakeTimers();
    supabase = createMockSupabaseService();
    // Start unauthenticated to prevent effect from auto-firing
    auth = createMockAuthService({ isAuthenticated: false });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have empty initial state', () => {
    expect(service.notifications()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
    expect(service.unreadCount()).toBe(0);
    expect(service.latestToast()).toBeNull();
  });

  describe('loadNotifications', () => {
    it('should fetch and set notifications', async () => {
      const mockData = [
        createNotification({ id: 'n1' }),
        createNotification({ id: 'n2', read_at: '2026-02-10T12:00:00Z' }),
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadNotifications();

      expect(service.notifications().length).toBe(2);
      expect(service.notifications()[0].id).toBe('n1');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should handle empty list', async () => {
      supabase._mockQueryResponse([]);

      await service.loadNotifications();

      expect(service.notifications()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'DB error' });

      await service.loadNotifications();

      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });

    it('should transition loading correctly', async () => {
      supabase._mockQueryResponse([]);

      const promise = service.loadNotifications();
      expect(service.loading()).toBe(true);

      await promise;
      expect(service.loading()).toBe(false);
    });
  });

  describe('unreadCount', () => {
    it('should count notifications with null read_at', async () => {
      const mockData = [
        createNotification({ id: 'n1', read_at: null }),
        createNotification({ id: 'n2', read_at: null }),
        createNotification({ id: 'n3', read_at: '2026-02-10T12:00:00Z' }),
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadNotifications();

      expect(service.unreadCount()).toBe(2);
    });

    it('should return 0 when all are read', async () => {
      const mockData = [
        createNotification({ id: 'n1', read_at: '2026-02-10T12:00:00Z' }),
        createNotification({ id: 'n2', read_at: '2026-02-10T12:00:00Z' }),
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadNotifications();

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should call update with id and update local signal', async () => {
      // Load initial data
      const mockData = [createNotification({ id: 'n1', read_at: null })];
      supabase._mockQueryResponse(mockData);
      await service.loadNotifications();
      expect(service.unreadCount()).toBe(1);

      // Mock the update call
      supabase._mockQueryBuilder.then.mockImplementationOnce(
        (resolve: (value: { data: null; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.markAsRead('n1');

      expect(supabase.client.from).toHaveBeenCalledWith('notifications');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ read_at: expect.any(String) }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'n1');
      expect(service.notifications()[0].read_at).not.toBeNull();
      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should call mark_all_notifications_read RPC and update local signal', async () => {
      const mockData = [
        createNotification({ id: 'n1', read_at: null }),
        createNotification({ id: 'n2', read_at: null }),
        createNotification({ id: 'n3', read_at: '2026-02-10T12:00:00Z' }),
      ];
      supabase._mockQueryResponse(mockData);
      await service.loadNotifications();
      expect(service.unreadCount()).toBe(2);

      supabase.client.rpc = vi.fn().mockResolvedValue({ data: 2, error: null });

      await service.markAllAsRead();

      expect(supabase.client.rpc).toHaveBeenCalledWith('mark_all_notifications_read');
      expect(service.unreadCount()).toBe(0);
      expect(service.notifications().every(n => n.read_at !== null)).toBe(true);
    });

    it('should not update local signal when RPC returns error', async () => {
      const mockData = [createNotification({ id: 'n1', read_at: null })];
      supabase._mockQueryResponse(mockData);
      await service.loadNotifications();

      supabase.client.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });

      await service.markAllAsRead();

      expect(service.unreadCount()).toBe(1);
      expect(service.notifications()[0].read_at).toBeNull();
    });
  });

  describe('realtime', () => {
    it('should create channel when user is authenticated', () => {
      // Simulate user login by updating the auth mock
      auth._setUser({
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        roles: ['learner'],
        claims: {
          tenant_id: 'tenant-1',
          is_platform_admin: false,
          is_tenant_admin: false,
          csm_tenant_ids: [],
          lecturer_course_ids: [],
          lecturer_can_edit_course_ids: [],
          lecturer_can_grade_course_ids: [],
        },
      });
      // Flush effects
      TestBed.flushEffects();

      expect(supabase.client.channel).toHaveBeenCalledWith('notifs-user-1');
    });

    it('should remove channel on logout', () => {
      // Login first
      auth._setUser({
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        roles: ['learner'],
        claims: {
          tenant_id: 'tenant-1',
          is_platform_admin: false,
          is_tenant_admin: false,
          csm_tenant_ids: [],
          lecturer_course_ids: [],
          lecturer_can_edit_course_ids: [],
          lecturer_can_grade_course_ids: [],
        },
      });
      TestBed.flushEffects();

      // Logout
      auth._setUser(null);
      TestBed.flushEffects();

      expect(supabase.client.removeChannel).toHaveBeenCalled();
    });
  });

  describe('toast', () => {
    it('should dismiss toast', () => {
      service.dismissToast();
      expect(service.latestToast()).toBeNull();
    });
  });
});
