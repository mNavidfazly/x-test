import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { KnowledgeCheckService } from './knowledge-check.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('KnowledgeCheckService', () => {
  let service: KnowledgeCheckService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        KnowledgeCheckService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, userId: 'test-user-id' }) },
      ],
    });
    service = TestBed.inject(KnowledgeCheckService);
  });

  describe('loadQuestions', () => {
    it('should load questions from safe view', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [
            { id: 'q1', module_id: 'mod-1', question_text: 'Q1?', question_type: 'single_choice', options: [{ text: 'A' }, { text: 'B' }], order_index: 0 },
          ],
          error: null,
        }),
      );

      const result = await service.loadQuestions('mod-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q1');
      expect(result[0].questionText).toBe('Q1?');
      expect(result[0].options).toEqual([{ text: 'A' }, { text: 'B' }]);
      expect(supabase.client.from).toHaveBeenCalledWith('knowledge_check_questions_safe');
    });

    it('should return empty array when no questions', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      const result = await service.loadQuestions('mod-1');
      expect(result).toHaveLength(0);
    });

    it('should throw on error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'DB error' } }),
      );

      await expect(service.loadQuestions('mod-1')).rejects.toThrow('DB error');
    });
  });

  describe('submitAnswer', () => {
    it('should call RPC and return mapped response', async () => {
      supabase.client.rpc = vi.fn().mockResolvedValue({
        data: { is_correct: true, correct_index: 1, explanation: 'Nice!' },
        error: null,
      });

      const result = await service.submitAnswer('q1', 1);

      expect(result.isCorrect).toBe(true);
      expect(result.correctIndex).toBe(1);
      expect(result.explanation).toBe('Nice!');
      expect(supabase.client.rpc).toHaveBeenCalledWith('check_knowledge_answer', {
        p_question_id: 'q1',
        p_selected_index: 1,
      });
    });

    it('should throw on RPC error', async () => {
      supabase.client.rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not enrolled' },
      });

      await expect(service.submitAnswer('q1', 0)).rejects.toThrow('Not enrolled');
    });
  });

  describe('loadMyResponses', () => {
    it('should return Map of responses keyed by questionId', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [
            {
              question_id: 'q1',
              selected_option_index: 1,
              is_correct: true,
              knowledge_check_questions: {
                module_id: 'mod-1',
                explanation: 'Correct!',
                options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: true }],
              },
            },
          ],
          error: null,
        }),
      );

      const result = await service.loadMyResponses('mod-1');

      expect(result.size).toBe(1);
      const response = result.get('q1')!;
      expect(response.isCorrect).toBe(true);
      expect(response.correctIndex).toBe(1);
      expect(response.explanation).toBe('Correct!');
    });

    it('should return empty Map when not authenticated', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          KnowledgeCheckService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: false }) },
          ],
      });
      const unauthService = TestBed.inject(KnowledgeCheckService);

      const result = await unauthService.loadMyResponses('mod-1');
      expect(result.size).toBe(0);
    });
  });

  describe('loadQuestionsForEdit', () => {
    it('should load from base table with isCorrect', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [
            {
              id: 'q1', module_id: 'mod-1', question_text: 'Q?', question_type: 'true_false',
              options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
              explanation: 'Yes!', order_index: 0,
            },
          ],
          error: null,
        }),
      );

      const result = await service.loadQuestionsForEdit('mod-1');

      expect(result).toHaveLength(1);
      expect(result[0].options[0].isCorrect).toBe(true);
      expect(result[0].explanation).toBe('Yes!');
      expect(supabase.client.from).toHaveBeenCalledWith('knowledge_check_questions');
    });
  });

  describe('saveQuestions', () => {
    it('should delete existing and insert new questions', async () => {
      // First call (delete) resolves, second call (insert) resolves
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) => {
        callCount++;
        resolve({ data: callCount === 1 ? [] : null, error: null });
      });

      await service.saveQuestions('mod-1', [
        { questionText: 'Q?', questionType: 'single_choice', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], explanation: null },
      ]);

      expect(supabase.client.from).toHaveBeenCalledWith('knowledge_check_questions');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should only delete when questions array is empty', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: [], error: null }),
      );

      await service.saveQuestions('mod-1', []);

      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.insert).not.toHaveBeenCalled();
    });
  });
});
