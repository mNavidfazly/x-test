import { vi } from 'vitest';
import { KnowledgeCheckQuestion, KnowledgeCheckQuestionFormData, KnowledgeCheckResponse } from '../core/models/knowledge-check.model';

export function createMockKnowledgeCheckService() {
  return {
    loadQuestions: vi.fn().mockResolvedValue([]),
    submitAnswer: vi.fn().mockResolvedValue({
      questionId: 'q-1',
      selectedOptionIndex: 0,
      isCorrect: true,
      correctIndex: 0,
      explanation: null,
    } satisfies KnowledgeCheckResponse),
    loadMyResponses: vi.fn().mockResolvedValue(new Map()),
    loadQuestionsForEdit: vi.fn().mockResolvedValue([]),
    saveQuestions: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockKnowledgeCheckQuestion(overrides?: Partial<KnowledgeCheckQuestion>): KnowledgeCheckQuestion {
  return {
    id: 'kc-q-1',
    moduleId: 'mod-1',
    questionText: 'What is 2 + 2?',
    questionType: 'single_choice',
    options: [
      { text: '3' },
      { text: '4' },
      { text: '5' },
    ],
    explanation: null,
    orderIndex: 0,
    ...overrides,
  };
}

export function createMockKnowledgeCheckFormData(overrides?: Partial<KnowledgeCheckQuestionFormData>): KnowledgeCheckQuestionFormData {
  return {
    questionText: 'What is 2 + 2?',
    questionType: 'single_choice',
    options: [
      { text: '3', isCorrect: false },
      { text: '4', isCorrect: true },
      { text: '5', isCorrect: false },
    ],
    explanation: null,
    ...overrides,
  };
}
