import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { GradingSubmission, GradingCourseSummary, GradeExamPayload } from '../models/course.model';
import { extractErrorMessage } from '../utils/error.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';

@Injectable({ providedIn: 'root' })
export class ExamGradingService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #submissions = signal<GradingSubmission[]>([]);
  #courses = signal<GradingCourseSummary[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly submissions = this.#submissions.asReadonly();
  readonly courses = this.#courses.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadGradingData() {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const client = this.#supabase.client;
      const user = this.#auth.currentUser();
      if (!user) throw new Error('Not authenticated');

      // Single RPC replaces the embed-heavy SELECT with 3 joins. Permission
      // gating (PA or lecturer with can_grade) enforced server-side.
      // See migration 00061.
      const { data, error } = await client.rpc('get_exam_grading_data');
      if (error) throw error;

      type RpcRow = {
        submission_id: string; user_id: string; tenant_id: string;
        exam_id: string; course_id: string; file_url: string;
        submitted_at: string; deadline: string;
        score: number | null; feedback: string | null;
        graded_by: string | null; graded_at: string | null;
        learner_email: string; learner_full_name: string | null; learner_avatar_url: string | null;
        exam_title: string; passing_score: number; course_title: string;
      };
      const rawSubmissions = (data ?? []) as RpcRow[];

      // Resolve signed URLs in parallel (kept in frontend — storage signed URL
      // generation requires the user's session, not a service-role function)
      const submissions: GradingSubmission[] = await Promise.all(
        rawSubmissions.map(async (sub) => {
          let signedUrl = '';
          if (sub.file_url) {
            const { data } = await client.storage
              .from('exam-submissions')
              .createSignedUrl(sub.file_url, 3600);
            signedUrl = data?.signedUrl ?? '';
          }

          return {
            id: sub.submission_id,
            user_id: sub.user_id,
            tenant_id: sub.tenant_id,
            exam_id: sub.exam_id,
            course_id: sub.course_id,
            file_url: signedUrl,
            file_storage_path: sub.file_url,
            submitted_at: sub.submitted_at,
            deadline: sub.deadline,
            score: sub.score,
            feedback: sub.feedback,
            graded_by: sub.graded_by,
            graded_at: sub.graded_at,
            learner_email: sub.learner_email,
            learner_name: sub.learner_full_name,
            learner_avatar_url: sub.learner_avatar_url,
            course_title: sub.course_title,
            exam_title: sub.exam_title,
            passing_score: sub.passing_score,
          };
        }),
      );

      // Batch-resolve learner avatar URLs
      const avatarWrappers = submissions.map(s => ({ avatar_url: s.learner_avatar_url }));
      await resolveAvatarUrls(this.#supabase.client, avatarWrappers);
      for (let i = 0; i < submissions.length; i++) {
        submissions[i].learner_avatar_url = avatarWrappers[i].avatar_url;
      }

      // Derive course list from submissions (only courses with actual submissions)
      const courseMap = new Map<string, string>();
      for (const sub of submissions) {
        if (!courseMap.has(sub.course_id)) {
          courseMap.set(sub.course_id, sub.course_title);
        }
      }
      const courses: GradingCourseSummary[] = Array.from(courseMap.entries())
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));

      this.#submissions.set(submissions);
      this.#courses.set(courses);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load grading data'));
    } finally {
      this.#loading.set(false);
    }
  }

  async gradeSubmission(submissionId: string, payload: GradeExamPayload) {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('exam_submissions')
      .update({
        score: payload.score,
        feedback: payload.feedback,
        graded_by: user.id,
        graded_at: new Date().toISOString(),
      })
      .eq('id', submissionId);

    if (error) throw new Error(error.message || 'Failed to grade submission');
  }

  async resetSubmission(submissionId: string) {
    const submission = this.#submissions().find(s => s.id === submissionId);

    const { error } = await this.#supabase.client
      .from('exam_submissions')
      .delete()
      .eq('id', submissionId);

    if (error) throw new Error(error.message || 'Failed to reset submission');

    // Clean up storage file (fire-and-forget)
    if (submission?.file_storage_path) {
      this.#supabase.client.storage
        .from('exam-submissions')
        .remove([submission.file_storage_path])
        .then(() => {})
        .catch(() => console.warn('Storage cleanup failed for', submission.file_storage_path));
    }
  }
}
