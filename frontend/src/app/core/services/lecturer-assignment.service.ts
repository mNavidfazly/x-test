import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import {
  LecturerAssignment,
  AvailableLecturer,
  AvailableCourse,
  UpdatePermissionsData,
} from '../models/lecturer-assignment.model';

@Injectable({ providedIn: 'root' })
export class LecturerAssignmentService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #assignments = signal<LecturerAssignment[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly assignments = this.#assignments.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  #extractErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && 'message' in err)
      return String((err as { message: unknown }).message);
    return fallback;
  }

  async loadAssignments(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('lecturer_course_assignments')
        .select(
          'id, user_id, course_id, can_edit, can_grade, assigned_at, user:profiles!user_id(email, full_name), course:courses!course_id(title), assigner:profiles!assigned_by(full_name)',
        )
        .order('assigned_at', { ascending: false });

      if (error) throw error;

      const assignments: LecturerAssignment[] = (data ?? []).map(
        (row: any) => ({
          id: row.id,
          user_id: row.user_id,
          email: row.user?.email ?? 'Unknown',
          full_name: row.user?.full_name ?? null,
          course_id: row.course_id,
          course_title: row.course?.title ?? 'Unknown Course',
          can_edit: row.can_edit,
          can_grade: row.can_grade,
          assigned_at: row.assigned_at,
          assigned_by_name: row.assigner?.full_name ?? null,
        }),
      );

      this.#assignments.set(assignments);
    } catch (err) {
      this.#error.set(
        this.#extractErrorMessage(err, 'Failed to load lecturer assignments'),
      );
    } finally {
      this.#loading.set(false);
    }
  }

  async addAssignment(userId: string, courseId: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('lecturer_course_assignments')
      .insert({
        user_id: userId,
        course_id: courseId,
        assigned_by: user.id,
      });

    if (error) throw new Error(error.message || 'Failed to add assignment');
  }

  async removeAssignment(id: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lecturer_course_assignments')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message || 'Failed to remove assignment');
  }

  async updatePermissions(
    id: string,
    data: UpdatePermissionsData,
  ): Promise<void> {
    const { error } = await this.#supabase.client
      .from('lecturer_course_assignments')
      .update(data)
      .eq('id', id);

    if (error)
      throw new Error(error.message || 'Failed to update permissions');
  }

  async loadAvailableLecturers(): Promise<AvailableLecturer[]> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const masterTenantId = user.claims.tenant_id;

    const { data, error } = await this.#supabase.client
      .from('profiles')
      .select('id, email, full_name')
      .eq('tenant_id', masterTenantId)
      .order('email');

    if (error) throw new Error(error.message || 'Failed to load profiles');

    return (data ?? []).map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
    }));
  }

  async loadAvailableCourses(userId: string): Promise<AvailableCourse[]> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { data: allCourses, error: coursesErr } =
      await this.#supabase.client
        .from('courses')
        .select('id, title')
        .order('title');

    if (coursesErr)
      throw new Error(coursesErr.message || 'Failed to load courses');

    const { data: assigned, error: assignedErr } =
      await this.#supabase.client
        .from('lecturer_course_assignments')
        .select('course_id')
        .eq('user_id', userId);

    if (assignedErr)
      throw new Error(
        assignedErr.message || 'Failed to load assigned courses',
      );

    const assignedIds = new Set(
      (assigned ?? []).map((r: any) => r.course_id),
    );
    return (allCourses ?? [])
      .filter((c: any) => !assignedIds.has(c.id))
      .map((c: any) => ({ id: c.id, title: c.title }));
  }
}
