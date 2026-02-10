import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import {
  CourseWithProgress, CourseDetail, ModuleProgress, EnrollmentType, ModuleType,
  ModuleDetail, ModuleViewerData, ModuleContent, ModuleFile, ModuleNavItem,
  CourseFormData, TenantSummary, TenantAssignment, LectureFormData,
} from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #courses = signal<CourseWithProgress[]>([]);
  #courseDetail = signal<CourseDetail | null>(null);
  #moduleViewer = signal<ModuleViewerData | null>(null);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly courseDetail = this.#courseDetail.asReadonly();
  readonly moduleViewer = this.#moduleViewer.asReadonly();
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

  async loadModuleViewer(courseId: string, moduleId: string) {
    this.#loading.set(true);
    this.#error.set('');
    this.#moduleViewer.set(null);

    try {
      const client = this.#supabase.client;
      const userId = this.#auth.currentUser()?.id;

      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      // Step 1: Fetch module metadata
      const moduleRes = await client
        .from('modules')
        .select('id, title, description, module_type, sort_order, lecture_id, course_id')
        .eq('id', moduleId)
        .single();

      if (moduleRes.error) throw moduleRes.error;

      const mod = moduleRes.data as {
        id: string; title: string; description: string | null;
        module_type: string; sort_order: number; lecture_id: string; course_id: string;
      };

      // Step 2: Fetch content + files + progress in parallel
      const contentPromise = this.#fetchModuleContent(client, moduleId, mod.module_type);
      const [filesRes, progressRes] = await Promise.all([
        client.from('module_files').select('id, file_url, file_name, file_size').eq('module_id', moduleId),
        client.from('user_progress').select('status, completed_at').eq('module_id', moduleId).eq('user_id', userId).maybeSingle(),
      ]);
      const content = await contentPromise;

      if (filesRes.error) throw filesRes.error;
      if (progressRes.error) throw progressRes.error;

      // Step 3: Build navigation from courseDetail
      if (!this.#courseDetail() || this.#courseDetail()!.id !== courseId) {
        await this.loadCourseDetail(courseId);
      }
      const navigation = this.#buildNavigation(moduleId);

      const module: ModuleDetail = {
        ...mod,
        module_type: mod.module_type as ModuleType,
      };

      const files: ModuleFile[] = (filesRes.data ?? []).map((f: { id: string; file_url: string; file_name: string; file_size: number | null }) => f);

      const progress: ModuleProgress | null = progressRes.data
        ? { status: (progressRes.data as { status: string }).status as ModuleProgress['status'], completed_at: (progressRes.data as { completed_at: string | null }).completed_at }
        : null;

      this.#moduleViewer.set({ module, content, files, progress, navigation });
    } catch (err) {
      this.#error.set(this.#extractErrorMessage(err, 'Failed to load module'));
    } finally {
      this.#loading.set(false);
    }
  }

  async markModuleComplete(moduleId: string) {
    const viewer = this.#moduleViewer();
    if (!viewer) return;

    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) return;

    const { error } = await this.#supabase.client
      .from('user_progress')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        course_id: viewer.module.course_id,
        lecture_id: viewer.module.lecture_id,
        module_id: moduleId,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        marked_by: 'user' as const,
      }, { onConflict: 'user_id,tenant_id,module_id' });

    if (error) {
      this.#error.set(this.#extractErrorMessage(error, 'Failed to mark complete'));
      return;
    }

    // Update local state
    this.#moduleViewer.set({
      ...viewer,
      progress: { status: 'completed', completed_at: new Date().toISOString() },
    });
  }

  // --- Phase 3A: Course CRUD methods ---

  async createCourse(data: CourseFormData): Promise<{ id: string }> {
    const { data: result, error } = await this.#supabase.client
      .from('courses')
      .insert({
        title: data.title,
        description: data.description,
        thumbnail_url: data.thumbnail_url,
        enrollment_type: data.enrollment_type,
        password_hash: data.password_hash,
        staleness_threshold_days: data.staleness_threshold_days,
      })
      .select('id')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to create course'));
    return { id: result.id };
  }

  async updateCourse(id: string, data: Partial<CourseFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('courses')
      .update(data)
      .eq('id', id);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update course'));
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete course'));
  }

  async loadTenants(): Promise<TenantSummary[]> {
    const { data, error } = await this.#supabase.client
      .from('tenants')
      .select('id, name, domain, is_master')
      .order('name');

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load tenants'));
    return (data ?? []) as TenantSummary[];
  }

  async loadTenantAssignments(courseId: string): Promise<TenantAssignment[]> {
    const { data, error } = await this.#supabase.client
      .from('tenant_courses')
      .select('tenant_id, tenants(name)')
      .eq('course_id', courseId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to load tenant assignments'));
    return (data ?? []).map((row) => ({
      tenant_id: row.tenant_id,
      tenant_name: (row.tenants as unknown as { name: string } | null)?.name ?? '',
    }));
  }

  async assignCourseToTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .insert({ course_id: courseId, tenant_id: tenantId });

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to assign course to tenant'));
  }

  async removeCourseFromTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .delete()
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to remove course from tenant'));
  }

  // --- Phase 3B: Lecture CRUD methods ---

  async createLecture(courseId: string, data: LectureFormData): Promise<{ id: string }> {
    const detail = this.#courseDetail();
    const maxOrder = detail
      ? detail.lectures.reduce((max, l) => Math.max(max, l.sort_order), -1)
      : -1;

    const { data: result, error } = await this.#supabase.client
      .from('lectures')
      .insert({
        course_id: courseId,
        title: data.title,
        description: data.description,
        sort_order: maxOrder + 1,
      })
      .select('id')
      .single();

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to create lecture'));
    return { id: result.id };
  }

  async updateLecture(lectureId: string, data: Partial<LectureFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lectures')
      .update(data)
      .eq('id', lectureId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to update lecture'));
  }

  async deleteLecture(lectureId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lectures')
      .delete()
      .eq('id', lectureId);

    if (error) throw new Error(this.#extractErrorMessage(error, 'Failed to delete lecture'));
  }

  async swapLectureSortOrder(idA: string, orderA: number, idB: string, orderB: number): Promise<void> {
    const resA = await this.#supabase.client
      .from('lectures')
      .update({ sort_order: orderB })
      .eq('id', idA);

    if (resA.error) throw new Error(this.#extractErrorMessage(resA.error, 'Failed to reorder lectures'));

    const resB = await this.#supabase.client
      .from('lectures')
      .update({ sort_order: orderA })
      .eq('id', idB);

    if (resB.error) throw new Error(this.#extractErrorMessage(resB.error, 'Failed to reorder lectures'));
  }

  async #fetchModuleContent(client: SupabaseClient, moduleId: string, moduleType: string): Promise<ModuleContent> {
    switch (moduleType) {
      case 'video': {
        const res = await client.from('module_videos').select('video_url, thumbnail_url, duration').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { video_url: string; thumbnail_url: string | null; duration: number | null };
        return { type: 'video', data: d };
      }
      case 'pdf': {
        const res = await client.from('module_pdfs').select('file_url, file_name, page_count').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { file_url: string; file_name: string; page_count: number | null };
        return { type: 'pdf', data: d };
      }
      case 'markdown': {
        const res = await client.from('module_markdown').select('content').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { content: string };
        return { type: 'markdown', data: d };
      }
      default:
        return { type: moduleType as 'quiz' | 'exam', data: null };
    }
  }

  #buildNavigation(moduleId: string): ModuleViewerData['navigation'] {
    const detail = this.#courseDetail();
    if (!detail) return { prev: null, next: null, current: 1, total: 1 };

    const flatModules: ModuleNavItem[] = [];
    for (const lecture of detail.lectures) {
      for (const mod of lecture.modules) {
        flatModules.push({
          id: mod.id,
          title: mod.title,
          module_type: mod.module_type,
          lectureTitle: lecture.title,
        });
      }
    }

    const idx = flatModules.findIndex(m => m.id === moduleId);
    return {
      prev: idx > 0 ? flatModules[idx - 1] : null,
      next: idx < flatModules.length - 1 ? flatModules[idx + 1] : null,
      current: idx + 1,
      total: flatModules.length,
    };
  }

  #extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
    return fallback;
  }
}
