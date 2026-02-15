import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { extractErrorMessage } from '../../core/utils/error.utils';

export interface DashboardCounts {
  pendingAccessRequests: number | null;
  openIssues: number | null;
  ungradedExams: number | null;
  unansweredQuestions: number | null;
  totalUsers: number | null;
  totalCourses: number | null;
  totalTenants: number | null;
}

const EMPTY_COUNTS: DashboardCounts = {
  pendingAccessRequests: null,
  openIssues: null,
  ungradedExams: null,
  unansweredQuestions: null,
  totalUsers: null,
  totalCourses: null,
  totalTenants: null,
};

@Injectable({ providedIn: 'root' })
export class DashboardService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  readonly counts = signal<DashboardCounts>(EMPTY_COUNTS);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadCounts(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.loading.set(true);
    this.error.set(null);

    const claims = user.claims;
    const isAdmin = claims.is_tenant_admin || claims.is_platform_admin;
    const isLecturer = claims.lecturer_course_ids.length > 0;
    const canGrade = claims.lecturer_can_grade_course_ids.length > 0;
    const isPA = claims.is_platform_admin;

    try {
      const queries: { key: keyof DashboardCounts; promise: Promise<number> }[] = [];

      if (isAdmin) {
        queries.push({ key: 'pendingAccessRequests', promise: this.#count('access_requests', { eq: ['status', 'pending'] }) });
        queries.push({ key: 'totalUsers', promise: this.#count('profiles') });
      }

      if (isLecturer || isPA) {
        queries.push({ key: 'openIssues', promise: this.#count('issues', { in: ['status', ['open', 'investigating']] }) });
        queries.push({ key: 'unansweredQuestions', promise: this.#count('expert_questions', { eq: ['status', 'pending'] }) });
      }

      if (canGrade || isPA) {
        queries.push({ key: 'ungradedExams', promise: this.#count('exam_submissions', { isNull: 'score' }) });
      }

      if (isPA) {
        queries.push({ key: 'totalCourses', promise: this.#count('courses') });
        queries.push({ key: 'totalTenants', promise: this.#count('tenants') });
      }

      const results = await Promise.allSettled(queries.map(q => q.promise));

      const counts: DashboardCounts = { ...EMPTY_COUNTS };
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          counts[queries[i].key] = result.value;
        }
      });

      this.counts.set(counts);
    } catch (err) {
      this.error.set(extractErrorMessage(err, 'Failed to load dashboard data'));
    } finally {
      this.loading.set(false);
    }
  }

  async #count(
    table: string,
    filter?: { eq?: [string, string]; in?: [string, string[]]; isNull?: string },
  ): Promise<number> {
    let query = this.#supabase.client.from(table).select('id', { count: 'exact', head: true });

    if (filter?.eq) {
      query = query.eq(filter.eq[0], filter.eq[1]);
    }
    if (filter?.in) {
      query = query.in(filter.in[0], filter.in[1]);
    }
    if (filter?.isNull) {
      query = query.is(filter.isNull, null);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }
}
