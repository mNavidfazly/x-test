import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
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
      // Single RPC replaces 6 parallel queries + client-side aggregation.
      // Permission gating and staleness math now server-side. See migration 00056.
      const { data, error } = await this.#supabase.client.rpc('get_teaching_overview');
      if (error) throw error;

      type RpcRow = {
        course_id: string;
        title: string;
        staleness_threshold_days: number;
        enrolled_count: number;
        pending_exams: number;
        pending_questions: number;
        open_issues: number;
        stale_modules: number;
        total_modules: number;
        can_edit: boolean;
        can_grade: boolean;
      };
      const rows = (data ?? []) as RpcRow[];
      const courses: TeachingCourseOverview[] = rows.map((row: RpcRow) => {
        const pendingExams = row.pending_exams;
        const pendingQuestions = row.pending_questions;
        const openIssues = row.open_issues;
        const staleModules = row.stale_modules;
        return {
          id: row.course_id,
          title: row.title,
          canEdit: row.can_edit,
          canGrade: row.can_grade,
          enrolledCount: row.enrolled_count,
          pendingExams,
          pendingQuestions,
          openIssues,
          staleModules,
          totalModules: row.total_modules,
          totalActionItems: pendingExams + pendingQuestions + openIssues + staleModules,
        };
      });

      // Sort: most action items first, then alphabetical (matches prior behavior)
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
}
