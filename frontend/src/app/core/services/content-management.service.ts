import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { extractErrorMessage } from '../utils/error.utils';
import { ContentCourse, ContentLecture, ContentModule } from '../models/content-management.model';
import { ModuleType } from '../models/course.model';

interface RawModule {
  id: string;
  title: string;
  module_type: string;
  sort_order: number;
  estimated_duration_minutes: number;
  updated_at: string;
  staleness_postponed_until: string | null;
}

interface RawLecture {
  id: string;
  title: string;
  sort_order: number;
  modules: RawModule[];
}

interface RawCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  enrollment_type: string;
  staleness_threshold_days: number | null;
  updated_at: string;
  lectures: RawLecture[];
  tenant_courses: { count: number }[];
}

const MS_PER_DAY = 86_400_000;

@Injectable({ providedIn: 'root' })
export class ContentManagementService {
  #supabase = inject(SupabaseService);

  #courses = signal<ContentCourse[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadContentOverview(): Promise<void> {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('courses')
        .select(`
          id, title, description, thumbnail_url, enrollment_type,
          staleness_threshold_days, updated_at,
          lectures(id, title, sort_order,
            modules(id, title, module_type, sort_order, estimated_duration_minutes, updated_at, staleness_postponed_until)),
          tenant_courses(count)
        `)
        .order('title')
        .order('sort_order', { referencedTable: 'lectures' })
        .order('sort_order', { referencedTable: 'lectures.modules' });

      if (error) throw error;

      const now = Date.now();

      const courses: ContentCourse[] = ((data ?? []) as unknown as RawCourse[]).map(row => {
        const threshold = row.staleness_threshold_days ?? 180;

        const lectures: ContentLecture[] = (row.lectures ?? []).map(l => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          modules: (l.modules ?? []).map(m => {
            const daysSinceUpdate = Math.floor(
              (now - new Date(m.updated_at).getTime()) / MS_PER_DAY,
            );
            const isPastThreshold = daysSinceUpdate > threshold;
            const isPostponed = m.staleness_postponed_until
              ? new Date(m.staleness_postponed_until).getTime() > now
              : false;
            return {
              id: m.id,
              title: m.title,
              module_type: m.module_type as ModuleType,
              sort_order: m.sort_order,
              estimated_duration_minutes: m.estimated_duration_minutes,
              updated_at: m.updated_at,
              daysSinceUpdate,
              isStale: isPastThreshold && !isPostponed,
              isPostponed,
              postponedUntil: m.staleness_postponed_until,
            } satisfies ContentModule;
          }),
        }));

        const allModules = lectures.flatMap(l => l.modules);
        const modulesByType: Partial<Record<ModuleType, number>> = {};
        for (const m of allModules) {
          modulesByType[m.module_type] = (modulesByType[m.module_type] ?? 0) + 1;
        }

        const staleModuleCount = allModules.filter(m => m.isStale).length;
        const postponedModuleCount = allModules.filter(m => m.isPostponed).length;

        let lastModuleUpdate: string | null = null;
        for (const m of allModules) {
          if (!lastModuleUpdate || m.updated_at > lastModuleUpdate) {
            lastModuleUpdate = m.updated_at;
          }
        }

        return {
          id: row.id,
          title: row.title,
          description: row.description,
          thumbnail_url: row.thumbnail_url,
          enrollment_type: row.enrollment_type,
          staleness_threshold_days: threshold,
          updated_at: row.updated_at,
          lectures,
          tenantCount: row.tenant_courses?.[0]?.count ?? 0,
          lectureCount: lectures.length,
          totalModules: allModules.length,
          modulesByType,
          staleModuleCount,
          freshModuleCount: allModules.length - staleModuleCount - postponedModuleCount,
          postponedModuleCount,
          hasStaleModules: staleModuleCount > 0,
          lastModuleUpdate,
          totalDurationMinutes: allModules.reduce((sum, m) => sum + m.estimated_duration_minutes, 0),
        } as ContentCourse;
      });

      this.#courses.set(courses);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load content overview'));
    } finally {
      this.#loading.set(false);
    }
  }
}
