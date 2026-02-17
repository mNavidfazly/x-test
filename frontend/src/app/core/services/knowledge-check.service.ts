import { inject, Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { extractErrorMessage } from '../utils/error.utils';
import {
  KnowledgeCheckOption,
  KnowledgeCheckQuestion,
  KnowledgeCheckQuestionFormData,
  KnowledgeCheckResponse,
} from '../models/knowledge-check.model';

@Injectable({ providedIn: 'root' })
export class KnowledgeCheckService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  // --- Learner methods ---

  async loadQuestions(moduleId: string): Promise<KnowledgeCheckQuestion[]> {
    const { data, error } = await this.#supabase.client
      .from('knowledge_check_questions_safe')
      .select('id, module_id, question_text, question_type, options, order_index')
      .eq('module_id', moduleId)
      .order('order_index');
    if (error) throw new Error(extractErrorMessage(error, 'Failed to load knowledge check questions'));
    return (data ?? []).map((row) => ({
      id: row.id!,
      moduleId: row.module_id!,
      questionText: row.question_text!,
      questionType: row.question_type as 'single_choice' | 'true_false',
      options: (row.options as unknown as KnowledgeCheckOption[]) ?? [],
      explanation: null,
      orderIndex: row.order_index!,
    }));
  }

  async submitAnswer(questionId: string, selectedIndex: number): Promise<KnowledgeCheckResponse> {
    const { data, error } = await this.#supabase.client.rpc('check_knowledge_answer', {
      p_question_id: questionId,
      p_selected_index: selectedIndex,
    });
    if (error) throw new Error(extractErrorMessage(error, 'Failed to submit answer'));
    const result = data as unknown as { is_correct: boolean; correct_index: number; explanation: string | null };
    return {
      questionId,
      selectedOptionIndex: selectedIndex,
      isCorrect: result.is_correct,
      correctIndex: result.correct_index,
      explanation: result.explanation,
    };
  }

  async loadMyResponses(moduleId: string): Promise<Map<string, KnowledgeCheckResponse>> {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return new Map();

    const { data, error } = await this.#supabase.client
      .from('knowledge_check_responses')
      .select('question_id, selected_option_index, is_correct, knowledge_check_questions!inner(module_id, explanation, options)')
      .eq('knowledge_check_questions.module_id', moduleId)
      .eq('user_id', userId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to load responses'));

    const map = new Map<string, KnowledgeCheckResponse>();
    for (const row of data ?? []) {
      const q = (row as any).knowledge_check_questions;
      const options = (q.options as KnowledgeCheckOption[]) ?? [];
      const correctIndex = options.findIndex((o) => o.isCorrect === true);
      map.set(row.question_id, {
        questionId: row.question_id,
        selectedOptionIndex: row.selected_option_index,
        isCorrect: row.is_correct,
        correctIndex,
        explanation: q.explanation,
      });
    }
    return map;
  }

  // --- Editor methods (lecturer/PA) ---

  async loadQuestionsForEdit(moduleId: string): Promise<KnowledgeCheckQuestion[]> {
    const { data, error } = await this.#supabase.client
      .from('knowledge_check_questions')
      .select('id, module_id, question_text, question_type, options, explanation, order_index')
      .eq('module_id', moduleId)
      .order('order_index');
    if (error) throw new Error(extractErrorMessage(error, 'Failed to load questions for editing'));
    return (data ?? []).map((row) => ({
      id: row.id,
      moduleId: row.module_id,
      questionText: row.question_text,
      questionType: row.question_type as 'single_choice' | 'true_false',
      options: (row.options as unknown as KnowledgeCheckOption[]) ?? [],
      explanation: row.explanation,
      orderIndex: row.order_index,
    }));
  }

  async saveQuestions(moduleId: string, questions: KnowledgeCheckQuestionFormData[]): Promise<void> {
    // Delete-then-reinsert pattern (same as quiz questions)
    const { error: delErr } = await this.#supabase.client
      .from('knowledge_check_questions')
      .delete()
      .eq('module_id', moduleId);
    if (delErr) throw new Error(extractErrorMessage(delErr, 'Failed to clear old questions'));

    if (questions.length === 0) return;

    const rows = questions.map((q, i) => ({
      module_id: moduleId,
      question_text: q.questionText,
      question_type: q.questionType,
      options: q.options as unknown as Record<string, unknown>,
      explanation: q.explanation ?? null,
      order_index: i,
    }));

    const { error: insErr } = await this.#supabase.client
      .from('knowledge_check_questions')
      .insert(rows);
    if (insErr) throw new Error(extractErrorMessage(insErr, 'Failed to save questions'));
  }
}
