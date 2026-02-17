import { describe, it, expect } from 'vitest';
import { validateKnowledgeCheckJson } from './knowledge-check-json.utils';
import { KNOWLEDGE_CHECK_JSON_TEMPLATE } from './knowledge-check-json-template';

function minimalQuestion(overrides?: Record<string, unknown>) {
  return {
    questionText: 'Is this valid?',
    questionType: 'true_false',
    options: [
      { text: 'True', isCorrect: true },
      { text: 'False', isCorrect: false },
    ],
    ...overrides,
  };
}

describe('validateKnowledgeCheckJson', () => {
  describe('happy path', () => {
    it('should parse the template successfully', () => {
      const result = validateKnowledgeCheckJson(JSON.parse(KNOWLEDGE_CHECK_JSON_TEMPLATE));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].questionType).toBe('single_choice');
      expect(result.data[1].questionType).toBe('true_false');
    });

    it('should parse a minimal question with wrapper object', () => {
      const result = validateKnowledgeCheckJson({ questions: [minimalQuestion()] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].questionText).toBe('Is this valid?');
    });

    it('should accept a bare array of questions', () => {
      const result = validateKnowledgeCheckJson([minimalQuestion()]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveLength(1);
    });

    it('should accept snake_case property names', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          question_text: 'Snake case?',
          question_type: 'true_false',
          options: [
            { text: 'True', is_correct: true },
            { text: 'False', is_correct: false },
          ],
        }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0].questionText).toBe('Snake case?');
      expect(result.data[0].options[0].isCorrect).toBe(true);
    });

    it('should parse explanation when present', () => {
      const result = validateKnowledgeCheckJson({
        questions: [minimalQuestion({ explanation: 'Because reasons.' })],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0].explanation).toBe('Because reasons.');
    });

    it('should default explanation to null when absent', () => {
      const result = validateKnowledgeCheckJson({ questions: [minimalQuestion()] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0].explanation).toBeNull();
    });

    it('should parse single_choice with multiple options', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          questionText: 'Pick one',
          questionType: 'single_choice',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
            { text: 'C', isCorrect: false },
          ],
        }],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data[0].options).toHaveLength(3);
    });
  });

  describe('error cases', () => {
    it('should reject null input', () => {
      const result = validateKnowledgeCheckJson(null);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('object or array');
    });

    it('should reject non-object input', () => {
      const result = validateKnowledgeCheckJson('hello');
      expect(result.ok).toBe(false);
    });

    it('should reject missing questions array', () => {
      const result = validateKnowledgeCheckJson({ title: 'no questions' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('questions');
    });

    it('should reject empty questions array', () => {
      const result = validateKnowledgeCheckJson({ questions: [] });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('empty');
    });

    it('should reject question with empty text', () => {
      const result = validateKnowledgeCheckJson({
        questions: [minimalQuestion({ questionText: '' })],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('questionText');
    });

    it('should reject invalid question type', () => {
      const result = validateKnowledgeCheckJson({
        questions: [minimalQuestion({ questionType: 'multiple_choice' })],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('questionType');
    });

    it('should reject true_false with wrong option count', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          questionText: 'Q?',
          questionType: 'true_false',
          options: [{ text: 'True', isCorrect: true }],
        }],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('exactly 2');
    });

    it('should reject single_choice with fewer than 2 options', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          questionText: 'Q?',
          questionType: 'single_choice',
          options: [{ text: 'A', isCorrect: true }],
        }],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('at least 2');
    });

    it('should reject questions with no correct option', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          questionText: 'Q?',
          questionType: 'true_false',
          options: [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: false },
          ],
        }],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('exactly 1 correct');
    });

    it('should reject questions with multiple correct options', () => {
      const result = validateKnowledgeCheckJson({
        questions: [{
          questionText: 'Q?',
          questionType: 'single_choice',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: true },
          ],
        }],
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toContain('exactly 1 correct');
    });
  });
});
