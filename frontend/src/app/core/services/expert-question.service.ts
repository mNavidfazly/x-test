import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ExpertQuestion, ExpertQuestionForBoard, BoardCourseSummary } from '../models/expert-question.model';

@Injectable({ providedIn: 'root' })
export class ExpertQuestionService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  // --- Learner signals (My Questions) ---
  #questions = signal<ExpertQuestion[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly questions = this.#questions.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  // --- Board signals (Lecturer / Platform Admin) ---
  #boardQuestions = signal<ExpertQuestionForBoard[]>([]);
  #boardCourses = signal<BoardCourseSummary[]>([]);
  #boardLoading = signal(false);
  #boardError = signal('');

  readonly boardQuestions = this.#boardQuestions.asReadonly();
  readonly boardCourses = this.#boardCourses.asReadonly();
  readonly boardLoading = this.#boardLoading.asReadonly();
  readonly boardError = this.#boardError.asReadonly();

  async loadMyQuestions(): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) return;

    this.#loading.set(true);
    this.#error.set('');

    try {
      const { data, error } = await this.#supabase.client
        .from('expert_questions')
        .select(`
          *,
          course:courses!course_id(title),
          module:modules!module_id(title),
          responder:profiles!responded_by(full_name, email)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const questions = (data ?? []).map((q: any) => ({
        ...q,
        course: q.course ?? null,
        module: q.module ?? null,
        responder: q.responder ?? null,
      })) as ExpertQuestion[];

      this.#questions.set(questions);
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
      this.#error.set(msg || 'Failed to load questions');
    } finally {
      this.#loading.set(false);
    }
  }

  async askQuestion(courseId: string, moduleId: string | null, questionText: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('expert_questions')
      .insert({
        course_id: courseId,
        module_id: moduleId,
        user_id: user.id,
        tenant_id: user.claims.tenant_id,
        question_text: questionText,
      });

    if (error) throw new Error(error.message);
    await this.loadMyQuestions();
  }

  // --- Board methods (Lecturer / Platform Admin) ---

  async loadBoardQuestions(): Promise<void> {
    this.#boardLoading.set(true);
    this.#boardError.set('');

    try {
      const client = this.#supabase.client;
      const user = this.#auth.currentUser();
      if (!user) throw new Error('Not authenticated');

      // RLS auto-scopes: lecturer sees assigned courses cross-tenant, PA sees all
      const { data, error } = await client
        .from('expert_questions')
        .select(`
          *,
          course:courses!course_id(title),
          module:modules!module_id(title),
          asker:profiles!user_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const questions = (data ?? []).map((q: any) => ({
        ...q,
        course: q.course ?? null,
        module: q.module ?? null,
        asker: q.asker ?? null,
      })) as ExpertQuestionForBoard[];

      // Derive course list from question data (Map dedup + sort)
      const courseMap = new Map<string, string>();
      for (const q of questions) {
        if (!courseMap.has(q.course_id)) {
          courseMap.set(q.course_id, q.course?.title ?? 'Unknown');
        }
      }
      const courses: BoardCourseSummary[] = Array.from(courseMap.entries())
        .map(([id, title]) => ({ id, title }))
        .sort((a, b) => a.title.localeCompare(b.title));

      this.#boardQuestions.set(questions);
      this.#boardCourses.set(courses);
    } catch (err) {
      this.#boardError.set(
        err instanceof Error ? err.message :
        typeof err === 'object' && err && 'message' in err ? String((err as any).message) :
        'Failed to load questions',
      );
    } finally {
      this.#boardLoading.set(false);
    }
  }

  async respondToQuestion(questionId: string, responseText: string): Promise<void> {
    const user = this.#auth.currentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await this.#supabase.client
      .from('expert_questions')
      .update({
        response_text: responseText,
        responded_by: user.id,
        responded_at: new Date().toISOString(),
        status: 'answered' as const,
      })
      .eq('id', questionId);

    if (error) throw new Error(error.message || 'Failed to respond to question');
  }

  async closeQuestion(questionId: string): Promise<void> {
    const { error } = await this.#supabase.client
      .from('expert_questions')
      .update({ status: 'closed' as const })
      .eq('id', questionId);

    if (error) throw new Error(error.message || 'Failed to close question');
  }
}
