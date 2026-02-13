import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Issue, IssueType } from '../models/issue.model';

@Injectable({ providedIn: 'root' })
export class IssueService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #issues = signal<Issue[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly issues = this.#issues.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadMyIssues(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      // Read from issues_safe view (NOT base issues table) —
      // learners have no base-table SELECT policy; the view
      // excludes internal_notes and filters by user_id / tenant_admin.
      const { data, error } = await this.#supabase.client
        .from('issues_safe')
        .select(`
          *,
          course:courses!issues_course_id_fkey(title),
          module:modules!issues_module_id_fkey(title)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const issues = (data ?? []).map((row: any) => ({
        ...row,
        course: row.course ?? null,
        module: row.module ?? null,
      })) as Issue[];

      this.#issues.set(issues);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      this.#error.set(msg || 'Failed to load issues');
    } finally {
      this.#loading.set(false);
    }
  }

  async reportIssue(
    courseId: string,
    moduleId: string | null,
    issueType: IssueType,
    description: string,
  ): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    // INSERT goes to base issues table (issues_insert_own policy)
    const { error } = await this.#supabase.client
      .from('issues')
      .insert({
        course_id: courseId,
        module_id: moduleId,
        user_id: user.id,
        tenant_id: user.claims.tenant_id,
        issue_type: issueType,
        description,
      });

    if (error) throw new Error(error.message);
    await this.loadMyIssues();
  }
}
