import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ContentManagementService } from './content-management.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('ContentManagementService', () => {
  let service: ContentManagementService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ContentManagementService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(ContentManagementService);
  });

  const now = new Date().toISOString();

  function mockRpc(rows: unknown[], error: unknown = null) {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
  }

  function makeRpcRow(overrides: Record<string, unknown> = {}) {
    return {
      course_id: 'c1',
      title: 'Test Course',
      description: null,
      thumbnail_url: null,
      enrollment_type: 'open',
      staleness_threshold_days: 180,
      updated_at: now,
      tenant_count: 0,
      lecture_count: 0,
      total_modules: 0,
      modules_by_type: {},
      stale_module_count: 0,
      postponed_module_count: 0,
      last_module_update: null,
      total_duration_minutes: 0,
      lectures: [],
      ...overrides,
    };
  }

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should call get_content_overview RPC', async () => {
    mockRpc([]);
    await service.loadContentOverview();
    expect(supabase.client.rpc).toHaveBeenCalledWith('get_content_overview');
  });

  it('should set loading during fetch', async () => {
    mockRpc([]);
    const promise = service.loadContentOverview();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('should map flat RPC row to ContentCourse with nested lectures/modules', async () => {
    mockRpc([makeRpcRow({
      course_id: 'c1',
      title: 'Intro',
      description: 'Hello',
      thumbnail_url: 'thumb.jpg',
      enrollment_type: 'invite_only',
      staleness_threshold_days: 90,
      tenant_count: 3,
      lecture_count: 2,
      total_modules: 3,
      modules_by_type: { video: 2, quiz: 1 },
      stale_module_count: 1,
      postponed_module_count: 1,
      last_module_update: now,
      total_duration_minutes: 90,
      lectures: [
        {
          id: 'l1', title: 'Lec 1', sort_order: 0,
          modules: [
            { id: 'm1', title: 'V', module_type: 'video', sort_order: 0, estimated_duration_minutes: 30, updated_at: now, days_since_update: 200, is_stale: true, is_postponed: false, postponed_until: null },
            { id: 'm2', title: 'Q', module_type: 'quiz', sort_order: 1, estimated_duration_minutes: 20, updated_at: now, days_since_update: 200, is_stale: false, is_postponed: true, postponed_until: now },
          ],
        },
        {
          id: 'l2', title: 'Lec 2', sort_order: 1,
          modules: [
            { id: 'm3', title: 'V2', module_type: 'video', sort_order: 0, estimated_duration_minutes: 40, updated_at: now, days_since_update: 10, is_stale: false, is_postponed: false, postponed_until: null },
          ],
        },
      ],
    })]);

    await service.loadContentOverview();

    const c = service.courses()[0];
    expect(c.id).toBe('c1');
    expect(c.title).toBe('Intro');
    expect(c.tenantCount).toBe(3);
    expect(c.lectureCount).toBe(2);
    expect(c.totalModules).toBe(3);
    expect(c.modulesByType).toEqual({ video: 2, quiz: 1 });
    expect(c.staleModuleCount).toBe(1);
    expect(c.postponedModuleCount).toBe(1);
    expect(c.freshModuleCount).toBe(1);
    expect(c.hasStaleModules).toBe(true);
    expect(c.totalDurationMinutes).toBe(90);
    expect(c.lectures.length).toBe(2);
    expect(c.lectures[0].modules.length).toBe(2);
    expect(c.lectures[0].modules[0].isStale).toBe(true);
    expect(c.lectures[0].modules[1].isPostponed).toBe(true);
    expect(c.lectures[1].modules[0].isStale).toBe(false);
  });

  it('should compute freshModuleCount correctly', async () => {
    mockRpc([makeRpcRow({
      total_modules: 10,
      stale_module_count: 3,
      postponed_module_count: 2,
    })]);
    await service.loadContentOverview();
    expect(service.courses()[0].freshModuleCount).toBe(5);
  });

  it('should handle empty courses', async () => {
    mockRpc([]);
    await service.loadContentOverview();
    expect(service.courses()).toEqual([]);
    expect(service.error()).toBe('');
  });

  it('should set error on RPC failure', async () => {
    mockRpc(null, { message: 'forbidden' });
    await service.loadContentOverview();
    expect(service.error()).toBe('forbidden');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should handle row with no lectures', async () => {
    mockRpc([makeRpcRow({ lecture_count: 0, lectures: [] })]);
    await service.loadContentOverview();
    expect(service.courses()[0].lectures).toEqual([]);
  });

  it('should preserve order from RPC (server sorts by title)', async () => {
    mockRpc([
      makeRpcRow({ course_id: 'a', title: 'Alpha' }),
      makeRpcRow({ course_id: 'b', title: 'Beta' }),
    ]);
    await service.loadContentOverview();
    expect(service.courses().map(c => c.title)).toEqual(['Alpha', 'Beta']);
  });
});
