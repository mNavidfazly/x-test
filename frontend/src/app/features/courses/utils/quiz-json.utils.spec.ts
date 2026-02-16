import { describe, it, expect } from 'vitest';
import { validateQuizJson } from './quiz-json.utils';
import { QUIZ_JSON_TEMPLATE } from './quiz-json-template';

describe('validateQuizJson', () => {
  // Helper to build a minimal valid quiz
  function minimalQuiz(overrides?: Record<string, unknown>) {
    return {
      title: 'Test Quiz',
      questions: [
        {
          question_text: 'Is this valid?',
          question_type: 'true_false',
          options: [
            { option_text: 'True', is_correct: true, sort_order: 0 },
            { option_text: 'False', is_correct: false, sort_order: 1 },
          ],
        },
      ],
      ...overrides,
    };
  }

  // --- Happy path ---

  it('should parse the full template with all 6 types', () => {
    const result = validateQuizJson(JSON.parse(QUIZ_JSON_TEMPLATE));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Sample Quiz');
    expect(result.data.questions).toHaveLength(6);
    expect(result.data.questions.map(q => q.question_type)).toEqual([
      'single_choice', 'multiple_choice', 'true_false',
      'fill_blank', 'short_answer', 'matching',
    ]);
  });

  it('should accept a minimal quiz and apply defaults', () => {
    const result = validateQuizJson(minimalQuiz());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.passing_score).toBe(70);
    expect(result.data.show_correct_answers).toBe(true);
    expect(result.data.randomize_questions).toBe(false);
    expect(result.data.randomize_answers).toBe(false);
    expect(result.data.time_limit).toBeNull();
    expect(result.data.max_attempts).toBeNull();
    expect(result.data.description).toBeNull();
  });

  it('should auto-assign sort_order from array index when missing', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [
        { question_text: 'Q1', question_type: 'fill_blank', correct_answer: 'A' },
        { question_text: 'Q2', question_type: 'fill_blank', correct_answer: 'B' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].sort_order).toBe(0);
    expect(result.data.questions[1].sort_order).toBe(1);
  });

  it('should default points to 1 when missing', () => {
    const result = validateQuizJson(minimalQuiz());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].points).toBe(1);
  });

  it('should preserve explicit settings values', () => {
    const result = validateQuizJson(minimalQuiz({
      time_limit: 600,
      passing_score: 80,
      max_attempts: 5,
      show_correct_answers: false,
      randomize_questions: true,
      randomize_answers: true,
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.time_limit).toBe(600);
    expect(result.data.passing_score).toBe(80);
    expect(result.data.max_attempts).toBe(5);
    expect(result.data.show_correct_answers).toBe(false);
    expect(result.data.randomize_questions).toBe(true);
    expect(result.data.randomize_answers).toBe(true);
  });

  // --- Per-type ---

  it('should validate single_choice with options', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Pick one',
        question_type: 'single_choice',
        options: [
          { option_text: 'A', is_correct: true },
          { option_text: 'B', is_correct: false },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].options).toHaveLength(2);
    expect(result.data.questions[0].options[0].is_correct).toBe(true);
  });

  it('should validate multiple_choice with multiple correct', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Pick many',
        question_type: 'multiple_choice',
        options: [
          { option_text: 'A', is_correct: true },
          { option_text: 'B', is_correct: true },
          { option_text: 'C', is_correct: false },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].options.filter(o => o.is_correct)).toHaveLength(2);
  });

  it('should validate true_false with 2 options', () => {
    const result = validateQuizJson(minimalQuiz());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].options).toHaveLength(2);
  });

  it('should validate fill_blank with correct_answer', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Fill', question_type: 'fill_blank', correct_answer: 'answer' }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].correct_answer).toBe('answer');
  });

  it('should validate short_answer with correct_answer', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Short', question_type: 'short_answer', correct_answer: 'answer' }],
    });
    expect(result.ok).toBe(true);
  });

  it('should validate matching with JSON correct_answer', () => {
    const pairs = JSON.stringify([{ left: 'A', right: '1' }]);
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Match', question_type: 'matching', correct_answer: pairs }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].correct_answer).toBe(pairs);
  });

  // --- Errors ---

  it('should reject non-object input', () => {
    expect(validateQuizJson(null).ok).toBe(false);
    expect(validateQuizJson('string').ok).toBe(false);
    expect(validateQuizJson(42).ok).toBe(false);
    expect(validateQuizJson([]).ok).toBe(false);
  });

  it('should reject missing title', () => {
    const result = validateQuizJson({ questions: [{ question_text: 'Q', question_type: 'fill_blank', correct_answer: 'A' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('should reject empty title', () => {
    const result = validateQuizJson({ title: '  ', questions: [{ question_text: 'Q', question_type: 'fill_blank', correct_answer: 'A' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('should reject missing questions array', () => {
    const result = validateQuizJson({ title: 'Test' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('questions'))).toBe(true);
  });

  it('should reject empty questions array', () => {
    const result = validateQuizJson({ title: 'Test', questions: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
  });

  it('should reject invalid question_type', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Q', question_type: 'essay' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('essay') && e.includes('invalid'))).toBe(true);
  });

  it('should reject empty question_text', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: '', question_type: 'fill_blank', correct_answer: 'A' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('question_text'))).toBe(true);
  });

  it('should reject choice type with fewer than 2 options', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Q',
        question_type: 'single_choice',
        options: [{ option_text: 'A', is_correct: true }],
      }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('2 options'))).toBe(true);
  });

  it('should reject fill_blank with empty correct_answer', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Q', question_type: 'fill_blank', correct_answer: '' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('correct_answer'))).toBe(true);
  });

  it('should reject matching with invalid JSON correct_answer', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Q', question_type: 'matching', correct_answer: 'not json' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('JSON'))).toBe(true);
  });

  it('should reject matching with empty pairs array', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{ question_text: 'Q', question_type: 'matching', correct_answer: '[]' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some(e => e.includes('non-empty'))).toBe(true);
  });

  // --- Explanation ---

  it('should parse explanation field from JSON when present', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Q',
        question_type: 'fill_blank',
        correct_answer: 'A',
        explanation: 'Because A is correct.',
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].explanation).toBe('Because A is correct.');
  });

  it('should default explanation to null when absent', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Q',
        question_type: 'fill_blank',
        correct_answer: 'A',
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].explanation).toBeNull();
  });

  // --- Sort order ---

  it('should auto-assign option sort_order from index when missing', () => {
    const result = validateQuizJson({
      title: 'Test',
      questions: [{
        question_text: 'Q',
        question_type: 'single_choice',
        options: [
          { option_text: 'A', is_correct: true },
          { option_text: 'B', is_correct: false },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.questions[0].options[0].sort_order).toBe(0);
    expect(result.data.questions[0].options[1].sort_order).toBe(1);
  });
});
