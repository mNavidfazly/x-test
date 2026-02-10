import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { CourseWithProgress, CourseDetail, ModuleProgress, EnrollmentType, ModuleType } from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #courses = signal<CourseWithProgress[]>([]);
  #courseDetail = signal<CourseDetail | null>(null);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly courseDetail = this.#courseDetail.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadCourses() {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      const [coursesRes, modulesRes, progressRes, enrollmentsRes] = await Promise.all([
        client.from('courses').select('id, title, description, thumbnail_url, enrollment_type').order('title'),
        client.from('modules').select('id, course_id'),
        client.from('user_progress').select('module_id, course_id, status, updated_at').eq('user_id', userId),
        client.from('course_enrollments').select('course_id').eq('user_id', userId),
      ]);

      const firstError = [coursesRes, modulesRes, progressRes, enrollmentsRes].find(r => r.error);
      if (firstError?.error) throw firstError.error;

      const courses = coursesRes.data ?? [];
      const modules = modulesRes.data ?? [];
      const progress = progressRes.data ?? [];
      const enrollments = enrollmentsRes.data ?? [];

      const enrolledCourseIds = new Set(enrollments.map((e: { course_id: string }) => e.course_id));

      const moduleCountByCourse = new Map<string, number>();
      for (const m of modules) {
        const cid = (m as { course_id: string }).course_id;
        moduleCountByCourse.set(cid, (moduleCountByCourse.get(cid) ?? 0) + 1);
      }

      const completedByCourse = new Map<string, number>();
      const lastActivityByCourse = new Map<string, string>();
      for (const p of progress) {
        const rec = p as { course_id: string; status: string; updated_at: string };
        if (rec.status === 'completed') {
          completedByCourse.set(rec.course_id, (completedByCourse.get(rec.course_id) ?? 0) + 1);
        }
        const prev = lastActivityByCourse.get(rec.course_id);
        if (!prev || rec.updated_at > prev) {
          lastActivityByCourse.set(rec.course_id, rec.updated_at);
        }
      }

      const result: CourseWithProgress[] = courses.map((c: { id: string; title: string; description: string | null; thumbnail_url: string | null; enrollment_type: string }) => {
        const moduleCount = moduleCountByCourse.get(c.id) ?? 0;
        const completedModules = completedByCourse.get(c.id) ?? 0;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          thumbnail_url: c.thumbnail_url,
          enrollment_type: c.enrollment_type as EnrollmentType,
          moduleCount,
          completedModules,
          progressPercent: moduleCount > 0 ? Math.round((completedModules / moduleCount) * 100) : 0,
          isEnrolled: enrolledCourseIds.has(c.id),
          lastActivity: lastActivityByCourse.get(c.id) ?? null,
        };
      });

      this.#courses.set(result);
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load courses'));
    } finally {
      this.#loading.set(false);
    }
  }

  async loadCourseDetail(courseId: string) {
    this.#loading.set(true);
    this.#error.set('');
    this.#courseDetail.set(null);

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      const [courseRes, progressRes] = await Promise.all([
        client
          .from('courses')
          .select('id, title, description, thumbnail_url, enrollment_type, lectures(id, title, description, sort_order, modules(id, title, module_type, sort_order))')
          .eq('id', courseId)
          .order('sort_order', { referencedTable: 'lectures' })
          .order('sort_order', { referencedTable: 'lectures.modules' })
          .single(),
        client
          .from('user_progress')
          .select('module_id, status, completed_at')
          .eq('course_id', courseId)
          .eq('user_id', userId),
      ]);

      if (courseRes.error) throw courseRes.error;
      if (progressRes.error) throw progressRes.error;

      const course = courseRes.data as {
        id: string;
        title: string;
        description: string | null;
        thumbnail_url: string | null;
        enrollment_type: string;
        lectures: {
          id: string;
          title: string;
          description: string | null;
          sort_order: number;
          modules: { id: string; title: string; module_type: string; sort_order: number }[];
        }[];
      };

      const progressMap: Record<string, ModuleProgress> = {};
      for (const p of (progressRes.data ?? [])) {
        const rec = p as { module_id: string; status: string; completed_at: string | null };
        progressMap[rec.module_id] = { status: rec.status as ModuleProgress['status'], completed_at: rec.completed_at };
      }

      this.#courseDetail.set({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        enrollment_type: course.enrollment_type as EnrollmentType,
        lectures: (course.lectures ?? []).map(l => ({
          ...l,
          modules: l.modules.map(m => ({ ...m, module_type: m.module_type as ModuleType })),
        })),
        progressMap,
      });
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load course'));
    } finally {
      this.#loading.set(false);
    }
  }

  #extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
    return fallback;
  }
}
