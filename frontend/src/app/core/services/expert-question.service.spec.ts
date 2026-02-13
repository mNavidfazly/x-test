import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ExpertQuestionService } from './expert-question.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('ExpertQuestionService', () => {
  let service: ExpertQuestionService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1', tenantId: 'tenant-1', claims: { tenant_id: 'tenant-1' } });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ExpertQuestionService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(ExpertQuestionService);
  });

  it('should have empty initial state', () => {
    expect(service.questions()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadMyQuestions', () => {
    it('should load questions with joined data', async () => {
      const mockQuestions = [
        {
          id: 'eq-1', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: 'mod-1',
          question_text: 'How does this work?', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-01T10:00:00Z',
          course: { title: 'Test Course' },
          module: { title: 'Test Module' },
          responder: null,
        },
      ];
      supabase._mockQueryResponse(mockQuestions);

      await service.loadMyQuestions();

      expect(service.questions().length).toBe(1);
      expect(service.questions()[0].question_text).toBe('How does this work?');
      expect(service.questions()[0].course?.title).toBe('Test Course');
      expect(service.questions()[0].module?.title).toBe('Test Module');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should handle null FK joins gracefully', async () => {
      const mockQuestions = [
        {
          id: 'eq-2', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: null,
          question_text: 'General question', status: 'answered',
          response_text: 'Here is the answer', responded_by: 'lecturer-1', responded_at: '2026-02-02T10:00:00Z',
          created_at: '2026-02-01T10:00:00Z',
          course: null, module: null, responder: null,
        },
      ];
      supabase._mockQueryResponse(mockQuestions);

      await service.loadMyQuestions();

      expect(service.questions()[0].course).toBeNull();
      expect(service.questions()[0].module).toBeNull();
      expect(service.questions()[0].responder).toBeNull();
    });

    it('should handle empty list', async () => {
      supabase._mockQueryResponse([]);

      await service.loadMyQuestions();

      expect(service.questions()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'DB error' });

      await service.loadMyQuestions();

      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after error', async () => {
      supabase._mockQueryResponse(null, { message: 'fail' });

      await service.loadMyQuestions();

      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExpertQuestionService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(ExpertQuestionService);

      await service.loadMyQuestions();

      expect(service.questions()).toEqual([]);
      expect(service.loading()).toBe(false);
    });
  });

  describe('askQuestion', () => {
    it('should insert question with correct fields', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.askQuestion('course-1', 'mod-1', 'My question');

      expect(supabase.client.from).toHaveBeenCalledWith('expert_questions');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          course_id: 'course-1',
          module_id: 'mod-1',
          user_id: 'user-1',
          tenant_id: 'tenant-1',
          question_text: 'My question',
        }),
      );
    });

    it('should insert with null module_id', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.askQuestion('course-1', null, 'Course-level question');

      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          module_id: null,
          question_text: 'Course-level question',
        }),
      );
    });

    it('should throw on unauthenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExpertQuestionService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(ExpertQuestionService);

      await expect(service.askQuestion('c1', 'mod-1', 'text')).rejects.toThrow('Not authenticated');
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Insert failed' } }),
      );

      await expect(service.askQuestion('c1', 'mod-1', 'text')).rejects.toThrow('Insert failed');
    });
  });

  // --- Board (Lecturer / Platform Admin) tests ---

  it('should have empty initial board state', () => {
    expect(service.boardQuestions()).toEqual([]);
    expect(service.boardCourses()).toEqual([]);
    expect(service.boardLoading()).toBe(false);
    expect(service.boardError()).toBe('');
  });

  describe('loadBoardQuestions', () => {
    it('should load questions with asker join', async () => {
      const mockData = [
        {
          id: 'eq-1', user_id: 'u1', tenant_id: 't1', course_id: 'c1', module_id: 'mod-1',
          question_text: 'Formula question', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-10T10:00:00Z',
          course: { title: 'X-LNG Advanced' },
          module: { title: 'Module 3' },
          asker: { full_name: 'Bob Santos', email: 'bob@santos.com' },
        },
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadBoardQuestions();

      expect(service.boardQuestions().length).toBe(1);
      expect(service.boardQuestions()[0].asker?.email).toBe('bob@santos.com');
      expect(service.boardQuestions()[0].course?.title).toBe('X-LNG Advanced');
      expect(service.boardLoading()).toBe(false);
      expect(service.boardError()).toBe('');
    });

    it('should handle null FK joins gracefully', async () => {
      const mockData = [
        {
          id: 'eq-2', user_id: 'u2', tenant_id: 't1', course_id: 'c1', module_id: null,
          question_text: 'General', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-10T10:00:00Z',
          course: null, module: null, asker: null,
        },
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadBoardQuestions();

      expect(service.boardQuestions()[0].course).toBeNull();
      expect(service.boardQuestions()[0].module).toBeNull();
      expect(service.boardQuestions()[0].asker).toBeNull();
    });

    it('should handle empty list', async () => {
      supabase._mockQueryResponse([]);

      await service.loadBoardQuestions();

      expect(service.boardQuestions()).toEqual([]);
      expect(service.boardCourses()).toEqual([]);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'Permission denied' });

      await service.loadBoardQuestions();

      expect(service.boardError()).toBe('Permission denied');
      expect(service.boardLoading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      supabase._mockQueryResponse([]);

      await service.loadBoardQuestions();

      expect(service.boardLoading()).toBe(false);
    });

    it('should derive courses sorted alphabetically', async () => {
      const mockData = [
        {
          id: 'eq-1', user_id: 'u1', tenant_id: 't1', course_id: 'c2', module_id: null,
          question_text: 'Q1', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-10T10:00:00Z',
          course: { title: 'Zebra Course' }, module: null, asker: null,
        },
        {
          id: 'eq-2', user_id: 'u2', tenant_id: 't1', course_id: 'c1', module_id: null,
          question_text: 'Q2', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-10T10:00:00Z',
          course: { title: 'Alpha Course' }, module: null, asker: null,
        },
        {
          id: 'eq-3', user_id: 'u3', tenant_id: 't1', course_id: 'c2', module_id: null,
          question_text: 'Q3', status: 'pending',
          response_text: null, responded_by: null, responded_at: null,
          created_at: '2026-02-10T10:00:00Z',
          course: { title: 'Zebra Course' }, module: null, asker: null,
        },
      ];
      supabase._mockQueryResponse(mockData);

      await service.loadBoardQuestions();

      expect(service.boardCourses().length).toBe(2);
      expect(service.boardCourses()[0].title).toBe('Alpha Course');
      expect(service.boardCourses()[1].title).toBe('Zebra Course');
    });

    it('should throw when not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExpertQuestionService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(ExpertQuestionService);

      await service.loadBoardQuestions();

      expect(service.boardError()).toBe('Not authenticated');
    });
  });

  describe('respondToQuestion', () => {
    it('should update with response fields', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: null }) => void) =>
        resolve({ data: null, error: null }),
      );

      await service.respondToQuestion('eq-1', 'Here is the answer');

      expect(supabase.client.from).toHaveBeenCalledWith('expert_questions');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          response_text: 'Here is the answer',
          responded_by: 'user-1',
          status: 'answered',
        }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'eq-1');
    });

    it('should throw when not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExpertQuestionService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(ExpertQuestionService);

      await expect(service.respondToQuestion('eq-1', 'answer')).rejects.toThrow('Not authenticated');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Update failed' } }),
      );

      await expect(service.respondToQuestion('eq-1', 'answer')).rejects.toThrow('Update failed');
    });
  });

  describe('closeQuestion', () => {
    it('should update status to closed', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: null }) => void) =>
        resolve({ data: null, error: null }),
      );

      await service.closeQuestion('eq-1');

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'closed' });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'eq-1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Close failed' } }),
      );

      await expect(service.closeQuestion('eq-1')).rejects.toThrow('Close failed');
    });
  });
});
