import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StalenessService } from './staleness.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('StalenessService', () => {
  let service: StalenessService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        StalenessService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(StalenessService);
  });

  const now = new Date().toISOString();
  const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const daysFromNowIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

  function mockRpc(rows: unknown[], error: unknown = null) {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
  }

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should call get_staleness_data RPC', async () => {
    mockRpc([]);
    await service.loadStalenessData();
    expect(supabase.client.rpc).toHaveBeenCalledWith('get_staleness_data');
  });

  it('should map RPC rows to StaleCourse with per-module flags from server', async () => {
    mockRpc([
      {
        course_id: 'c1',
        title: 'Old Course',
        threshold_days: 90,
        modules: [
          {
            id: 'm1', title: 'Module A', module_type: 'video',
            updated_at: daysAgoIso(120), days_since_update: 120,
            is_stale: true, days_overdue: 30,
            postponed_until: null, is_postponed: false,
          },
          {
            id: 'm2', title: 'Module B', module_type: 'pdf',
            updated_at: daysAgoIso(50), days_since_update: 50,
            is_stale: false, days_overdue: null,
            postponed_until: null, is_postponed: false,
          },
        ],
      },
    ]);

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.id).toBe('c1');
    expect(course.title).toBe('Old Course');
    expect(course.thresholdDays).toBe(90);
    expect(course.totalModuleCount).toBe(2);
    expect(course.hasStaleModules).toBe(true);
    expect(course.staleModuleCount).toBe(1);
    expect(course.freshModuleCount).toBe(1);

    // Stale module sorted first
    expect(course.modules[0].id).toBe('m1');
    expect(course.modules[0].isStale).toBe(true);
    expect(course.modules[0].daysOverdue).toBe(30);
    expect(course.modules[0].moduleType).toBe('video');

    // Fresh module second
    expect(course.modules[1].id).toBe('m2');
    expect(course.modules[1].isStale).toBe(false);
    expect(course.modules[1].daysOverdue).toBeNull();
  });

  it('should sort stale modules by daysOverdue desc', async () => {
    mockRpc([{
      course_id: 'c1', title: 'C', threshold_days: 90,
      modules: [
        { id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 100, is_stale: true, days_overdue: 10, postponed_until: null, is_postponed: false },
        { id: 'm2', title: 'B', module_type: 'video', updated_at: now, days_since_update: 200, is_stale: true, days_overdue: 110, postponed_until: null, is_postponed: false },
      ],
    }]);

    await service.loadStalenessData();

    expect(service.courses()[0].modules.map(m => m.id)).toEqual(['m2', 'm1']);
  });

  it('should treat postponed modules as not stale (server flag)', async () => {
    mockRpc([{
      course_id: 'c1', title: 'C', threshold_days: 90,
      modules: [
        { id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 120, is_stale: false, days_overdue: 30, postponed_until: daysFromNowIso(15), is_postponed: true },
        { id: 'm2', title: 'B', module_type: 'video', updated_at: now, days_since_update: 120, is_stale: true, days_overdue: 30, postponed_until: null, is_postponed: false },
      ],
    }]);

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.staleModuleCount).toBe(1);
    expect(course.postponedModuleCount).toBe(1);
    expect(course.freshModuleCount).toBe(0);
  });

  it('should handle empty courses list', async () => {
    mockRpc([]);
    await service.loadStalenessData();
    expect(service.courses()).toEqual([]);
    expect(service.error()).toBe('');
  });

  it('should handle empty modules array', async () => {
    mockRpc([{ course_id: 'c1', title: 'Empty', threshold_days: 180, modules: [] }]);
    await service.loadStalenessData();
    expect(service.courses()[0].totalModuleCount).toBe(0);
    expect(service.courses()[0].hasStaleModules).toBe(false);
  });

  it('should set error on RPC failure', async () => {
    mockRpc(null, { message: 'forbidden' });
    await service.loadStalenessData();
    expect(service.error()).toBe('forbidden');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should sort courses: has-stale first, then has-postponed, then all-fresh, then no-modules', async () => {
    mockRpc([
      { course_id: 'c1', title: 'NoModules', threshold_days: 180, modules: [] },
      { course_id: 'c2', title: 'AllFresh', threshold_days: 180, modules: [
        { id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 30, is_stale: false, days_overdue: null, postponed_until: null, is_postponed: false },
      ]},
      { course_id: 'c3', title: 'HasStale', threshold_days: 90, modules: [
        { id: 'm2', title: 'B', module_type: 'video', updated_at: now, days_since_update: 200, is_stale: true, days_overdue: 110, postponed_until: null, is_postponed: false },
      ]},
      { course_id: 'c4', title: 'HasPostponed', threshold_days: 90, modules: [
        { id: 'm3', title: 'C', module_type: 'video', updated_at: now, days_since_update: 200, is_stale: false, days_overdue: 110, postponed_until: daysFromNowIso(10), is_postponed: true },
      ]},
    ]);

    await service.loadStalenessData();
    expect(service.courses().map(c => c.title)).toEqual(['HasStale', 'HasPostponed', 'AllFresh', 'NoModules']);
  });

  it('should sort multiple has-stale courses by max daysOverdue desc', async () => {
    mockRpc([
      { course_id: 'c1', title: 'Slightly', threshold_days: 90, modules: [
        { id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 100, is_stale: true, days_overdue: 10, postponed_until: null, is_postponed: false },
      ]},
      { course_id: 'c2', title: 'Very', threshold_days: 90, modules: [
        { id: 'm2', title: 'B', module_type: 'video', updated_at: now, days_since_update: 200, is_stale: true, days_overdue: 110, postponed_until: null, is_postponed: false },
      ]},
    ]);

    await service.loadStalenessData();
    expect(service.courses().map(c => c.title)).toEqual(['Very', 'Slightly']);
  });

  describe('postponeModule', () => {
    it('should call update with .eq(id) and postponed_until 30 days from now', async () => {
      supabase._mockQueryResponse(null);
      await service.postponeModule('m1');
      expect(supabase.client.from).toHaveBeenCalledWith('modules');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ staleness_postponed_until: expect.any(String) }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'm1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'fail' });
      await expect(service.postponeModule('m1')).rejects.toThrow('fail');
    });
  });

  describe('postponeAllStaleModules', () => {
    it('should call update with .in(ids) for stale modules only', async () => {
      mockRpc([{
        course_id: 'c1', title: 'C', threshold_days: 90,
        modules: [
          { id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 120, is_stale: true, days_overdue: 30, postponed_until: null, is_postponed: false },
          { id: 'm2', title: 'B', module_type: 'video', updated_at: now, days_since_update: 200, is_stale: true, days_overdue: 110, postponed_until: null, is_postponed: false },
          { id: 'm3', title: 'C', module_type: 'video', updated_at: now, days_since_update: 50, is_stale: false, days_overdue: null, postponed_until: null, is_postponed: false },
        ],
      }]);
      await service.loadStalenessData();

      supabase._mockQueryResponse(null);
      await service.postponeAllStaleModules('c1');

      expect(supabase._mockQueryBuilder.in).toHaveBeenCalledWith('id', expect.arrayContaining(['m1', 'm2']));
      const callArgs = (supabase._mockQueryBuilder.in.mock.calls[0]?.[1]) as string[];
      expect(callArgs).not.toContain('m3');
    });

    it('should no-op when no stale modules', async () => {
      mockRpc([{
        course_id: 'c1', title: 'C', threshold_days: 90,
        modules: [{ id: 'm1', title: 'A', module_type: 'video', updated_at: now, days_since_update: 30, is_stale: false, days_overdue: null, postponed_until: null, is_postponed: false }],
      }]);
      await service.loadStalenessData();
      await service.postponeAllStaleModules('c1');
      expect(supabase._mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should throw when course not loaded', async () => {
      await expect(service.postponeAllStaleModules('missing')).rejects.toThrow('Course not found');
    });
  });
});
