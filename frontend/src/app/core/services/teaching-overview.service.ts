import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { extractErrorMessage } from '../utils/error.utils';

export interface TeachingCourseOverview {
  id: string;
  title: string;
  canEdit: boolean;
  canGrade: boolean;
  enrolledCount: number;
  pendingExams: number;
  pendingQuestions: number;
  openIssues: number;
  staleModules: number;
  totalModules: number;
  totalActionItems: number;
}

@Injectable({ providedIn: 'root' })
export class TeachingOverviewService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #courses = signal<TeachingCourseOverview[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly courses = this.#courses.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadOverview(): Promise<void> {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;

      const [coursesRes, enrollmentsRes, examsRes, questionsRes, issuesRes, modulesRes] = await Promise.all([
        client.from('courses').select('id, title, staleness_threshold_days'),
        client.from('course_enrollments').select('course_id'),
        client.from('exam_submissions').select('course_id').is('score', null),
        client.from('expert_questions').select('course_id').eq('status', 'pending'),
        client.from('issues').select('course_id').in('status', ['open', 'investigating']),
        client.from('modules').select('course_id, updated_at, staleness_postponed_until'),
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (examsRes.error) throw examsRes.error;
      if (questionsRes.error) throw questionsRes.error;
      if (issuesRes.error) throw issuesRes.error;
      if (modulesRes.error) throw modulesRes.error;

      const enrollmentMap = this.#countByField(enrollmentsRes.data ?? [], 'course_id');
      const examMap = this.#countByField(examsRes.data ?? [], 'course_id');
      const questionMap = this.#countByField(questionsRes.data ?? [], 'course_id');
      const issueMap = this.#countByField(issuesRes.data ?? [], 'course_id');

      const claims = this.#auth.currentUser()?.claims;
      const isPlatformAdmin = claims?.is_platform_admin === true;
      const lecturerIds = new Set(claims?.lecturer_course_ids ?? []);
      const editIds = new Set(claims?.lecturer_can_edit_course_ids ?? []);
      const gradeIds = new Set(claims?.lecturer_can_grade_course_ids ?? []);

      // Filter to only assigned courses (PA sees all)
      const visibleCourses = (coursesRes.data ?? []).filter(
        course => isPlatformAdmin || lecturerIds.has(course.id),
      );

      const now = Date.now();
      const MS_PER_DAY = 86_400_000;

      // Group modules by course_id and compute staleness
      const staleMap = new Map<string, number>();
      const totalModuleMap = new Map<string, number>();
      for (const mod of modulesRes.data ?? []) {
        totalModuleMap.set(mod.course_id, (totalModuleMap.get(mod.course_id) ?? 0) + 1);
      }

      // Need course thresholds for staleness calc
      const thresholdMap = new Map<string, number>();
      for (const course of visibleCourses) {
        thresholdMap.set(course.id, course.staleness_threshold_days ?? 180);
      }

      for (const mod of modulesRes.data ?? []) {
        const threshold = thresholdMap.get(mod.course_id) ?? 180;
        const daysSinceUpdate = Math.floor((now - new Date(mod.updated_at).getTime()) / MS_PER_DAY);
        const isPastThreshold = daysSinceUpdate > threshold;
        const isPostponed = mod.staleness_postponed_until
          ? new Date(mod.staleness_postponed_until).getTime() > now
          : false;
        const isStale = isPastThreshold && !isPostponed;
        if (isStale) {
          staleMap.set(mod.course_id, (staleMap.get(mod.course_id) ?? 0) + 1);
        }
      }

      const courses: TeachingCourseOverview[] = visibleCourses.map(course => {
        const canEdit = isPlatformAdmin || editIds.has(course.id);
        const canGrade = isPlatformAdmin || gradeIds.has(course.id);
        const pendingExams = canGrade ? (examMap.get(course.id) ?? 0) : 0;
        const pendingQuestions = questionMap.get(course.id) ?? 0;
        const openIssues = issueMap.get(course.id) ?? 0;
        const staleModules = staleMap.get(course.id) ?? 0;

        return {
          id: course.id,
          title: course.title,
          canEdit,
          canGrade,
          enrolledCount: enrollmentMap.get(course.id) ?? 0,
          pendingExams,
          pendingQuestions,
          openIssues,
          staleModules,
          totalModules: totalModuleMap.get(course.id) ?? 0,
          totalActionItems: pendingExams + pendingQuestions + openIssues + staleModules,
        };
      });

      // Sort: most action items first, then alphabetical
      courses.sort((a, b) => {
        if (b.totalActionItems !== a.totalActionItems) return b.totalActionItems - a.totalActionItems;
        return a.title.localeCompare(b.title);
      });

      this.#courses.set(courses);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load teaching overview'));
    } finally {
      this.#loading.set(false);
    }
  }

  #countByField(rows: Array<{ course_id: string }>, field: 'course_id'): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row[field], (map.get(row[field]) ?? 0) + 1);
    }
    return map;
  }
}
