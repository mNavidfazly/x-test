import { KnowledgeCheckQuestionFormData, KnowledgeCheckOption } from '../../../core/models/knowledge-check.model';

export type KnowledgeCheckValidationResult =
  | { ok: true; data: KnowledgeCheckQuestionFormData[] }
  | { ok: false; errors: string[] };

const VALID_TYPES = ['single_choice', 'true_false'] as const;

/**
 * Validates and normalizes a parsed JSON object into KnowledgeCheckQuestionFormData[].
 * Accepts both { questions: [...] } wrapper and bare array formats.
 * Accepts both camelCase and snake_case property names.
 */
export function validateKnowledgeCheckJson(input: unknown): KnowledgeCheckValidationResult {
  const errors: string[] = [];

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: ['Input must be a JSON object or array.'] };
  }

  // Accept bare array or { questions: [...] }
  let rawQuestions: unknown[];
  if (Array.isArray(input)) {
    rawQuestions = input;
  } else {
    const obj = input as Record<string, unknown>;
    const qs = obj['questions'];
    if (!Array.isArray(qs)) {
      return { ok: false, errors: ['Missing or invalid "questions" array.'] };
    }
    rawQuestions = qs;
  }

  if (rawQuestions.length === 0) {
    return { ok: false, errors: ['Questions array must not be empty.'] };
  }

  const parsed: KnowledgeCheckQuestionFormData[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw = rawQuestions[i];
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`Question ${i + 1}: must be an object.`);
      continue;
    }

    const q = raw as Record<string, unknown>;

    // question text (camelCase or snake_case)
    const questionText = getString(q, 'questionText', 'question_text');
    if (!questionText) {
      errors.push(`Question ${i + 1}: missing or empty "questionText".`);
      continue;
    }

    // question type
    const rawType = getString(q, 'questionType', 'question_type') ?? 'single_choice';
    if (!VALID_TYPES.includes(rawType as any)) {
      errors.push(`Question ${i + 1}: invalid questionType "${rawType}". Must be "single_choice" or "true_false".`);
      continue;
    }
    const questionType = rawType as 'single_choice' | 'true_false';

    // options
    const rawOptions = Array.isArray(q['options']) ? q['options'] : [];
    const options: KnowledgeCheckOption[] = [];
    for (const opt of rawOptions) {
      if (opt != null && typeof opt === 'object' && !Array.isArray(opt)) {
        const o = opt as Record<string, unknown>;
        options.push({
          text: typeof o['text'] === 'string' ? o['text'] : '',
          isCorrect: typeof o['isCorrect'] === 'boolean' ? o['isCorrect'] : (typeof o['is_correct'] === 'boolean' ? o['is_correct'] : false),
        });
      }
    }

    // Validate option count
    if (questionType === 'true_false') {
      if (options.length !== 2) {
        errors.push(`Question ${i + 1}: true_false must have exactly 2 options.`);
        continue;
      }
    } else {
      if (options.length < 2) {
        errors.push(`Question ${i + 1}: single_choice must have at least 2 options.`);
        continue;
      }
    }

    // Validate exactly one correct option
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      errors.push(`Question ${i + 1}: must have exactly 1 correct option (found ${correctCount}).`);
      continue;
    }

    // explanation
    const explanation = getString(q, 'explanation') || null;

    parsed.push({ questionText, questionType, options, explanation });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: parsed };
}

function getString(obj: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}
