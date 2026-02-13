import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Issue, IssueType, IssueStatus, IssueForBoard, BoardIssueSummary } from '../models/issue.model';

@Injectable({ providedIn: 'root' })
export class IssueService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  // --- Learner signals (My Issues) ---
  #issues = signal<Issue[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly issues = this.#issues.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  // --- Board signals (Lecturer / Platform Admin) ---
  #boardIssues = signal<IssueForBoard[]>([]);
  #boardCourses = signal<BoardIssueSummary[]>([]);
  #boardLoading = signal(false);
  #boardError = signal('');

  readonly boardIssues = this.#boardIssues.asReadonly();
  readonly boardCourses = this.#boardCourses.asReadonly();
  readonly boardLoading = this.#boardLoading.asReadonly();
  readonly boardError = this.#boardError.asReadonly();

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

  // --- Board methods (Lecturer / Platform Admin) ---

  async loadBoardIssues(): Promise<void> {
    this.#boardLoading.set(true);
    this.#boardError.set('');

    try {
      const user = this.#auth.currentUser();
      if (!user) throw new Error('Not authenticated');

      // RLS auto-scopes: lecturer sees assigned courses cross-tenant, PA sees all
      const { data, error } = await this.#supabase.client
        .from('issues')
        .select(`
          *,
          course:courses!issues_course_id_fkey(title),
          module:modules!issues_module_id_fkey(title),
          reporter:profiles!user_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const issues = (data ?? []).map((row: any) => ({
        ...row,
        course: row.course ?? null,
        module: row.module ?? null,
        reporter: row.reporter ?? null,
      })) as IssueForBoard[];

      // Derive course list from issue data (Map dedup + sort)
      const courseMap = new Map<string, string>();
      for (const issue of issues) {
        if (!courseMap.has(issue.course_id)) {
          courseMap.set(issue.course_id, issue.course?.title ?? 'Unknown');
        }
      }
      const courses: BoardIssueSummary[] = Array.from(courseMap.entries())
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));

      this.#boardIssues.set(issues);
      this.#boardCourses.set(courses);
    } catch (err) {
      this.#boardError.set(
        err instanceof Error ? err.message :
        typeof err === 'object' && err && 'message' in err ? String((err as any).message) :
        'Failed to load issues',
      );
    } finally {
      this.#boardLoading.set(false);
    }
  }

  async updateIssue(issueId: string, updates: { status?: IssueStatus; internal_notes?: string }): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const payload: Record<string, unknown> = { ...updates };

    // Auto-set resolved_by/resolved_at when resolving
    if (updates.status === 'resolved') {
      payload['resolved_by'] = user.id;
      payload['resolved_at'] = new Date().toISOString();
    } else if (updates.status) {
      // Clear resolution fields when moving away from resolved
      payload['resolved_by'] = null;
      payload['resolved_at'] = null;
    }

    const { error } = await this.#supabase.client
      .from('issues')
      .update(payload)
      .eq('id', issueId);

    if (error) throw new Error(error.message || 'Failed to update issue');
  }
}
