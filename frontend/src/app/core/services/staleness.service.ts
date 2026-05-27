import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { extractErrorMessage } from '../utils/error.utils';

interface RpcModule {
  id: string;
  title: string;
  module_type: string;
  updated_at: string;
  days_since_update: number;
  is_stale: boolean;
  days_overdue: number | null;
  postponed_until: string | null;
  is_postponed: boolean;
}

export interface StaleModule {
  id: string;
  title: string;
  moduleType: string;
  updatedAt: string;
  daysSinceUpdate: number;
  isStale: boolean;
  daysOverdue: number | null;
  postponedUntil: string | null;
  isPostponed: boolean;
}

export interface StaleCourse {
  id: string;
  title: string;
  thresholdDays: number;
  modules: StaleModule[];
  staleModuleCount: number;
  freshModuleCount: number;
  totalModuleCount: number;
  hasStaleModules: boolean;
  postponedModuleCount: number;
}

@Injectable({ providedIn: 'root' })
export class StalenessService {
  #supabase = inject(SupabaseService);

  #courses = signal<StaleCourse[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadStalenessData(): Promise<void> {
    this.#loading.set(true);
    this.#error.set('');

    try {
      // Single RPC replaces 2 queries + client-side filter/group/staleness math.
      // Permission gating and per-module staleness flags computed server-side.
      // See migration 00057.
      const { data, error } = await this.#supabase.client.rpc('get_staleness_data');
      if (error) throw error;

      type RpcRow = { course_id: string; title: string; threshold_days: number; modules: unknown };
      const rows = (data ?? []) as RpcRow[];
      const courses: StaleCourse[] = rows.map((row: RpcRow) => {
        const rpcModules = (row.modules as unknown as RpcModule[]) ?? [];

        const modules: StaleModule[] = rpcModules.map(m => ({
          id: m.id,
          title: m.title,
          moduleType: m.module_type,
          updatedAt: m.updated_at,
          daysSinceUpdate: m.days_since_update,
          isStale: m.is_stale,
          daysOverdue: m.days_overdue,
          postponedUntil: m.postponed_until,
          isPostponed: m.is_postponed,
        }));

        // Sort modules: stale first (by daysOverdue desc), then postponed, then fresh (by daysSinceUpdate desc)
        modules.sort((a, b) => {
          if (a.isStale && !b.isStale) return -1;
          if (!a.isStale && b.isStale) return 1;
          if (a.isStale && b.isStale) return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
          if (a.isPostponed && !b.isPostponed) return -1;
          if (!a.isPostponed && b.isPostponed) return 1;
          return b.daysSinceUpdate - a.daysSinceUpdate;
        });

        const staleModuleCount = modules.filter(m => m.isStale).length;
        const postponedModuleCount = modules.filter(m => m.isPostponed).length;

        return {
          id: row.course_id,
          title: row.title,
          thresholdDays: row.threshold_days,
          modules,
          staleModuleCount,
          freshModuleCount: modules.length - staleModuleCount - postponedModuleCount,
          totalModuleCount: modules.length,
          hasStaleModules: staleModuleCount > 0,
          postponedModuleCount,
        };
      });

      // Sort courses: has stale modules first (by max daysOverdue desc), then has postponed, then all-fresh, then no-modules
      courses.sort((a, b) => {
        if (a.hasStaleModules && !b.hasStaleModules) return -1;
        if (!a.hasStaleModules && b.hasStaleModules) return 1;
        if (a.hasStaleModules && b.hasStaleModules) {
          const aMax = Math.max(...a.modules.filter(m => m.isStale).map(m => m.daysOverdue ?? 0));
          const bMax = Math.max(...b.modules.filter(m => m.isStale).map(m => m.daysOverdue ?? 0));
          return bMax - aMax;
        }
        // Both no stale: courses with postponed before courses without
        if (a.postponedModuleCount > 0 && b.postponedModuleCount === 0) return -1;
        if (a.postponedModuleCount === 0 && b.postponedModuleCount > 0) return 1;
        // Both no stale, no postponed: courses with modules before courses without
        if (a.totalModuleCount > 0 && b.totalModuleCount === 0) return -1;
        if (a.totalModuleCount === 0 && b.totalModuleCount > 0) return 1;
        return 0;
      });

      this.#courses.set(courses);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load staleness data'));
    } finally {
      this.#loading.set(false);
    }
  }

  async postponeModule(moduleId: string, days: number = 30): Promise<void> {
    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error } = await this.#supabase.client
      .from('modules')
      .update({ staleness_postponed_until: until } as any)
      .eq('id', moduleId);
    if (error) throw new Error(extractErrorMessage(error, 'Failed to postpone module'));
  }

  async postponeAllStaleModules(courseId: string, days: number = 30): Promise<void> {
    const course = this.#courses().find(c => c.id === courseId);
    if (!course) throw new Error('Course not found');
    const staleIds = course.modules.filter(m => m.isStale).map(m => m.id);
    if (staleIds.length === 0) return;

    const until = new Date(Date.now() + days * 86_400_000).toISOString();
    const { error } = await this.#supabase.client
      .from('modules')
      .update({ staleness_postponed_until: until } as any)
      .in('id', staleIds);
    if (error) throw new Error(extractErrorMessage(error, 'Failed to postpone modules'));
  }
}
