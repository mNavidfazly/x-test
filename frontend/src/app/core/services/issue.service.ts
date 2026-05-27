import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Issue, IssueType, IssueStatus, IssueForBoard, IssueReporter, BoardIssueSummary } from '../models/issue.model';
import { extractErrorMessage } from '../utils/error.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';

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
      this.#error.set(extractErrorMessage(err, 'Failed to load issues'));
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

    if (error) throw new Error(extractErrorMessage(error, 'Failed to report issue'));
    await this.loadMyIssues();
  }

  // --- Board methods (Lecturer / Platform Admin) ---

  async loadBoardIssues(): Promise<void> {
    this.#boardLoading.set(true);
    this.#boardError.set('');

    try {
      const user = this.#auth.currentUser();
      if (!user) throw new Error('Not authenticated');

      // Single RPC replaces unbounded SELECT with 3-table embed.
      // Permission gating (PA/CSM/Lecturer) enforced server-side.
      // See migration 00063.
      const { data, error } = await this.#supabase.client.rpc('get_issues_board_data');
      if (error) throw error;

      type RpcRow = {
        issue_id: string; user_id: string; tenant_id: string;
        course_id: string; module_id: string | null;
        issue_type: string; description: string; status: string;
        internal_notes: string | null;
        resolved_at: string | null; resolved_by: string | null;
        created_at: string; updated_at: string;
        course_title: string | null; module_title: string | null;
        reporter_full_name: string | null; reporter_email: string | null; reporter_avatar_url: string | null;
      };
      const rows = (data ?? []) as RpcRow[];

      const issues = rows.map(r => ({
        id: r.issue_id,
        user_id: r.user_id,
        tenant_id: r.tenant_id,
        course_id: r.course_id,
        module_id: r.module_id,
        issue_type: r.issue_type,
        description: r.description,
        status: r.status,
        internal_notes: r.internal_notes,
        resolved_at: r.resolved_at,
        resolved_by: r.resolved_by,
        created_at: r.created_at,
        updated_at: r.updated_at,
        course: r.course_title ? { title: r.course_title } : null,
        module: r.module_title ? { title: r.module_title } : null,
        reporter: r.reporter_email ? {
          full_name: r.reporter_full_name,
          email: r.reporter_email,
          avatar_url: r.reporter_avatar_url,
        } : null,
      })) as unknown as IssueForBoard[];

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

      const reporters = issues.map(i => i.reporter).filter(Boolean) as IssueReporter[];
      await resolveAvatarUrls(this.#supabase.client, reporters);

      this.#boardIssues.set(issues);
      this.#boardCourses.set(courses);
    } catch (err) {
      this.#boardError.set(extractErrorMessage(err, 'Failed to load issues'));
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
