import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { extractErrorMessage } from '../utils/error.utils';
import { ContentCourse, ContentLecture, ContentModule } from '../models/content-management.model';
import { ModuleType } from '../models/course.model';

interface RpcModule {
  id: string;
  title: string;
  module_type: string;
  sort_order: number;
  estimated_duration_minutes: number;
  updated_at: string;
  days_since_update: number;
  is_stale: boolean;
  is_postponed: boolean;
  postponed_until: string | null;
}

interface RpcLecture {
  id: string;
  title: string;
  sort_order: number;
  modules: RpcModule[];
}

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
      // Single RPC replaces deeply-nested embed (courses → lectures → modules
      // + tenant_courses(count)). Embedded children counted against PostgREST
      // 1000-row cap per parent — risky as content grows. Staleness math now
      // server-side. See migration 00058.
      const { data, error } = await this.#supabase.client.rpc('get_content_overview');
      if (error) throw error;

      type RpcRow = {
        course_id: string;
        title: string;
        description: string | null;
        thumbnail_url: string | null;
        enrollment_type: string;
        staleness_threshold_days: number;
        updated_at: string;
        tenant_count: number;
        lecture_count: number;
        total_modules: number;
        modules_by_type: unknown;
        stale_module_count: number;
        postponed_module_count: number;
        last_module_update: string | null;
        total_duration_minutes: number;
        lectures: unknown;
      };
      const rows = (data ?? []) as RpcRow[];
      const courses: ContentCourse[] = rows.map((row: RpcRow) => {
        const lectures: ContentLecture[] = ((row.lectures as unknown as RpcLecture[]) ?? []).map(l => ({
          id: l.id,
          title: l.title,
          sort_order: l.sort_order,
          modules: (l.modules ?? []).map(m => ({
            id: m.id,
            title: m.title,
            module_type: m.module_type as ModuleType,
            sort_order: m.sort_order,
            estimated_duration_minutes: m.estimated_duration_minutes,
            updated_at: m.updated_at,
            daysSinceUpdate: m.days_since_update,
            isStale: m.is_stale,
            isPostponed: m.is_postponed,
            postponedUntil: m.postponed_until,
          } satisfies ContentModule)),
        }));

        const modulesByType = (row.modules_by_type ?? {}) as Partial<Record<ModuleType, number>>;
        const staleModuleCount = row.stale_module_count;
        const postponedModuleCount = row.postponed_module_count;

        return {
          id: row.course_id,
          title: row.title,
          description: row.description,
          thumbnail_url: row.thumbnail_url,
          enrollment_type: row.enrollment_type,
          staleness_threshold_days: row.staleness_threshold_days,
          updated_at: row.updated_at,
          lectures,
          tenantCount: row.tenant_count,
          lectureCount: row.lecture_count,
          totalModules: row.total_modules,
          modulesByType,
          staleModuleCount,
          freshModuleCount: row.total_modules - staleModuleCount - postponedModuleCount,
          postponedModuleCount,
          hasStaleModules: staleModuleCount > 0,
          lastModuleUpdate: row.last_module_update,
          totalDurationMinutes: row.total_duration_minutes,
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
