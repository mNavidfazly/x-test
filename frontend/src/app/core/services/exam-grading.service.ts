import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { GradingSubmission, GradingCourseSummary, GradeExamPayload } from '../models/course.model';

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

      // RLS auto-scopes: lecturer sees only can_grade courses, PA sees all
      const submissionsRes = await client
        .from('exam_submissions')
        .select('id, user_id, tenant_id, exam_id, course_id, file_url, submitted_at, deadline, score, feedback, graded_by, graded_at, profiles!user_id(email, full_name), exams(title, passing_score), courses!course_id(title)')
        .order('submitted_at', { ascending: false });

      if (submissionsRes.error) throw submissionsRes.error;

      const rawSubmissions = (submissionsRes.data ?? []) as unknown as {
        id: string; user_id: string; tenant_id: string; exam_id: string; course_id: string;
        file_url: string; submitted_at: string; deadline: string;
        score: number | null; feedback: string | null; graded_by: string | null; graded_at: string | null;
        profiles: { email: string; full_name: string | null } | null;
        exams: { title: string; passing_score: number } | null;
        courses: { title: string } | null;
      }[];

      // Resolve signed URLs in parallel
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
            id: sub.id,
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
            learner_email: sub.profiles?.email ?? '',
            learner_name: sub.profiles?.full_name ?? null,
            course_title: sub.courses?.title ?? 'Unknown',
            exam_title: sub.exams?.title ?? 'Unknown',
            passing_score: sub.exams?.passing_score ?? 0,
          };
        }),
      );

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
      this.#error.set(
        err instanceof Error ? err.message :
        typeof err === 'object' && err && 'message' in err ? String((err as any).message) :
        'Failed to load grading data',
      );
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
