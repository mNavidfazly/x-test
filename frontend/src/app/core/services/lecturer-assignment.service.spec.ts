import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LecturerAssignmentService } from './lecturer-assignment.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('LecturerAssignmentService', () => {
  let service: LecturerAssignmentService;
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
        LecturerAssignmentService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(LecturerAssignmentService);
  });

  it('should have empty initial state', () => {
    expect(service.assignments()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadAssignments', () => {
    it('should load assignments with FK joins mapped to flat fields', async () => {
      supabase._mockQueryResponse([
        {
          id: 'a1',
          user_id: 'u1',
          course_id: 'c1',
          can_edit: true,
          can_grade: true,
          assigned_at: '2026-02-01T00:00:00Z',
          user: { email: 'lecturer@master.com', full_name: 'Test Lecturer' },
          course: { title: 'Course Alpha' },
          assigner: { full_name: 'Platform Admin' },
        },
        {
          id: 'a2',
          user_id: 'u2',
          course_id: 'c1',
          can_edit: false,
          can_grade: false,
          assigned_at: '2026-01-15T00:00:00Z',
          user: { email: 'viewer@master.com', full_name: 'View Only' },
          course: { title: 'Course Alpha' },
          assigner: null,
        },
      ]);

      await service.loadAssignments();

      expect(service.assignments().length).toBe(2);
      expect(service.assignments()[0].email).toBe('lecturer@master.com');
      expect(service.assignments()[0].full_name).toBe('Test Lecturer');
      expect(service.assignments()[0].course_title).toBe('Course Alpha');
      expect(service.assignments()[0].can_edit).toBe(true);
      expect(service.assignments()[0].assigned_by_name).toBe('Platform Admin');
      expect(service.assignments()[1].can_edit).toBe(false);
      expect(service.assignments()[1].assigned_by_name).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'Permission denied' });

      await service.loadAssignments();

      expect(service.error()).toBe('Permission denied');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      supabase._mockQueryResponse([]);

      await service.loadAssignments();

      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          LecturerAssignmentService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(LecturerAssignmentService);

      await service.loadAssignments();

      expect(service.assignments()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should map null FK joins to defaults', async () => {
      supabase._mockQueryResponse([
        {
          id: 'a1',
          user_id: 'u1',
          course_id: 'c1',
          can_edit: false,
          can_grade: true,
          assigned_at: '2026-02-01T00:00:00Z',
          user: null,
          course: null,
          assigner: null,
        },
      ]);

      await service.loadAssignments();

      expect(service.assignments()[0].email).toBe('Unknown');
      expect(service.assignments()[0].full_name).toBeNull();
      expect(service.assignments()[0].course_title).toBe('Unknown Course');
      expect(service.assignments()[0].assigned_by_name).toBeNull();
    });
  });

  describe('addAssignment', () => {
    it('should call insert with user_id, course_id, and assigned_by', async () => {
      supabase._mockQueryResponse(null);

      await service.addAssignment('u1', 'c1');

      expect(supabase.client.from).toHaveBeenCalledWith(
        'lecturer_course_assignments',
      );
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        user_id: 'u1',
        course_id: 'c1',
        assigned_by: 'pa-user-1',
      });
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, {
        message: 'Only users from the master tenant can be assigned',
      });

      await expect(service.addAssignment('u1', 'c1')).rejects.toThrow(
        'Only users from the master tenant can be assigned',
      );
    });

    it('should throw if not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          LecturerAssignmentService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(LecturerAssignmentService);

      await expect(service.addAssignment('u1', 'c1')).rejects.toThrow(
        'Not authenticated',
      );
    });
  });

  describe('removeAssignment', () => {
    it('should call delete with eq id', async () => {
      supabase._mockQueryResponse(null);

      await service.removeAssignment('a1');

      expect(supabase.client.from).toHaveBeenCalledWith(
        'lecturer_course_assignments',
      );
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'a1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Delete denied' });

      await expect(service.removeAssignment('a1')).rejects.toThrow(
        'Delete denied',
      );
    });
  });

  describe('updatePermissions', () => {
    it('should call update with permission data', async () => {
      supabase._mockQueryResponse(null);

      await service.updatePermissions('a1', {
        can_edit: true,
        can_grade: false,
      });

      expect(supabase.client.from).toHaveBeenCalledWith(
        'lecturer_course_assignments',
      );
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({
        can_edit: true,
        can_grade: false,
      });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'a1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Update denied' });

      await expect(
        service.updatePermissions('a1', { can_edit: true }),
      ).rejects.toThrow('Update denied');
    });
  });

  describe('loadAvailableLecturers', () => {
    it('should return master-tenant profiles ordered by email', async () => {
      supabase._mockQueryResponse([
        { id: 'u1', email: 'alice@master.com', full_name: 'Alice' },
        { id: 'u2', email: 'bob@master.com', full_name: 'Bob' },
      ]);

      const result = await service.loadAvailableLecturers();

      expect(result).toEqual([
        { id: 'u1', email: 'alice@master.com', full_name: 'Alice' },
        { id: 'u2', email: 'bob@master.com', full_name: 'Bob' },
      ]);
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith(
        'tenant_id',
        'master-tenant-id',
      );
    });
  });

  describe('loadAvailableCourses', () => {
    it('should return courses not assigned to the given user', async () => {
      // First call: all courses
      supabase._mockQueryResponse([
        { id: 'c1', title: 'Course Alpha' },
        { id: 'c2', title: 'Course Beta' },
        { id: 'c3', title: 'Course Gamma' },
      ]);

      // Override for second call: already-assigned
      const originalFrom = supabase.client.from;
      let callCount = 0;
      supabase.client.from = ((...args: any[]) => {
        callCount++;
        const result = (originalFrom as any)(...args);
        if (callCount === 2) {
          // Second from() call — mock the assigned courses
          result.select = () => ({
            eq: () =>
              Promise.resolve({
                data: [{ course_id: 'c1' }],
                error: null,
              }),
          });
        }
        return result;
      }) as any;

      const result = await service.loadAvailableCourses('u1');

      expect(result).toEqual([
        { id: 'c2', title: 'Course Beta' },
        { id: 'c3', title: 'Course Gamma' },
      ]);
    });
  });
});
