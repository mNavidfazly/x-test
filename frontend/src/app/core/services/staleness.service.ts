import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { extractErrorMessage } from '../utils/error.utils';

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
  #auth = inject(AuthService);

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
      const client = this.#supabase.client;

      const [coursesRes, modulesRes] = await Promise.all([
        client.from('courses').select('id, title, staleness_threshold_days'),
        client.from('modules').select('id, title, module_type, course_id, updated_at, staleness_postponed_until'),
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (modulesRes.error) throw modulesRes.error;

      // Filter to only assigned courses (PA sees all)
      const claims = this.#auth.currentUser()?.claims;
      const isPlatformAdmin = claims?.is_platform_admin === true;
      const lecturerIds = new Set(claims?.lecturer_course_ids ?? []);
      const visibleCourses = (coursesRes.data ?? []).filter(
        (course: any) => isPlatformAdmin || lecturerIds.has(course.id),
      );

      // Group modules by course_id into arrays
      const moduleMap = new Map<string, Array<{ id: string; title: string; module_type: string; updated_at: string; staleness_postponed_until: string | null }>>();
      for (const mod of modulesRes.data ?? []) {
        const arr = moduleMap.get(mod.course_id) ?? [];
        arr.push(mod);
        moduleMap.set(mod.course_id, arr);
      }

      const now = Date.now();
      const MS_PER_DAY = 86_400_000;

      const courses: StaleCourse[] = visibleCourses.map((course: any) => {
        const threshold = course.staleness_threshold_days ?? 180;
        const courseModules = moduleMap.get(course.id) ?? [];

        const modules: StaleModule[] = courseModules.map(mod => {
          const daysSinceUpdate = Math.floor((now - new Date(mod.updated_at).getTime()) / MS_PER_DAY);
          const isPastThreshold = daysSinceUpdate > threshold;
          const isPostponed = mod.staleness_postponed_until
            ? new Date(mod.staleness_postponed_until).getTime() > now
            : false;
          const isStale = isPastThreshold && !isPostponed;
          return {
            id: mod.id,
            title: mod.title,
            moduleType: mod.module_type,
            updatedAt: mod.updated_at,
            daysSinceUpdate,
            isStale,
            daysOverdue: isPastThreshold ? daysSinceUpdate - threshold : null,
            postponedUntil: mod.staleness_postponed_until,
            isPostponed,
          };
        });

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
          id: course.id,
          title: course.title,
          thresholdDays: threshold,
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
