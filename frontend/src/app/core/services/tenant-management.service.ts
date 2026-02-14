import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { extractErrorMessage } from '../utils/error.utils';
import {
  TenantForBoard,
  TenantSettings,
  TenantFormData,
  TenantCourseAssignment,
  CsmAssignment,
  AvailableCourse,
  AvailableCsm,
} from '../models/tenant-management.model';

@Injectable({ providedIn: 'root' })
export class TenantManagementService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #tenants = signal<TenantForBoard[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly tenants = this.#tenants.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadTenants(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('tenants')
        .select('*, tenant_courses(count), csm_tenant_assignments(count)')
        .order('name');

      if (error) throw error;

      const tenants: TenantForBoard[] = (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        is_master: row.is_master,
        settings: (row.settings ?? {}) as TenantSettings,
        created_at: row.created_at,
        updated_at: row.updated_at,
        courseCount: (row.tenant_courses as any)?.[0]?.count ?? 0,
        csmCount: (row.csm_tenant_assignments as any)?.[0]?.count ?? 0,
      }));

      this.#tenants.set(tenants);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load tenants'));
    } finally {
      this.#loading.set(false);
    }
  }

  async createTenant(data: TenantFormData): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('tenants')
      .insert({
        name: data.name,
        domain: data.domain || null,
        settings: { auth_methods: data.auth_methods },
      });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to create tenant'));
  }

  async updateTenant(id: string, data: Partial<TenantFormData>): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload['name'] = data.name;
    if (data.domain !== undefined) payload['domain'] = data.domain || null;
    if (data.auth_methods !== undefined) payload['settings'] = { auth_methods: data.auth_methods };

    const { error } = await this.#supabase.client
      .from('tenants')
      .update(payload)
      .eq('id', id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to update tenant'));
  }

  async deleteTenant(id: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete tenant'));
  }

  // --- Course Assignments ---

  async loadTenantCourses(tenantId: string): Promise<TenantCourseAssignment[]> {
    const { data, error } = await this.#supabase.client
      .from('tenant_courses')
      .select('id, course_id, course:courses(title)')
      .eq('tenant_id', tenantId)
      .order('course_id');

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load course assignments'));

    return (data ?? []).map((row: any) => ({
      id: row.id,
      course_id: row.course_id,
      course_title: row.course?.title ?? 'Unknown',
    }));
  }

  async loadAvailableCourses(tenantId: string): Promise<AvailableCourse[]> {
    // Load all courses
    const { data: allCourses, error: coursesErr } = await this.#supabase.client
      .from('courses')
      .select('id, title')
      .order('title');

    if (coursesErr) throw new Error(extractErrorMessage(coursesErr, 'Failed to load courses'));

    // Load already-assigned course IDs
    const { data: assigned, error: assignedErr } = await this.#supabase.client
      .from('tenant_courses')
      .select('course_id')
      .eq('tenant_id', tenantId);

    if (assignedErr) throw new Error(extractErrorMessage(assignedErr, 'Failed to load assigned courses'));

    const assignedIds = new Set((assigned ?? []).map((r: any) => r.course_id));
    return (allCourses ?? [])
      .filter((c: any) => !assignedIds.has(c.id))
      .map((c: any) => ({ id: c.id, title: c.title }));
  }

  async assignCourseToTenant(tenantId: string, courseId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .insert({ tenant_id: tenantId, course_id: courseId });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to assign course'));
  }

  async removeCourseFromTenant(tenantId: string, courseId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('tenant_courses')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('course_id', courseId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to remove course'));
  }

  // --- CSM Assignments ---

  async loadCsmAssignments(tenantId: string): Promise<CsmAssignment[]> {
    const { data, error } = await this.#supabase.client
      .from('csm_tenant_assignments')
      .select('id, user_id, assigned_at, user:profiles!user_id(email, full_name)')
      .eq('tenant_id', tenantId)
      .order('assigned_at', { ascending: false });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load CSM assignments'));

    return (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      email: row.user?.email ?? 'Unknown',
      full_name: row.user?.full_name ?? null,
      assigned_at: row.assigned_at,
    }));
  }

  async loadAvailableCsms(tenantId: string): Promise<AvailableCsm[]> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    // PA is on master tenant — query master-tenant profiles
    const masterTenantId = user.claims.tenant_id;

    const { data: masterProfiles, error: profilesErr } = await this.#supabase.client
      .from('profiles')
      .select('id, email, full_name')
      .eq('tenant_id', masterTenantId)
      .order('email');

    if (profilesErr) throw new Error(extractErrorMessage(profilesErr, 'Failed to load profiles'));

    // Filter out already-assigned CSMs for this tenant
    const { data: assigned, error: assignedErr } = await this.#supabase.client
      .from('csm_tenant_assignments')
      .select('user_id')
      .eq('tenant_id', tenantId);

    if (assignedErr) throw new Error(extractErrorMessage(assignedErr, 'Failed to load assigned CSMs'));

    const assignedIds = new Set((assigned ?? []).map((r: any) => r.user_id));
    return (masterProfiles ?? [])
      .filter((p: any) => !assignedIds.has(p.id))
      .map((p: any) => ({ id: p.id, email: p.email, full_name: p.full_name }));
  }

  async assignCsm(tenantId: string, userId: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('csm_tenant_assignments')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        assigned_by: user.id,
      });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to assign CSM'));
  }

  async removeCsm(assignmentId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('csm_tenant_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to remove CSM'));
  }

  // --- Tenant List (lightweight, for dropdowns) ---

  async loadAvailableTenantsList(): Promise<{ id: string; name: string }[]> {
    const { data, error } = await this.#supabase.client
      .from('tenants')
      .select('id, name')
      .order('name');
    if (error) throw new Error(extractErrorMessage(error, 'Failed to load tenants'));
    return data ?? [];
  }
}
