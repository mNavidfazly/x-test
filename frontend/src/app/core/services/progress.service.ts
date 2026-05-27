import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import {
  DashboardUserProgress,
  DashboardCourseSummary, ReminderRequest, ReminderResponse,
} from '../models/course.model';
import { extractErrorMessage } from '../utils/error.utils';

interface RpcRow {
  user_id: string;
  tenant_id: string;
  tenant_name: string | null;
  email: string;
  full_name: string | null;
  course_id: string;
  course_title: string;
  completed: number;
  total: number;
  last_updated: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProgressService {
  #supabase = inject(SupabaseService);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      // Single RPC replaces 4 parallel queries + optional 5th tenants query.
      // Permission gating (PA/TA/CSM/Lecturer 4-role branches) and per-course
      // completion aggregation now server-side. See migration 00060.
      const { data, error } = await this.#supabase.client.rpc('get_progress_dashboard_data');
      if (error) throw error;
      const rows = (data ?? []) as RpcRow[];

      // Group rows by user_id (RPC returns one row per (user, course) enrollment)
      const userMap = new Map<string, DashboardUserProgress>();
      const courseMap = new Map<string, DashboardCourseSummary>();

      for (const r of rows) {
        if (!courseMap.has(r.course_id)) {
          courseMap.set(r.course_id, { id: r.course_id, title: r.course_title });
        }
        if (!userMap.has(r.user_id)) {
          userMap.set(r.user_id, {
            user_id: r.user_id,
            tenant_id: r.tenant_id,
            email: r.email,
            full_name: r.full_name,
            tenant_name: r.tenant_name,
            courses: [],
            overallPercent: 0,
            lastActive: null,
          });
        }
        const u = userMap.get(r.user_id)!;
        u.courses.push({
          course_id: r.course_id,
          course_title: r.course_title,
          completed: r.completed,
          total: r.total,
          percent: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
        });
        if (r.last_updated && (!u.lastActive || r.last_updated > u.lastActive)) {
          u.lastActive = r.last_updated;
        }
      }

      // Compute overall weighted percent per user
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

      const courses = Array.from(courseMap.values()).sort((a, b) => a.title.localeCompare(b.title));

      this.#users.set(users);
      this.#courses.set(courses);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load progress data'));
    } finally {
      this.#loading.set(false);
    }
  }

  sendReminders(request: ReminderRequest): Observable<ReminderResponse> {
    return this.#api.post<ReminderResponse>('/reminders/send', request);
  }
}
