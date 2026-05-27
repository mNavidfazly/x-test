import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { ExpertQuestion, ExpertQuestionForBoard, BoardCourseSummary, QuestionAsker } from '../models/expert-question.model';
import { extractErrorMessage } from '../utils/error.utils';
import { resolveAvatarUrls } from '../utils/avatar.utils';

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
      this.#error.set(extractErrorMessage(err, 'Failed to load questions'));
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

    if (error) throw new Error(extractErrorMessage(error, 'Failed to submit question'));
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

      // Single RPC replaces unbounded SELECT with 3-table embed.
      // Permission gating (PA/TA/CSM/Lecturer) enforced server-side.
      // See migration 00062.
      const { data, error } = await client.rpc('get_questions_board_data');
      if (error) throw error;

      type RpcRow = {
        question_id: string; user_id: string; tenant_id: string;
        course_id: string; module_id: string | null;
        question_text: string; status: string;
        response_text: string | null; responded_by: string | null; responded_at: string | null;
        created_at: string;
        course_title: string | null; module_title: string | null;
        asker_full_name: string | null; asker_email: string | null; asker_avatar_url: string | null;
      };
      const rows = (data ?? []) as RpcRow[];

      const questions = rows.map(r => ({
        id: r.question_id,
        user_id: r.user_id,
        tenant_id: r.tenant_id,
        course_id: r.course_id,
        module_id: r.module_id,
        question_text: r.question_text,
        status: r.status,
        response_text: r.response_text,
        responded_by: r.responded_by,
        responded_at: r.responded_at,
        created_at: r.created_at,
        course: r.course_title ? { title: r.course_title } : null,
        module: r.module_title ? { title: r.module_title } : null,
        asker: r.asker_email ? {
          full_name: r.asker_full_name,
          email: r.asker_email,
          avatar_url: r.asker_avatar_url,
        } : null,
      })) as unknown as ExpertQuestionForBoard[];

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

      const askers = questions.map(q => q.asker).filter(Boolean) as QuestionAsker[];
      await resolveAvatarUrls(this.#supabase.client, askers);

      this.#boardQuestions.set(questions);
      this.#boardCourses.set(courses);
    } catch (err) {
      this.#boardError.set(extractErrorMessage(err, 'Failed to load questions'));
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
