import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  computeXp,
  getLevelForXp,
  LEVELS,
  XpRawData,
  XpService,
} from './xp.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

// ── Pure function tests ────────────────────────────────────────────

describe('computeXp', () => {
  const emptyData: XpRawData = {
    completedModules: 0,
    passedQuizAttempts: [],
    gradedExams: [],
    externalQuizPasses: 0,
    correctKnowledgeChecks: 0,
    comments: 0,
    replies: 0,
    expertQuestions: 0,
    enrollments: 0,
  };

  it('returns zero for empty input', () => {
    const result = computeXp(emptyData);
    expect(result.total).toBe(0);
    expect(result.modules).toBe(0);
    expect(result.quizzes).toBe(0);
    expect(result.exams).toBe(0);
    expect(result.knowledgeChecks).toBe(0);
    expect(result.engagement).toBe(0);
  });

  it('awards 10 XP per completed module', () => {
    const result = computeXp({ ...emptyData, completedModules: 5 });
    expect(result.modules).toBe(50);
    expect(result.total).toBe(50);
  });

  it('awards 25 XP for first quiz pass per quiz', () => {
    const result = computeXp({
      ...emptyData,
      passedQuizAttempts: [
        { quiz_id: 'q1', score: 100, created_at: '2025-01-01T00:00:00Z' },
      ],
    });
    // 25 base + 10 bonus (100/10)
    expect(result.quizzes).toBe(35);
  });

  it('awards 15 XP for subsequent quiz passes', () => {
    const result = computeXp({
      ...emptyData,
      passedQuizAttempts: [
        { quiz_id: 'q1', score: 80, created_at: '2025-01-01T00:00:00Z' },
        { quiz_id: 'q1', score: 90, created_at: '2025-01-02T00:00:00Z' },
      ],
    });
    // First: 25 + 8 = 33, Second: 15 + 9 = 24
    expect(result.quizzes).toBe(57);
  });

  it('detects first pass per quiz_id correctly', () => {
    const result = computeXp({
      ...emptyData,
      passedQuizAttempts: [
        { quiz_id: 'q1', score: 70, created_at: '2025-01-01T00:00:00Z' },
        { quiz_id: 'q2', score: 80, created_at: '2025-01-02T00:00:00Z' },
        { quiz_id: 'q1', score: 90, created_at: '2025-01-03T00:00:00Z' },
      ],
    });
    // q1 first: 25+7=32, q2 first: 25+8=33, q1 second: 15+9=24
    expect(result.quizzes).toBe(89);
  });

  it('awards exam XP with score bonus', () => {
    const result = computeXp({
      ...emptyData,
      gradedExams: [{ score: 85 }],
    });
    // 50 + 85/5=17
    expect(result.exams).toBe(67);
  });

  it('awards 20 XP per external quiz pass', () => {
    const result = computeXp({ ...emptyData, externalQuizPasses: 3 });
    expect(result.exams).toBe(60);
  });

  it('awards 5 XP per correct knowledge check', () => {
    const result = computeXp({ ...emptyData, correctKnowledgeChecks: 10 });
    expect(result.knowledgeChecks).toBe(50);
  });

  it('calculates engagement XP correctly', () => {
    const result = computeXp({
      ...emptyData,
      comments: 5,
      replies: 3,
      expertQuestions: 2,
      enrollments: 4,
    });
    // 5*3 + 3*2 + 2*5 + 4*5 = 15 + 6 + 10 + 20 = 51
    expect(result.engagement).toBe(51);
  });

  it('sums all categories into total', () => {
    const result = computeXp({
      completedModules: 10,
      passedQuizAttempts: [
        { quiz_id: 'q1', score: 100, created_at: '2025-01-01T00:00:00Z' },
      ],
      gradedExams: [{ score: 90 }],
      externalQuizPasses: 1,
      correctKnowledgeChecks: 5,
      comments: 2,
      replies: 1,
      expertQuestions: 1,
      enrollments: 2,
    });
    const modules = 100;
    const quizzes = 25 + 10; // first pass + 100/10 bonus
    const exams = 50 + 18 + 20; // exam + score/5 bonus + ext quiz
    const kc = 25;
    const engagement = 6 + 2 + 5 + 10;
    expect(result.total).toBe(modules + quizzes + exams + kc + engagement);
  });

  it('handles zero score on passed quiz', () => {
    const result = computeXp({
      ...emptyData,
      passedQuizAttempts: [
        { quiz_id: 'q1', score: 0, created_at: '2025-01-01T00:00:00Z' },
      ],
    });
    expect(result.quizzes).toBe(25); // 25 base, 0 bonus
  });
});

// ── getLevelForXp ──────────────────────────────────────────────────

describe('getLevelForXp', () => {
  it('returns Newcomer for 0 XP', () => {
    expect(getLevelForXp(0).name).toBe('Newcomer');
  });

  it('returns Explorer at exactly 50 XP', () => {
    expect(getLevelForXp(50).name).toBe('Explorer');
  });

  it('returns Learner at 149 XP', () => {
    expect(getLevelForXp(149).name).toBe('Explorer');
  });

  it('returns Learner at 150 XP', () => {
    expect(getLevelForXp(150).name).toBe('Learner');
  });

  it('returns Legend at 5000+ XP', () => {
    expect(getLevelForXp(9999).name).toBe('Legend');
  });

  it('returns correct level for mid-range XP', () => {
    expect(getLevelForXp(1500).name).toBe('Specialist');
    expect(getLevelForXp(2500).name).toBe('Master');
    expect(getLevelForXp(3500).name).toBe('Champion');
  });
});

// ── XpService ──────────────────────────────────────────────────────

describe('XpService', () => {
  let service: XpService;
  let mockAuth: ReturnType<typeof createMockAuthService>;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    mockAuth = createMockAuthService({ isAuthenticated: false });
    mockSupabase = createMockSupabaseService();

    TestBed.configureTestingModule({
      providers: [
        XpService,
        { provide: AuthService, useValue: mockAuth },
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    });
    service = TestBed.inject(XpService);
  });

  it('starts with zero XP', () => {
    expect(service.totalXp()).toBe(0);
    expect(service.currentLevel().name).toBe('Newcomer');
  });

  it('progressToNext returns 0 at level 1 with 0 XP', () => {
    expect(service.progressToNext()).toBe(0);
  });

  it('nextLevel returns Explorer for Newcomer', () => {
    expect(service.nextLevel()?.name).toBe('Explorer');
  });

  it('dismissLevelUp clears the signal', () => {
    // Directly test the dismiss method
    service.dismissLevelUp();
    expect(service.levelUp()).toBeNull();
  });

  it('loading is initially false', () => {
    expect(service.loading()).toBe(false);
  });
});
