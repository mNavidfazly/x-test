import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import {
  DashboardUserProgress, DashboardCourseProgress,
  DashboardCourseSummary, ReminderRequest, ReminderResponse,
} from '../models/course.model';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);
  #api = inject(ApiService);

  #users = signal<DashboardUserProgress[]>([]);
  #courses = signal<DashboardCourseSummary[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly users = this.#users.asReadonly();
  readonly courses = this.#courses.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadDashboardData() {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;
      const user = this.#auth.currentUser();
      if (!user) throw new Error('Not authenticated');

      const isPAOrCSM = user.claims.is_platform_admin || user.claims.csm_tenant_ids.length > 0;

      // 4 parallel queries — RLS auto-scopes per role
      const [coursesRes, enrollmentsRes, progressRes, modulesRes] = await Promise.all([
        client.from('courses').select('id, title').order('title'),
        client.from('course_enrollments').select('user_id, tenant_id, course_id, profiles(email, full_name)'),
        client.from('user_progress').select('user_id, course_id, module_id, status, updated_at'),
        client.from('modules').select('id, course_id'),
      ]);

      // Check errors
      for (const res of [coursesRes, enrollmentsRes, progressRes, modulesRes]) {
        if (res.error) throw res.error;
      }

      // Optional: load tenants for PA/CSM tenant name column
      let tenantMap = new Map<string, string>();
      if (isPAOrCSM) {
        const tenantsRes = await client.from('tenants').select('id, name');
        if (tenantsRes.data) {
          for (const t of tenantsRes.data) {
            tenantMap.set((t as any).id, (t as any).name);
          }
        }
      }

      const courses = (coursesRes.data ?? []) as { id: string; title: string }[];
      const enrollments = (enrollmentsRes.data ?? []) as unknown as {
        user_id: string; tenant_id: string; course_id: string;
        profiles: { email: string; full_name: string | null } | null;
      }[];
      const progress = (progressRes.data ?? []) as {
        user_id: string; course_id: string; module_id: string; status: string; updated_at: string;
      }[];
      const modules = (modulesRes.data ?? []) as { id: string; course_id: string }[];

      // Build module count per course
      const moduleCountByCourse = new Map<string, number>();
      for (const m of modules) {
        moduleCountByCourse.set(m.course_id, (moduleCountByCourse.get(m.course_id) ?? 0) + 1);
      }

      // Build course title lookup
      const courseTitleMap = new Map<string, string>();
      for (const c of courses) {
        courseTitleMap.set(c.id, c.title);
      }

      // Build progress lookup: userId → courseId → { completed, lastUpdated }
      const progressLookup = new Map<string, Map<string, { completed: number; lastUpdated: string | null }>>();
      for (const p of progress) {
        if (!progressLookup.has(p.user_id)) progressLookup.set(p.user_id, new Map());
        const courseMap = progressLookup.get(p.user_id)!;
        if (!courseMap.has(p.course_id)) courseMap.set(p.course_id, { completed: 0, lastUpdated: null });
        const entry = courseMap.get(p.course_id)!;
        if (p.status === 'completed') entry.completed++;
        if (p.updated_at && (!entry.lastUpdated || p.updated_at > entry.lastUpdated)) {
          entry.lastUpdated = p.updated_at;
        }
      }

      // Build user list — deduplicate by user_id
      const userMap = new Map<string, DashboardUserProgress>();
      for (const e of enrollments) {
        if (!userMap.has(e.user_id)) {
          userMap.set(e.user_id, {
            user_id: e.user_id,
            tenant_id: e.tenant_id,
            email: e.profiles?.email ?? '',
            full_name: e.profiles?.full_name ?? null,
            tenant_name: isPAOrCSM ? (tenantMap.get(e.tenant_id) ?? null) : null,
            courses: [],
            overallPercent: 0,
            lastActive: null,
          });
        }

        const u = userMap.get(e.user_id)!;
        const total = moduleCountByCourse.get(e.course_id) ?? 0;
        const courseProgress = progressLookup.get(e.user_id)?.get(e.course_id);
        const completed = courseProgress?.completed ?? 0;

        u.courses.push({
          course_id: e.course_id,
          course_title: courseTitleMap.get(e.course_id) ?? 'Unknown',
          completed,
          total,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        });

        // Update lastActive
        const lastUpdated = courseProgress?.lastUpdated ?? null;
        if (lastUpdated && (!u.lastActive || lastUpdated > u.lastActive)) {
          u.lastActive = lastUpdated;
        }
      }

      // Compute overall percent per user (weighted)
      const users: DashboardUserProgress[] = [];
      for (const u of userMap.values()) {
        if (u.courses.length > 0) {
          const totalPossible = u.courses.reduce((sum, c) => sum + c.total, 0);
          const totalCompleted = u.courses.reduce((sum, c) => sum + c.completed, 0);
          u.overallPercent = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
        }
        users.push(u);
      }

      users.sort((a, b) => a.email.localeCompare(b.email));

      this.#users.set(users);
      this.#courses.set(courses.map(c => ({ id: c.id, title: c.title })));
    } catch (err) {
      this.#error.set(
        err instanceof Error ? err.message :
        typeof err === 'object' && err && 'message' in err ? String((err as any).message) :
        'Failed to load progress data',
      );
    } finally {
      this.#loading.set(false);
    }
  }

  sendReminders(request: ReminderRequest): Observable<ReminderResponse> {
    return this.#api.post<ReminderResponse>('/reminders/send', request);
  }
}
