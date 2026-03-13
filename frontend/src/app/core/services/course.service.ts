import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { BunnyUploadService } from './bunny-upload.service';
import { PosthogService } from './posthog.service';
import { ActiveTrack } from './audio-player.service';
import { extractErrorMessage } from '../utils/error.utils';
import { isStoragePath } from '../utils/storage.utils';
import { compressImage } from '../utils/image.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';
import { extractStoragePaths } from '../utils/markdown-storage.utils';
import {
  CourseWithProgress, CourseDetail, CourseLecturer, ModuleProgress, EnrollmentType, ModuleType,
  ModuleDetail, ModuleViewerData, ModuleContent, ModuleFile, ModuleNavItem, ModuleVideo,
  CourseFormData, TenantSummary, TenantAssignment, LectureFormData,
  ModuleSavePayload, ModuleContentFormData,
  PdfFormData, ExamFormData, ExamContent, ModulePdf, MarkdownFormData, ModuleMarkdownContent,
  AudioFormData, DownloadFormData, ModuleAudio, ModuleDownload,
  QuizFormData, QuizContent, QuizQuestionType, QuizQuestionFormData,
  ExternalQuizFormData, ExternalQuizContent,
  EnrolledUser, UserProgressSummary, UserProgressRecord, MarkedByType,
  QuizTakingData, QuizTakingQuestion, QuizAttempt, QuizGradeResult, QuizQuestionResult, QuizResults, QuizAnswerMap,
  ExamTakingData, ExamSubmission,
} from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class CourseService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #api = inject(ApiService);
  #bunnyUpload = inject(BunnyUploadService);
  #posthog = inject(PosthogService);

  #courses = signal<CourseWithProgress[]>([]);
  #courseDetail = signal<CourseDetail | null>(null);
  #moduleViewer = signal<ModuleViewerData | null>(null);
  #loading = signal(false);
  #error = signal('');

  // Caching layer: avoid redundant loading on navigation
  #moduleCache = new Map<string, ModuleViewerData>();
  #signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
  #viewerStateCache = new Map<string, { pdfPage?: number }>();
  readonly #MODULE_CACHE_LIMIT = 20;
  readonly #SIGNED_URL_TTL_MS = 50 * 60 * 1000; // 50 minutes

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

      const [coursesRes, modulesRes, progressRes, enrollmentsRes, lecturerRes, lecturesRes] = await Promise.all([
        client.from('courses').select('id, title, description, thumbnail_url, enrollment_type').order('title'),
        client.from('modules').select('id, course_id, lecture_id, title, module_type, sort_order, estimated_duration_minutes, section_title'),
        client.from('user_progress').select('module_id, course_id, status, updated_at').eq('user_id', userId),
        client.from('course_enrollments').select('course_id').eq('user_id', userId),
        client.from('lecturer_course_assignments').select('course_id, user:profiles!user_id(id, full_name, email, avatar_url)'),
        client.from('lectures').select('id, course_id, sort_order, title'),
      ]);

      const firstError = [coursesRes, modulesRes, progressRes, enrollmentsRes, lecturerRes, lecturesRes].find(r => r.error);
      if (firstError?.error) throw firstError.error;

      const courses = coursesRes.data ?? [];
      const modules = modulesRes.data ?? [];
      const progress = progressRes.data ?? [];
      const enrollments = enrollmentsRes.data ?? [];
      const lectures = lecturesRes.data ?? [];

      const enrolledCourseIds = new Set(enrollments.map((e: { course_id: string }) => e.course_id));

      const lecturersByCourse = new Map<string, CourseLecturer[]>();
      for (const row of (lecturerRes.data ?? [])) {
        const r = row as any;
        if (!r.user) continue;
        const list = lecturersByCourse.get(r.course_id) ?? [];
        if (!list.some((l: CourseLecturer) => l.user_id === r.user.id)) {
          list.push({ user_id: r.user.id, full_name: r.user.full_name, email: r.user.email, avatar_url: r.user.avatar_url });
        }
        lecturersByCourse.set(r.course_id, list);
      }

      const moduleCountByCourse = new Map<string, number>();
      const durationByCourse = new Map<string, number>();
      for (const m of modules) {
        const rec = m as { course_id: string; estimated_duration_minutes: number };
        moduleCountByCourse.set(rec.course_id, (moduleCountByCourse.get(rec.course_id) ?? 0) + 1);
        durationByCourse.set(rec.course_id, (durationByCourse.get(rec.course_id) ?? 0) + rec.estimated_duration_minutes);
      }

      const completedByCourse = new Map<string, number>();
      const completedModuleIds = new Map<string, Set<string>>();
      const lastActivityByCourse = new Map<string, string>();
      for (const p of progress) {
        const rec = p as { module_id: string; course_id: string; status: string; updated_at: string };
        if (rec.status === 'completed') {
          completedByCourse.set(rec.course_id, (completedByCourse.get(rec.course_id) ?? 0) + 1);
          const set = completedModuleIds.get(rec.course_id) ?? new Set<string>();
          set.add(rec.module_id);
          completedModuleIds.set(rec.course_id, set);
        }
        const prev = lastActivityByCourse.get(rec.course_id);
        if (!prev || rec.updated_at > prev) {
          lastActivityByCourse.set(rec.course_id, rec.updated_at);
        }
      }

      // Build lecture sort_order + title lookup
      const lectureInfo = new Map<string, { sort_order: number; title: string }>();
      for (const l of lectures) {
        const rec = l as { id: string; sort_order: number; title: string };
        lectureInfo.set(rec.id, { sort_order: rec.sort_order, title: rec.title });
      }

      // Group modules by course, sorted by lecture.sort_order then module.sort_order
      const sortedModulesByCourse = new Map<string, Array<{ id: string; title: string; module_type: string; lecture_id: string; sort_order: number }>>();
      for (const m of modules) {
        const rec = m as { id: string; course_id: string; lecture_id: string; title: string; module_type: string; sort_order: number };
        const list = sortedModulesByCourse.get(rec.course_id) ?? [];
        list.push({ id: rec.id, title: rec.title, module_type: rec.module_type, lecture_id: rec.lecture_id, sort_order: rec.sort_order });
        sortedModulesByCourse.set(rec.course_id, list);
      }
      for (const [, list] of sortedModulesByCourse) {
        list.sort((a, b) => {
          const la = lectureInfo.get(a.lecture_id)?.sort_order ?? 0;
          const lb = lectureInfo.get(b.lecture_id)?.sort_order ?? 0;
          if (la !== lb) return la - lb;
          return a.sort_order - b.sort_order;
        });
      }

      const result: CourseWithProgress[] = courses.map((c: { id: string; title: string; description: string | null; thumbnail_url: string | null; enrollment_type: string }) => {
        const moduleCount = moduleCountByCourse.get(c.id) ?? 0;
        const completedModules = completedByCourse.get(c.id) ?? 0;

        let nextModuleId: string | null = null;
        let nextModuleTitle: string | null = null;
        let nextModuleType: ModuleType | null = null;
        let nextLectureTitle: string | null = null;

        if (enrolledCourseIds.has(c.id) && completedModules < moduleCount) {
          const sorted = sortedModulesByCourse.get(c.id) ?? [];
          const completed = completedModuleIds.get(c.id) ?? new Set<string>();
          const next = sorted.find(m => !completed.has(m.id));
          if (next) {
            nextModuleId = next.id;
            nextModuleTitle = next.title;
            nextModuleType = next.module_type as ModuleType;
            nextLectureTitle = lectureInfo.get(next.lecture_id)?.title ?? null;
          }
        }

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
          totalDurationMinutes: durationByCourse.get(c.id) ?? 0,
          lecturers: lecturersByCourse.get(c.id) ?? [],
          nextModuleId,
          nextModuleTitle,
          nextModuleType,
          nextLectureTitle,
        };
      });

      await this.#resolveThumbnailUrls(result);
      await this.#resolveAvatarUrls(result.flatMap(c => c.lecturers));
      this.#courses.set(result);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load courses'));
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

      const [courseRes, progressRes, enrollmentRes, lecturerRes] = await Promise.all([
        client
          .from('courses')
          .select('id, title, description, thumbnail_url, enrollment_type, lectures(id, title, description, sort_order, modules(id, title, description, module_type, sort_order, estimated_duration_minutes, section_title))')
          .eq('id', courseId)
          .order('sort_order', { referencedTable: 'lectures' })
          .order('sort_order', { referencedTable: 'lectures.modules' })
          .single(),
        client
          .from('user_progress')
          .select('module_id, status, completed_at, notes')
          .eq('course_id', courseId)
          .eq('user_id', userId),
        client
          .from('course_enrollments')
          .select('id')
          .eq('course_id', courseId)
          .eq('user_id', userId)
          .maybeSingle(),
        client
          .from('lecturer_course_assignments')
          .select('user:profiles!user_id(id, full_name, email, avatar_url)')
          .eq('course_id', courseId),
      ]);

      if (courseRes.error) throw courseRes.error;
      if (progressRes.error) throw progressRes.error;
      if (enrollmentRes.error) throw enrollmentRes.error;
      if (lecturerRes.error) throw lecturerRes.error;

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
          modules: { id: string; title: string; module_type: string; sort_order: number; estimated_duration_minutes: number; section_title: string | null }[];
        }[];
      };

      const progressMap: Record<string, ModuleProgress> = {};
      for (const p of (progressRes.data ?? [])) {
        const rec = p as { module_id: string; status: string; completed_at: string | null };
        progressMap[rec.module_id] = { status: rec.status as ModuleProgress['status'], completed_at: rec.completed_at, notes: (rec as any).notes ?? null };
      }

      const resolvedThumbnail = isStoragePath(course.thumbnail_url)
        ? await this.#getSignedThumbnailUrl(course.thumbnail_url!)
        : course.thumbnail_url;

      const lecturers: CourseLecturer[] = (lecturerRes.data ?? [])
        .map((row: any) =>
          row.user ? { user_id: row.user.id, full_name: row.user.full_name, email: row.user.email, avatar_url: row.user.avatar_url } : null)
        .filter((l: CourseLecturer | null): l is CourseLecturer => l !== null);
      await this.#resolveAvatarUrls(lecturers);

      this.#courseDetail.set({
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: resolvedThumbnail,
        rawThumbnailUrl: course.thumbnail_url,
        enrollment_type: course.enrollment_type as EnrollmentType,
        isEnrolled: !!enrollmentRes.data,
        lectures: (course.lectures ?? []).map(l => ({
          ...l,
          modules: l.modules.map((m: any) => ({
            id: m.id as string,
            title: m.title as string,
            description: (m.description as string | null) ?? null,
            module_type: m.module_type as ModuleType,
            sort_order: m.sort_order as number,
            estimated_duration_minutes: m.estimated_duration_minutes as number,
            section_title: (m.section_title as string | null) ?? null,
          })),
        })),
        progressMap,
        lecturers,
      });
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load course'));
    } finally {
      this.#loading.set(false);
    }
  }

  async loadModuleViewer(courseId: string, moduleId: string) {
    this.#error.set('');

    // Stale-while-revalidate: show cached data immediately if available
    const cached = this.#moduleCache.get(moduleId);
    if (cached) {
      this.#moduleViewer.set(cached);
      this.#loading.set(false);
    } else {
      this.#loading.set(true);
      this.#moduleViewer.set(null);
    }

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
        .select('id, title, description, module_type, sort_order, lecture_id, course_id, estimated_duration_minutes, section_title')
        .eq('id', moduleId)
        .single();

      if (moduleRes.error) throw moduleRes.error;

      const mod = moduleRes.data as {
        id: string; title: string; description: string | null;
        module_type: string; sort_order: number; lecture_id: string; course_id: string;
        estimated_duration_minutes: number; section_title: string | null;
      };

      // Step 2: Fetch content + files + progress in parallel
      const contentPromise = this.#fetchModuleContent(client, moduleId, mod.module_type);
      const [filesRes, progressRes] = await Promise.all([
        client.from('module_files').select('id, file_url, file_name, file_size').eq('module_id', moduleId),
        client.from('user_progress').select('status, completed_at, notes').eq('module_id', moduleId).eq('user_id', userId).maybeSingle(),
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

      // module_files store storage paths — resolve to signed URLs for downloading.
      // Files whose storage objects have been deleted will return null and are filtered out.
      const rawFiles = (filesRes.data ?? []) as { id: string; file_url: string; file_name: string; file_size: number | null }[];
      const resolvedFiles = await Promise.all(
        rawFiles.map(async (f) => ({
          ...f,
          file_url: await this.#getSignedUrl(f.file_url),
        })),
      );
      const files: ModuleFile[] = resolvedFiles.filter(
        (f): f is ModuleFile => f.file_url !== null,
      );

      const progress: ModuleProgress | null = progressRes.data
        ? { status: (progressRes.data as { status: string }).status as ModuleProgress['status'], completed_at: (progressRes.data as { completed_at: string | null }).completed_at, notes: (progressRes.data as any).notes ?? null }
        : null;

      const viewerData: ModuleViewerData = { module, content, files, progress, navigation };
      this.#moduleViewer.set(viewerData);

      // Update cache (LRU eviction if over limit)
      this.#moduleCache.set(moduleId, viewerData);
      if (this.#moduleCache.size > this.#MODULE_CACHE_LIMIT) {
        const oldest = this.#moduleCache.keys().next().value;
        if (oldest) this.#moduleCache.delete(oldest);
      }

      this.#posthog.capture('module_viewed', {
        module_id: moduleId,
        module_type: module.module_type,
        course_id: courseId,
      });

      // Auto-track in_progress when a user first views a module
      const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
      if (tenantId) {
        this.#autoTrackInProgress(module, progress, userId, tenantId);
      }
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load module'));
    } finally {
      this.#loading.set(false);
    }
  }

  /**
   * Fire-and-forget: mark module as in_progress if no progress exists yet.
   * Skips non-enrolled users. Uses ignoreDuplicates to avoid overwriting completed status.
   */
  async #autoTrackInProgress(
    module: ModuleDetail,
    existingProgress: ModuleProgress | null,
    userId: string,
    tenantId: string,
  ) {
    if (existingProgress) return; // already has progress (in_progress or completed)

    const detail = this.#courseDetail();
    if (!detail?.isEnrolled) return; // not enrolled

    const inProgress: ModuleProgress = { status: 'in_progress', completed_at: null, notes: null };

    // Update local state immediately
    this.#moduleViewer.update(v => v ? { ...v, progress: inProgress } : v);
    if (detail) {
      const updatedMap = { ...detail.progressMap, [module.id]: inProgress };
      this.#courseDetail.set({ ...detail, progressMap: updatedMap });
    }

    // Fire-and-forget DB upsert (don't overwrite completed)
    this.#supabase.client
      .from('user_progress')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        course_id: module.course_id,
        lecture_id: module.lecture_id,
        module_id: module.id,
        status: 'in_progress' as const,
        marked_by: 'system' as const,
      }, { onConflict: 'user_id,tenant_id,module_id', ignoreDuplicates: true })
      .then(); // fire and forget
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
      this.#error.set(extractErrorMessage(error, 'Failed to mark complete'));
      return;
    }

    this.#posthog.capture('module_completed', { module_id: moduleId });

    // Update local state + cache
    const updated = {
      ...viewer,
      progress: { status: 'completed' as const, completed_at: new Date().toISOString(), notes: viewer.progress?.notes ?? null },
    };
    this.#moduleViewer.set(updated);
    this.#moduleCache.set(moduleId, updated);
  }

  async saveModuleNotes(moduleId: string, notes: string): Promise<void> {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return;

    const { error } = await this.#supabase.client
      .from('user_progress')
      .update({ notes: notes || null })
      .eq('module_id', moduleId)
      .eq('user_id', userId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to save notes'));

    // Update local state + cache
    const viewer = this.#moduleViewer();
    if (viewer?.progress) {
      const updated = { ...viewer, progress: { ...viewer.progress, notes: notes || null } };
      this.#moduleViewer.set(updated);
      this.#moduleCache.set(moduleId, updated);
    }
  }

  // --- Viewer state persistence (survives navigation) ---

  setViewerState(moduleId: string, state: { pdfPage?: number }): void {
    const existing = this.#viewerStateCache.get(moduleId) ?? {};
    this.#viewerStateCache.set(moduleId, { ...existing, ...state });
  }

  getViewerState(moduleId: string): { pdfPage?: number } | undefined {
    return this.#viewerStateCache.get(moduleId);
  }

  // --- Phase 4A: Enrollment methods ---

  async enrollInOpenCourse(courseId: string): Promise<void> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .insert({ user_id: userId, tenant_id: tenantId, course_id: courseId });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to enroll'));
    this.#posthog.capture('course_enrolled', { course_id: courseId, method: 'open' });
    await this.loadCourseDetail(courseId);
  }

  async enrollWithPassword(courseId: string, password: string): Promise<void> {
    const { error } = await this.#supabase.client
      .rpc('enroll_with_password', { p_course_id: courseId, p_password: password });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to enroll'));
    this.#posthog.capture('course_enrolled', { course_id: courseId, method: 'password' });
    await this.loadCourseDetail(courseId);
  }

  async adminEnrollUser(userId: string, tenantId: string, courseId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .insert({ user_id: userId, tenant_id: tenantId, course_id: courseId });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to enroll user'));
  }

  async unenrollUser(enrollmentId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('course_enrollments')
      .delete()
      .eq('id', enrollmentId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to unenroll user'));
  }

  async loadEnrolledUsers(courseId: string): Promise<EnrolledUser[]> {
    const { data, error } = await this.#supabase.client
      .from('course_enrollments')
      .select('id, user_id, enrolled_at, profiles(email, full_name)')
      .eq('course_id', courseId)
      .order('enrolled_at', { ascending: false });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load enrolled users'));

    return (data ?? []).map((row) => {
      const profile = row.profiles as unknown as { email: string; full_name: string | null } | null;
      return {
        id: row.id,
        user_id: row.user_id,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        enrolled_at: row.enrolled_at,
      };
    });
  }

  async lookupUserByEmail(email: string, tenantId: string): Promise<{ id: string; full_name: string | null } | null> {
    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('id, full_name')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw new Error(extractErrorMessage(error, 'Failed to look up user'));
    return data ? { id: data.id, full_name: data.full_name } : null;
  }

  // --- Phase 4B: Progress admin methods ---

  async loadCourseProgressAdmin(courseId: string): Promise<UserProgressSummary[]> {
    const client = this.#supabase.client;

    const [enrollmentsRes, progressRes] = await Promise.all([
      client
        .from('course_enrollments')
        .select('user_id, tenant_id, profiles(email, full_name)')
        .eq('course_id', courseId),
      client
        .from('user_progress')
        .select('user_id, module_id, status, completed_at, marked_by')
        .eq('course_id', courseId),
    ]);

    if (enrollmentsRes.error) throw new Error(extractErrorMessage(enrollmentsRes.error, 'Failed to load enrollments'));
    if (progressRes.error) throw new Error(extractErrorMessage(progressRes.error, 'Failed to load progress'));

    const detail = this.#courseDetail();
    const totalModules = detail
      ? detail.lectures.reduce((sum, l) => sum + l.modules.length, 0)
      : 0;

    const progressByUser = new Map<string, UserProgressRecord[]>();
    for (const p of (progressRes.data ?? [])) {
      const rec = p as { user_id: string; module_id: string; status: string; completed_at: string | null; marked_by: string | null };
      const list = progressByUser.get(rec.user_id) ?? [];
      list.push({
        module_id: rec.module_id,
        status: rec.status as UserProgressRecord['status'],
        completed_at: rec.completed_at,
        marked_by: rec.marked_by as MarkedByType | null,
      });
      progressByUser.set(rec.user_id, list);
    }

    return (enrollmentsRes.data ?? []).map((row) => {
      const profile = row.profiles as unknown as { email: string; full_name: string | null } | null;
      const records = progressByUser.get(row.user_id) ?? [];
      const modules: Record<string, UserProgressRecord> = {};
      let completed = 0;
      for (const r of records) {
        modules[r.module_id] = r;
        if (r.status === 'completed') completed++;
      }
      return {
        user_id: row.user_id,
        tenant_id: row.tenant_id,
        email: profile?.email ?? '',
        full_name: profile?.full_name ?? null,
        completed,
        total: totalModules,
        modules,
      };
    });
  }

  async adminMarkModuleComplete(userId: string, tenantId: string, courseId: string, lectureId: string, moduleId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('user_progress')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        course_id: courseId,
        lecture_id: lectureId,
        module_id: moduleId,
        status: 'completed' as const,
        completed_at: new Date().toISOString(),
        marked_by: 'admin' as const,
      }, { onConflict: 'user_id,tenant_id,module_id' });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to mark module complete'));
  }

  async adminResetModuleProgress(userId: string, moduleId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('user_progress')
      .update({
        status: 'not_started' as const,
        completed_at: null,
        marked_by: null,
        notes: 'Reset by admin',
      })
      .eq('user_id', userId)
      .eq('module_id', moduleId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to reset module progress'));
  }

  // --- Phase 5A: Quiz Taking methods ---

  async loadQuizForTaking(moduleId: string): Promise<{ quiz: QuizTakingData; pastAttempts: QuizAttempt[] } | null> {
    const client = this.#supabase.client;
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return null;

    // 1. Quiz metadata (from quizzes table — no answers here)
    const { data: quiz, error: quizErr } = await client
      .from('quizzes')
      .select('id, title, description, time_limit, passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers')
      .eq('module_id', moduleId)
      .maybeSingle();

    if (quizErr || !quiz) return null;

    // 2. Questions from SAFE view (no correct_answer)
    const { data: questions, error: qErr } = await client
      .from('quiz_questions_safe')
      .select('id, question_text, question_type, points, sort_order')
      .eq('quiz_id', quiz.id)
      .order('sort_order');

    if (qErr || !questions) return null;

    // 3. Options from SAFE view (no is_correct) — batch query for all questions
    const questionIds = questions.map((q: { id: string }) => q.id);
    const { data: allOptions, error: oErr } = await client
      .from('quiz_question_options_safe')
      .select('id, question_id, option_text, sort_order')
      .in('question_id', questionIds)
      .order('sort_order');

    if (oErr) return null;

    // 4. For matching questions, fetch terms via SECURITY DEFINER RPC
    //    (learners can't read base quiz_questions table directly — RLS blocks it)
    const matchingQuestions = questions.filter((q: { question_type: string }) => q.question_type === 'matching');
    let matchingTerms: Record<string, { left: string[]; right: string[] }> = {};
    if (matchingQuestions.length > 0) {
      const matchingIds = matchingQuestions.map((q: { id: string }) => q.id);
      const { data: termsData } = await client
        .rpc('get_matching_question_terms', { p_question_ids: matchingIds });

      if (termsData && typeof termsData === 'object') {
        for (const [qId, terms] of Object.entries(termsData as Record<string, { left: string[]; right: string[] }>)) {
          const left = terms.left;
          const right = [...terms.right];
          // Shuffle right side using Fisher-Yates
          for (let i = right.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [right[i], right[j]] = [right[j], right[i]];
          }
          matchingTerms[qId] = { left, right };
        }
      }
    }

    // 5. Assemble questions with options
    const optionsByQuestion = new Map<string, { id: string; option_text: string; sort_order: number }[]>();
    for (const opt of (allOptions ?? [])) {
      const list = optionsByQuestion.get(opt.question_id) ?? [];
      list.push({ id: opt.id, option_text: opt.option_text, sort_order: opt.sort_order });
      optionsByQuestion.set(opt.question_id, list);
    }

    let assembledQuestions: QuizTakingQuestion[] = questions.map((q: { id: string; question_text: string; question_type: QuizQuestionType; points: number; sort_order: number }) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      points: q.points,
      sort_order: q.sort_order,
      options: optionsByQuestion.get(q.id) ?? [],
      ...(matchingTerms[q.id] ? { matchingLeft: matchingTerms[q.id].left, matchingRight: matchingTerms[q.id].right } : {}),
    }));

    // 6. Randomize if enabled
    if (quiz.randomize_questions) {
      for (let i = assembledQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [assembledQuestions[i], assembledQuestions[j]] = [assembledQuestions[j], assembledQuestions[i]];
      }
    }
    if (quiz.randomize_answers) {
      for (const q of assembledQuestions) {
        for (let i = q.options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q.options[i], q.options[j]] = [q.options[j], q.options[i]];
        }
      }
    }

    // 7. Past attempts
    const { data: pastAttempts } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('quiz_id', quiz.id)
      .eq('user_id', userId)
      .order('attempt_number', { ascending: false });

    return {
      quiz: { ...quiz, questions: assembledQuestions } as QuizTakingData,
      pastAttempts: (pastAttempts ?? []) as QuizAttempt[],
    };
  }

  async startQuizAttempt(quizId: string): Promise<QuizAttempt> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = this.#auth.currentUser()?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    // Check for existing unsubmitted attempt
    const { data: existing } = await this.#supabase.client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('quiz_id', quizId)
      .eq('user_id', userId)
      .is('submitted_at', null)
      .maybeSingle();

    if (existing) return existing as QuizAttempt;

    // Count total attempts
    const { count } = await this.#supabase.client
      .from('quiz_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('quiz_id', quizId)
      .eq('user_id', userId);

    const attemptNumber = (count ?? 0) + 1;

    const { data, error } = await this.#supabase.client
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        quiz_id: quizId,
        attempt_number: attemptNumber,
      })
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .single();

    if (error) throw new Error(extractErrorMessage(error, 'Failed to start quiz'));
    this.#posthog.capture('quiz_started', { quiz_id: quizId, attempt_number: attemptNumber });
    return data as QuizAttempt;
  }

  async submitQuizAttempt(attemptId: string, answers: QuizAnswerMap): Promise<QuizResults> {
    const client = this.#supabase.client;

    // 1. Batch insert answers
    const answerRows = Object.entries(answers).map(([questionId, userAnswer]) => ({
      attempt_id: attemptId,
      question_id: questionId,
      user_answer: userAnswer || null,
    }));

    if (answerRows.length > 0) {
      const { error: ansErr } = await client
        .from('quiz_attempt_answers')
        .insert(answerRows);
      if (ansErr) throw new Error(extractErrorMessage(ansErr, 'Failed to save answers'));
    }

    // 2. Mark as submitted
    const { error: subErr } = await client
      .from('quiz_attempts')
      .update({ submitted_at: new Date().toISOString() })
      .eq('id', attemptId);
    if (subErr) throw new Error(extractErrorMessage(subErr, 'Failed to submit quiz'));

    // 3. Grade via RPC
    const { data: gradeData, error: gradeErr } = await client
      .rpc('grade_quiz_attempt', { p_attempt_id: attemptId });
    if (gradeErr) throw new Error(extractErrorMessage(gradeErr, 'Failed to grade quiz'));

    const grade = gradeData as QuizGradeResult;

    // 4. Get per-question results via RPC
    const { data: resultRows, error: resErr } = await client
      .rpc('get_quiz_results', { p_attempt_id: attemptId });
    if (resErr) throw new Error(extractErrorMessage(resErr, 'Failed to load results'));

    const questions = (resultRows ?? []) as QuizQuestionResult[];

    // 5. Fetch updated attempt
    const { data: attempt } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('id', attemptId)
      .single();

    this.#posthog.capture('quiz_submitted', {
      quiz_id: (attempt as QuizAttempt)?.quiz_id,
      score: grade.score,
      passed: grade.passed,
      attempt_number: (attempt as QuizAttempt)?.attempt_number,
    });
    return { attempt: attempt as QuizAttempt, grade, questions };
  }

  async getQuizAttemptResults(attemptId: string): Promise<QuizResults> {
    const client = this.#supabase.client;

    // Fetch attempt
    const { data: attempt, error: aErr } = await client
      .from('quiz_attempts')
      .select('id, quiz_id, attempt_number, started_at, submitted_at, score, passed')
      .eq('id', attemptId)
      .single();
    if (aErr) throw new Error(extractErrorMessage(aErr, 'Failed to load attempt'));

    // Get per-question results
    const { data: resultRows, error: resErr } = await client
      .rpc('get_quiz_results', { p_attempt_id: attemptId });
    if (resErr) throw new Error(extractErrorMessage(resErr, 'Failed to load results'));

    const questions = (resultRows ?? []) as QuizQuestionResult[];
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const a = attempt as QuizAttempt;
    const grade: QuizGradeResult = {
      score: a.score ?? 0,
      passed: a.passed ?? false,
      earned_points: totalPoints > 0 ? Math.round(((a.score ?? 0) / 100) * totalPoints * 100) / 100 : 0,
      total_points: totalPoints,
    };

    return { attempt: a, grade, questions };
  }

  /**
   * Fire-and-forget AI check for text answers that failed exact match.
   * Returns updated QuizResults if AI made corrections, null otherwise.
   */
  async checkAiGrading(attemptId: string): Promise<QuizResults | null> {
    try {
      const res = await firstValueFrom(
        this.#api.post<{ score: number; passed: boolean; earned_points: number; total_points: number; ai_corrections: number }>(
          '/quiz-grading/ai-check',
          { attempt_id: attemptId }
        )
      );

      if (res.ai_corrections > 0) {
        // Re-fetch results to get updated ai_accepted flags
        return await this.getQuizAttemptResults(attemptId);
      }
      return null;
    } catch {
      // Silently ignore — exact-match score stands
      return null;
    }
  }

  // --- Phase 5C: Exam Taking methods ---

  async loadExamForTaking(moduleId: string): Promise<{ exam: ExamTakingData; submission: ExamSubmission | null } | null> {
    const client = this.#supabase.client;
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return null;

    const { data: exam, error: examErr } = await client
      .from('exams')
      .select('id, title, description, duration_minutes, passing_score, max_file_size, allowed_file_types, exam_file_url')
      .eq('module_id', moduleId)
      .maybeSingle();

    if (examErr || !exam) return null;

    if (exam.exam_file_url) {
      exam.exam_file_url = await this.#getSignedUrl(exam.exam_file_url as string);
    }

    const { data: sub, error: subErr } = await client
      .from('exam_submissions')
      .select('id, exam_id, file_url, submitted_at, deadline, score, feedback, graded_by, graded_at')
      .eq('exam_id', exam.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (subErr) return null;

    let submission: ExamSubmission | null = null;
    if (sub) {
      const signedUrl = await this.#getSignedUrlFromBucket('exam-submissions', sub.file_url as string);
      submission = { ...sub, file_url: signedUrl ?? '' } as ExamSubmission;
    }

    return { exam: exam as ExamTakingData, submission };
  }

  async submitExamSubmission(
    examId: string,
    courseId: string,
    file: File,
    startedAt: string,
    durationMinutes: number,
  ): Promise<ExamSubmission> {
    const userId = this.#auth.currentUser()?.id;
    const tenantId = (this.#auth.currentUser() as { id: string; claims?: { tenant_id?: string } })
      ?.claims?.tenant_id;
    if (!userId || !tenantId) throw new Error('Not authenticated');

    const timestamp = Date.now();
    const storagePath = `${courseId}/${userId}/${timestamp}-${file.name}`;

    const { error: uploadErr } = await this.#supabase.client.storage
      .from('exam-submissions')
      .upload(storagePath, file);

    if (uploadErr) throw new Error(`Failed to upload submission: ${uploadErr.message}`);

    const deadline = new Date(new Date(startedAt).getTime() + durationMinutes * 60 * 1000).toISOString();

    const { data, error } = await this.#supabase.client
      .from('exam_submissions')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        exam_id: examId,
        course_id: courseId,
        file_url: storagePath,
        deadline,
      })
      .select('id, exam_id, file_url, submitted_at, deadline, score, feedback, graded_by, graded_at')
      .single();

    if (error) {
      await this.#supabase.client.storage.from('exam-submissions').remove([storagePath]);
      throw new Error(extractErrorMessage(error, 'Failed to submit exam'));
    }

    this.#posthog.capture('exam_submitted', { exam_id: examId, course_id: courseId });
    const signedUrl = await this.#getSignedUrlFromBucket('exam-submissions', storagePath);
    return { ...data, file_url: signedUrl ?? '' } as ExamSubmission;
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

    if (error) throw new Error(extractErrorMessage(error, 'Failed to create course'));
    return { id: result.id };
  }

  async updateCourse(id: string, data: Partial<CourseFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('courses')
      .update(data)
      .eq('id', id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update course'));
  }

  async deleteCourse(id: string): Promise<void> {
    // Collect storage paths and Bunny video IDs BEFORE delete (CASCADE will remove DB rows)
    const [storagePaths, bunnyVideoIds] = await Promise.all([
      this.#listCourseStoragePaths(id),
      this.#collectCourseBunnyVideoIds(id),
    ]);

    const { error } = await this.#supabase.client
      .from('courses')
      .delete()
      .eq('id', id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete course'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async loadTenants(): Promise<TenantSummary[]> {
    const { data, error } = await this.#supabase.client
      .from('tenants')
      .select('id, name, domain, is_master')
      .order('name');

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load tenants'));
    return (data ?? []) as TenantSummary[];
  }

  async loadTenantAssignments(courseId: string): Promise<TenantAssignment[]> {
    const { data, error } = await this.#supabase.client
      .from('tenant_courses')
      .select('tenant_id, tenants(name)')
      .eq('course_id', courseId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load tenant assignments'));
    return (data ?? []).map((row) => ({
      tenant_id: row.tenant_id,
      tenant_name: (row.tenants as unknown as { name: string } | null)?.name ?? '',
    }));
  }

  async assignCourseToTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .insert({ course_id: courseId, tenant_id: tenantId });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to assign course to tenant'));
  }

  async removeCourseFromTenant(courseId: string, tenantId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .delete()
      .eq('course_id', courseId)
      .eq('tenant_id', tenantId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to remove course from tenant'));
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

    if (error) throw new Error(extractErrorMessage(error, 'Failed to create lecture'));
    return { id: result.id };
  }

  async updateLecture(lectureId: string, data: Partial<LectureFormData>): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lectures')
      .update(data)
      .eq('id', lectureId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update lecture'));
  }

  async deleteLecture(lectureId: string): Promise<void> {
    // Collect storage paths and Bunny video IDs from ALL modules in this lecture before CASCADE
    const { data: modules } = await this.#supabase.client
      .from('modules')
      .select('id')
      .eq('lecture_id', lectureId);

    const storagePaths: string[] = [];
    const bunnyVideoIds: string[] = [];
    if (modules) {
      const results = await Promise.all(
        modules.map(async (m: { id: string }) => ({
          paths: await this.#collectModuleStoragePaths(m.id),
          videos: await this.#collectBunnyVideoIds(m.id),
        })),
      );
      for (const r of results) {
        storagePaths.push(...r.paths);
        bunnyVideoIds.push(...r.videos);
      }
    }

    const { error } = await this.#supabase.client
      .from('lectures')
      .delete()
      .eq('id', lectureId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete lecture'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async swapLectureSortOrder(idA: string, idB: string): Promise<void> {
    const { error } = await this.#supabase.client.rpc('swap_lecture_sort_order', { p_id_a: idA, p_id_b: idB });
    if (error) throw new Error(extractErrorMessage(error, 'Failed to reorder lectures'));
  }

  // --- Phase 3C: Module CRUD methods ---

  async createModule(courseId: string, payload: ModuleSavePayload): Promise<{ id: string }> {
    const detail = this.#courseDetail();
    const lecture = detail?.lectures.find(l => l.id === payload.module.lecture_id);
    const maxOrder = lecture
      ? lecture.modules.reduce((max, m) => Math.max(max, m.sort_order), -1)
      : -1;

    const { data: result, error } = await this.#supabase.client
      .from('modules')
      .insert({
        course_id: courseId,
        lecture_id: payload.module.lecture_id,
        title: payload.module.title,
        description: payload.module.description,
        module_type: payload.module.module_type,
        sort_order: maxOrder + 1,
        estimated_duration_minutes: payload.module.estimated_duration_minutes,
        section_title: payload.module.section_title ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(extractErrorMessage(error, 'Failed to create module'));

    try {
      await this.#insertModuleContent(result.id, payload.content);
    } catch (contentErr) {
      await this.#supabase.client.from('modules').delete().eq('id', result.id);
      throw contentErr;
    }

    return { id: result.id };
  }

  async updateModule(moduleId: string, payload: ModuleSavePayload): Promise<void> {
    const updateData: Record<string, unknown> = {
      title: payload.module.title,
      description: payload.module.description,
      estimated_duration_minutes: payload.module.estimated_duration_minutes,
      section_title: payload.module.section_title ?? null,
    };
    if (payload.significantUpdate) {
      updateData['significant_update_at'] = new Date().toISOString();
    }

    const { error } = await this.#supabase.client
      .from('modules')
      .update(updateData)
      .eq('id', moduleId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update module'));

    await this.#upsertModuleContent(moduleId, payload.content);
  }

  async deleteModule(moduleId: string): Promise<void> {
    // Collect storage paths and Bunny video IDs BEFORE delete (CASCADE will remove subtable rows)
    const [storagePaths, bunnyVideoIds] = await Promise.all([
      this.#collectModuleStoragePaths(moduleId),
      this.#collectBunnyVideoIds(moduleId),
    ]);

    const { error } = await this.#supabase.client
      .from('modules')
      .delete()
      .eq('id', moduleId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete module'));

    await this.#removeStorageFiles(storagePaths);
    this.#cleanupBunnyVideos(bunnyVideoIds);
  }

  async swapModuleSortOrder(idA: string, idB: string): Promise<void> {
    const { error } = await this.#supabase.client.rpc('swap_module_sort_order', { p_id_a: idA, p_id_b: idB });
    if (error) throw new Error(extractErrorMessage(error, 'Failed to reorder modules'));
  }

  // --- Module files methods ---

  async loadModuleFiles(moduleId: string): Promise<ModuleFile[]> {
    const { data, error } = await this.#supabase.client
      .from('module_files')
      .select('id, file_url, file_name, file_size')
      .eq('module_id', moduleId)
      .order('file_name', { ascending: true });
    if (error) throw new Error(extractErrorMessage(error, 'Failed to load module files'));
    return (data ?? []) as ModuleFile[];
  }

  async addModuleFile(moduleId: string, file: { file_url: string; file_name: string; file_size: number | null }): Promise<void> {
    const { error } = await this.#supabase.client
      .from('module_files')
      .insert({ module_id: moduleId, ...file });
    if (error) throw new Error(extractErrorMessage(error, 'Failed to add module file'));
  }

  async deleteModuleFile(fileId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('module_files')
      .delete()
      .eq('id', fileId);
    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete module file'));
  }

  async loadModuleForEdit(moduleId: string): Promise<{ module: ModuleDetail; content: ModuleContentFormData }> {
    const client = this.#supabase.client;

    const moduleRes = await client
      .from('modules')
      .select('id, title, description, module_type, sort_order, lecture_id, course_id, estimated_duration_minutes, section_title')
      .eq('id', moduleId)
      .single();

    if (moduleRes.error) throw new Error(extractErrorMessage(moduleRes.error, 'Failed to load module'));

    const mod = moduleRes.data as {
      id: string; title: string; description: string | null;
      module_type: string; sort_order: number; lecture_id: string; course_id: string;
      estimated_duration_minutes: number; section_title: string | null;
    };

    const module: ModuleDetail = { ...mod, module_type: mod.module_type as ModuleType };
    const viewerContent = await this.#fetchModuleContent(client, moduleId, mod.module_type);
    const content = this.#contentToFormData(viewerContent);

    return { module, content };
  }

  async #insertModuleContent(moduleId: string, content: ModuleContentFormData): Promise<void> {
    switch (content.type) {
      case 'video': {
        if (!content.data) break;
        const { error } = await this.#supabase.client
          .from('module_videos')
          .insert({
            module_id: moduleId,
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save video content'));
        break;
      }
      case 'pdf': {
        if (!content.data) break;
        const d = content.data as PdfFormData;
        const { error } = await this.#supabase.client
          .from('module_pdfs')
          .insert({ module_id: moduleId, file_url: d.file_url, file_name: d.file_name, page_count: d.page_count });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save PDF content'));
        break;
      }
      case 'audio': {
        if (!content.data) break;
        const d = content.data as AudioFormData;
        const { error } = await this.#supabase.client
          .from('module_audio')
          .insert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            file_size: d.file_size,
            duration_seconds: d.duration_seconds,
            mime_type: d.mime_type,
          });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save audio content'));
        break;
      }
      case 'download': {
        if (!content.data) break;
        const d = content.data as DownloadFormData;
        const { error } = await this.#supabase.client
          .from('module_downloads')
          .insert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            file_size: d.file_size,
          });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save download content'));
        break;
      }
      case 'exam': {
        if (!content.data) break;
        const d = content.data as ExamFormData;
        const { error } = await this.#supabase.client
          .from('exams')
          .insert({
            module_id: moduleId,
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save exam content'));
        break;
      }
      case 'markdown': {
        if (!content.data) break;
        const d = content.data as MarkdownFormData;
        const { error } = await this.#supabase.client
          .from('module_markdown')
          .insert({ module_id: moduleId, content: d.content });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save markdown content'));
        break;
      }
      case 'quiz': {
        if (!content.data) break;
        const d = content.data as QuizFormData;
        const { data: quizRow, error: quizErr } = await this.#supabase.client
          .from('quizzes')
          .insert({
            module_id: moduleId,
            title: d.title, description: d.description,
            time_limit: d.time_limit, passing_score: d.passing_score,
            max_attempts: d.max_attempts, show_correct_answers: d.show_correct_answers,
            randomize_questions: d.randomize_questions, randomize_answers: d.randomize_answers,
          })
          .select('id').single();
        if (quizErr) throw new Error(extractErrorMessage(quizErr, 'Failed to save quiz'));
        await this.#insertQuizQuestions(quizRow.id, d.questions);
        break;
      }
      case 'external_quiz': {
        if (!content.data) break;
        const d = content.data as ExternalQuizFormData;
        const { error } = await this.#supabase.client
          .from('external_quiz_references')
          .insert({
            module_id: moduleId,
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to save external quiz reference'));
        break;
      }
      default:
        break;
    }
  }

  async #upsertModuleContent(moduleId: string, content: ModuleContentFormData): Promise<void> {
    switch (content.type) {
      case 'video': {
        if (!content.data) break;
        const { error } = await this.#supabase.client
          .from('module_videos')
          .upsert({
            module_id: moduleId,
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update video content'));
        break;
      }
      case 'pdf': {
        if (!content.data) break;
        const d = content.data as PdfFormData;
        const { error } = await this.#supabase.client
          .from('module_pdfs')
          .upsert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            page_count: d.page_count,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update PDF content'));
        break;
      }
      case 'audio': {
        if (!content.data) break;
        const d = content.data as AudioFormData;
        const { error } = await this.#supabase.client
          .from('module_audio')
          .upsert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            file_size: d.file_size,
            duration_seconds: d.duration_seconds,
            mime_type: d.mime_type,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update audio content'));
        break;
      }
      case 'download': {
        if (!content.data) break;
        const d = content.data as DownloadFormData;
        const { error } = await this.#supabase.client
          .from('module_downloads')
          .upsert({
            module_id: moduleId,
            file_url: d.file_url,
            file_name: d.file_name,
            file_size: d.file_size,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update download content'));
        break;
      }
      case 'exam': {
        if (!content.data) break;
        const d = content.data as ExamFormData;
        const { error } = await this.#supabase.client
          .from('exams')
          .upsert({
            module_id: moduleId,
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update exam content'));
        break;
      }
      case 'markdown': {
        if (!content.data) break;
        const d = content.data as MarkdownFormData;
        const { error } = await this.#supabase.client
          .from('module_markdown')
          .upsert({ module_id: moduleId, content: d.content }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update markdown content'));
        break;
      }
      case 'quiz': {
        if (!content.data) break;
        const d = content.data as QuizFormData;
        const { data: quizRow, error: quizErr } = await this.#supabase.client
          .from('quizzes')
          .upsert({
            module_id: moduleId,
            title: d.title, description: d.description,
            time_limit: d.time_limit, passing_score: d.passing_score,
            max_attempts: d.max_attempts, show_correct_answers: d.show_correct_answers,
            randomize_questions: d.randomize_questions, randomize_answers: d.randomize_answers,
          }, { onConflict: 'module_id' })
          .select('id').single();
        if (quizErr) throw new Error(extractErrorMessage(quizErr, 'Failed to update quiz'));
        // Delete existing questions (CASCADE deletes options)
        await this.#supabase.client.from('quiz_questions').delete().eq('quiz_id', quizRow.id);
        // Re-insert all questions + options
        await this.#insertQuizQuestions(quizRow.id, d.questions);
        break;
      }
      case 'external_quiz': {
        if (!content.data) break;
        const d = content.data as ExternalQuizFormData;
        const { error } = await this.#supabase.client
          .from('external_quiz_references')
          .upsert({
            module_id: moduleId,
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          }, { onConflict: 'module_id' });
        if (error) throw new Error(extractErrorMessage(error, 'Failed to update external quiz reference'));
        break;
      }
      default:
        break;
    }
  }

  #contentToFormData(content: ModuleContent): ModuleContentFormData {
    switch (content.type) {
      case 'video':
        return {
          type: 'video',
          data: {
            bunny_video_id: content.data.bunny_video_id,
            bunny_library_id: content.data.bunny_library_id,
            original_filename: content.data.original_filename,
          },
        };
      case 'pdf': {
        const d = content.data as ModulePdf;
        return {
          type: 'pdf',
          data: { file_url: d.file_url, file_name: d.file_name, page_count: d.page_count },
        };
      }
      case 'audio': {
        const d = content.data as ModuleAudio;
        return {
          type: 'audio',
          data: { file_url: d.file_url, file_name: d.file_name, file_size: d.file_size, duration_seconds: d.duration_seconds, mime_type: d.mime_type },
        };
      }
      case 'download': {
        const d = content.data as ModuleDownload;
        return {
          type: 'download',
          data: { file_url: d.file_url, file_name: d.file_name, file_size: d.file_size },
        };
      }
      case 'exam': {
        const d = content.data as ExamContent;
        return {
          type: 'exam',
          data: {
            title: d.title,
            description: d.description,
            duration_minutes: d.duration_minutes,
            passing_score: d.passing_score,
            max_file_size: d.max_file_size,
            allowed_file_types: d.allowed_file_types,
            exam_file_url: d.exam_file_url,
          },
        };
      }
      case 'markdown': {
        const d = content.data as ModuleMarkdownContent;
        return {
          type: 'markdown',
          data: { content: d.content } as MarkdownFormData,
        };
      }
      case 'quiz': {
        if (!content.data) return { type: 'quiz', data: null };
        const q = content.data as QuizContent;
        return {
          type: 'quiz',
          data: {
            title: q.title,
            description: q.description,
            time_limit: q.time_limit,
            passing_score: q.passing_score,
            max_attempts: q.max_attempts,
            show_correct_answers: q.show_correct_answers,
            randomize_questions: q.randomize_questions,
            randomize_answers: q.randomize_answers,
            questions: q.questions.map(qn => ({
              question_text: qn.question_text,
              question_type: qn.question_type as QuizQuestionType,
              points: qn.points,
              sort_order: qn.sort_order,
              correct_answer: qn.correct_answer,
              explanation: qn.explanation ?? null,
              options: qn.options.map(o => ({
                option_text: o.option_text,
                is_correct: o.is_correct,
                sort_order: o.sort_order,
              })),
            })),
          } as QuizFormData,
        };
      }
      case 'external_quiz': {
        const d = content.data as ExternalQuizContent;
        return {
          type: 'external_quiz',
          data: {
            external_quiz_id: d.external_quiz_id,
            external_quiz_url: d.external_quiz_url,
            passing_score: d.passing_score,
          },
        };
      }
      default:
        return { type: (content as ModuleContent).type, data: null } as ModuleContentFormData;
    }
  }

  async #fetchModuleContent(client: SupabaseClient, moduleId: string, moduleType: string): Promise<ModuleContent> {
    switch (moduleType) {
      case 'video': {
        const res = await client.from('module_videos')
          .select('bunny_video_id, bunny_library_id, encoding_status, duration, thumbnail_url, original_filename')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        return { type: 'video', data: res.data as ModuleVideo };
      }
      case 'pdf': {
        const res = await client.from('module_pdfs').select('file_url, file_name, page_count').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { file_url: string; file_name: string; page_count: number | null };
        // file_url stores a storage path — resolve to a signed URL for viewing.
        // If the file was deleted from storage, set to empty string (viewer shows "File not found").
        const pdfSignedUrl = await this.#getSignedUrl(d.file_url);
        d.file_url = pdfSignedUrl ?? '';
        return { type: 'pdf', data: d };
      }
      case 'audio': {
        const res = await client.from('module_audio')
          .select('file_url, file_name, file_size, duration_seconds, mime_type')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as any;
        const signedUrl = await this.#getSignedUrl(d.file_url);
        d.file_url = signedUrl ?? '';
        return { type: 'audio', data: d };
      }
      case 'download': {
        const res = await client.from('module_downloads')
          .select('file_url, file_name, file_size')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as any;
        const signedUrl = await this.#getSignedUrl(d.file_url);
        d.file_url = signedUrl ?? '';
        return { type: 'download', data: d };
      }
      case 'markdown': {
        const res = await client.from('module_markdown').select('content').eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        const d = res.data as { content: string };
        return { type: 'markdown', data: d };
      }
      case 'exam': {
        const res = await client.from('exams')
          .select('title, description, duration_minutes, passing_score, max_file_size, allowed_file_types, exam_file_url')
          .eq('module_id', moduleId)
          .single();
        if (res.error) throw res.error;
        const d = res.data as ExamContent;
        // exam_file_url is optional — resolve to signed URL if present.
        // If the file was deleted from storage, clear it (exam renders without the file).
        if (d.exam_file_url) {
          d.exam_file_url = await this.#getSignedUrl(d.exam_file_url);
        }
        return { type: 'exam', data: d };
      }
      case 'quiz': {
        const quizRes = await client.from('quizzes')
          .select('id, title, description, time_limit, passing_score, max_attempts, show_correct_answers, randomize_questions, randomize_answers')
          .eq('module_id', moduleId).maybeSingle();
        if (quizRes.error) throw quizRes.error;
        if (!quizRes.data) return { type: 'quiz', data: null };

        const questionsRes = await client.from('quiz_questions')
          .select('id, question_text, question_type, points, sort_order, correct_answer, explanation, quiz_question_options(id, option_text, is_correct, sort_order)')
          .eq('quiz_id', quizRes.data.id)
          .order('sort_order');
        if (questionsRes.error) throw questionsRes.error;

        return {
          type: 'quiz',
          data: {
            ...quizRes.data,
            questions: (questionsRes.data ?? []).map(q => ({
              ...q,
              question_type: q.question_type as QuizQuestionType,
              options: ((q as Record<string, unknown>)['quiz_question_options'] as { id: string; option_text: string; is_correct: boolean; sort_order: number }[] ?? [])
                .sort((a, b) => a.sort_order - b.sort_order),
            })),
          } as QuizContent,
        };
      }
      case 'external_quiz': {
        const res = await client.from('external_quiz_references')
          .select('external_quiz_id, external_quiz_url, passing_score')
          .eq('module_id', moduleId).single();
        if (res.error) throw res.error;
        return { type: 'external_quiz', data: res.data as ExternalQuizContent };
      }
      default:
        return { type: moduleType as ModuleType, data: null } as ModuleContent;
    }
  }

  async #getSignedUrlFromBucket(bucket: string, storagePath: string): Promise<string | null> {
    const cacheKey = `${bucket}/${storagePath}`;
    const cached = this.#signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    const { data, error } = await this.#supabase.client.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600);
    if (error) {
      console.warn(`Signed URL failed for "${cacheKey}": ${error.message}`);
      return null;
    }

    this.#signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + this.#SIGNED_URL_TTL_MS,
    });
    return data.signedUrl;
  }

  async #getSignedUrl(storagePath: string): Promise<string | null> {
    return this.#getSignedUrlFromBucket('course-files', storagePath);
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

  // --- Audio playlist helpers ---

  findAudioNeighbors(moduleId: string): { prev: string | null; next: string | null } {
    const detail = this.#courseDetail();
    if (!detail) return { prev: null, next: null };
    const audioIds: string[] = [];
    for (const lecture of detail.lectures) {
      for (const mod of lecture.modules) {
        if (mod.module_type === 'audio') audioIds.push(mod.id);
      }
    }
    const idx = audioIds.indexOf(moduleId);
    return {
      prev: idx > 0 ? audioIds[idx - 1] : null,
      next: idx < audioIds.length - 1 ? audioIds[idx + 1] : null,
    };
  }

  async fetchAudioTrack(courseId: string, moduleId: string): Promise<ActiveTrack | null> {
    if (!this.#courseDetail() || this.#courseDetail()!.id !== courseId) {
      await this.loadCourseDetail(courseId);
    }
    const detail = this.#courseDetail();
    let title = 'Audio';
    let courseName: string | undefined;
    let lectureName: string | undefined;
    if (detail) {
      courseName = detail.title;
      for (const lec of detail.lectures) {
        const mod = lec.modules.find(m => m.id === moduleId);
        if (mod) { title = mod.title; lectureName = lec.title; break; }
      }
    }
    const { data, error } = await this.#supabase.client.from('module_audio')
      .select('file_url, duration_seconds')
      .eq('module_id', moduleId).single();
    if (error || !data) return null;
    const signedUrl = await this.#getSignedUrl((data as any).file_url);
    if (!signedUrl) return null;

    const neighbors = this.findAudioNeighbors(moduleId);
    return {
      moduleId, courseId, title, fileUrl: signedUrl,
      durationSeconds: (data as any).duration_seconds,
      nextModuleId: neighbors.next ?? undefined,
      prevModuleId: neighbors.prev ?? undefined,
      courseName,
      lectureName,
    };
  }

  // --- Storage cleanup helpers (DI-07 fix) ---

  async #removeStorageFiles(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    try {
      const { error } = await this.#supabase.client.storage
        .from('course-files')
        .remove(paths);
      if (error) console.warn('Storage cleanup failed:', error.message);
    } catch (err) {
      console.warn('Storage cleanup error:', err);
    }
  }

  async #collectModuleStoragePaths(moduleId: string): Promise<string[]> {
    const client = this.#supabase.client;
    const paths: string[] = [];

    const [pdfRes, filesRes, examRes, audioRes, downloadRes, markdownRes] = await Promise.all([
      client.from('module_pdfs').select('file_url').eq('module_id', moduleId).maybeSingle(),
      client.from('module_files').select('file_url').eq('module_id', moduleId),
      client.from('exams').select('exam_file_url').eq('module_id', moduleId).maybeSingle(),
      client.from('module_audio').select('file_url').eq('module_id', moduleId).maybeSingle(),
      client.from('module_downloads').select('file_url').eq('module_id', moduleId).maybeSingle(),
      client.from('module_markdown').select('content').eq('module_id', moduleId).maybeSingle(),
    ]);

    if (pdfRes.data?.file_url) paths.push(pdfRes.data.file_url as string);
    if (filesRes.data) {
      for (const f of filesRes.data) {
        if ((f as { file_url: string }).file_url) paths.push((f as { file_url: string }).file_url);
      }
    }
    if (examRes.data?.exam_file_url) paths.push(examRes.data.exam_file_url as string);
    if (audioRes.data?.file_url) paths.push(audioRes.data.file_url as string);
    if (downloadRes.data?.file_url) paths.push(downloadRes.data.file_url as string);
    if (markdownRes.data?.content) {
      paths.push(...extractStoragePaths(markdownRes.data.content as string));
    }

    return paths;
  }

  async #collectBunnyVideoIds(moduleId: string): Promise<string[]> {
    const { data } = await this.#supabase.client
      .from('module_videos')
      .select('bunny_video_id')
      .eq('module_id', moduleId);
    if (!data) return [];
    return data
      .map((v: { bunny_video_id: string }) => v.bunny_video_id)
      .filter((id: string) => !!id);
  }

  #cleanupBunnyVideos(videoIds: string[]): void {
    for (const id of videoIds) {
      this.#bunnyUpload.deleteVideo(id).subscribe({
        error: () => console.warn('Bunny video cleanup failed for', id),
      });
    }
  }

  async #collectCourseBunnyVideoIds(courseId: string): Promise<string[]> {
    const { data } = await this.#supabase.client
      .from('module_videos')
      .select('bunny_video_id, modules!inner(course_id)')
      .eq('modules.course_id', courseId);
    if (!data) return [];
    return data
      .map((v: { bunny_video_id: string }) => v.bunny_video_id)
      .filter((id: string) => !!id);
  }

  async #listCourseStoragePaths(courseId: string): Promise<string[]> {
    const paths: string[] = [];
    let offset = 0;
    const limit = 100;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await this.#supabase.client.storage
        .from('course-files')
        .list(courseId, { limit, offset });

      if (error || !data || data.length === 0) break;
      for (const file of data) {
        paths.push(`${courseId}/${file.name}`);
      }
      if (data.length < limit) break;
      offset += limit;
    }

    return paths;
  }

  async #insertQuizQuestions(quizId: string, questions: QuizQuestionFormData[]): Promise<void> {
    for (const q of questions) {
      const { data: qRow, error: qErr } = await this.#supabase.client
        .from('quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: q.question_text,
          question_type: q.question_type,
          points: q.points,
          sort_order: q.sort_order,
          correct_answer: q.correct_answer,
          explanation: q.explanation ?? null,
        })
        .select('id').single();
      if (qErr) throw new Error(extractErrorMessage(qErr, 'Failed to save question'));

      if (q.options.length > 0) {
        const { error: oErr } = await this.#supabase.client
          .from('quiz_question_options')
          .insert(q.options.map(o => ({
            question_id: qRow.id,
            option_text: o.option_text,
            is_correct: o.is_correct,
            sort_order: o.sort_order,
          })));
        if (oErr) throw new Error(extractErrorMessage(oErr, 'Failed to save options'));
      }
    }
  }

  // --- Thumbnail upload methods ---

  async uploadThumbnail(courseId: string, file: File): Promise<string> {
    const compressed = await compressImage(file, 1280);
    const path = `${courseId}/thumbnail-${Date.now()}.webp`;
    const { data, error } = await this.#supabase.client.storage
      .from('course-files')
      .upload(path, compressed, { upsert: false, contentType: compressed.type });

    if (error) throw new Error(`Failed to upload thumbnail: ${error.message}`);
    return data.path;
  }

  async deleteThumbnailIfStoragePath(url: string | null): Promise<void> {
    if (!isStoragePath(url)) return;
    await this.#supabase.client.storage
      .from('course-files')
      .remove([url!]);
  }

  async getCourseThumbnailSignedUrl(path: string): Promise<string | null> {
    return this.#getSignedThumbnailUrl(path);
  }

  async #getSignedThumbnailUrl(path: string): Promise<string | null> {
    const { data, error } = await this.#supabase.client.storage
      .from('course-files')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  async #resolveThumbnailUrls(courses: CourseWithProgress[]): Promise<void> {
    const storagePaths: { index: number; path: string }[] = [];
    for (let i = 0; i < courses.length; i++) {
      if (isStoragePath(courses[i].thumbnail_url)) {
        storagePaths.push({ index: i, path: courses[i].thumbnail_url! });
      }
    }
    if (storagePaths.length === 0) return;

    const { data, error } = await this.#supabase.client.storage
      .from('course-files')
      .createSignedUrls(storagePaths.map(s => s.path), 3600);

    if (error || !data) return;

    for (let i = 0; i < storagePaths.length; i++) {
      const result = data[i];
      if (result && !result.error && result.signedUrl) {
        courses[storagePaths[i].index].thumbnail_url = result.signedUrl;
      }
    }
  }

  async #resolveAvatarUrls(lecturers: CourseLecturer[]): Promise<void> {
    await resolveAvatarUrls(this.#supabase.client, lecturers);
  }
}
