import {
  QuizFormData, QuizQuestionFormData, QuizOptionFormData, QuizQuestionType,
} from '../../../core/models/course.model';

export type QuizValidationResult =
  | { ok: true; data: QuizFormData }
  | { ok: false; errors: string[] };

const VALID_TYPES: QuizQuestionType[] = [
  'single_choice', 'multiple_choice', 'true_false',
  'fill_blank', 'short_answer', 'matching',
];

const CHOICE_TYPES: QuizQuestionType[] = ['single_choice', 'multiple_choice', 'true_false'];

export function validateQuizJson(raw: unknown): QuizValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['Input must be a JSON object.'] };
  }

  const obj = raw as Record<string, unknown>;

  // Title (required)
  const title = typeof obj['title'] === 'string' ? obj['title'].trim() : '';
  if (!title) {
    errors.push('Missing or empty "title".');
  }

  // Description (optional)
  const description = typeof obj['description'] === 'string' ? obj['description'] : null;

  // Settings with defaults
  const time_limit = typeof obj['time_limit'] === 'number' ? obj['time_limit'] : null;
  const passing_score = typeof obj['passing_score'] === 'number' ? obj['passing_score'] : 70;
  const max_attempts = typeof obj['max_attempts'] === 'number' ? obj['max_attempts'] : null;
  const show_correct_answers = typeof obj['show_correct_answers'] === 'boolean' ? obj['show_correct_answers'] : true;
  const randomize_questions = typeof obj['randomize_questions'] === 'boolean' ? obj['randomize_questions'] : false;
  const randomize_answers = typeof obj['randomize_answers'] === 'boolean' ? obj['randomize_answers'] : false;

  // Questions (required, non-empty)
  if (!Array.isArray(obj['questions'])) {
    errors.push('Missing "questions" array.');
    return { ok: false, errors };
  }

  const rawQuestions = obj['questions'] as unknown[];
  if (rawQuestions.length === 0) {
    errors.push('"questions" array must not be empty.');
    return { ok: false, errors };
  }

  const questions: QuizQuestionFormData[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i];
    const label = `Question ${i + 1}`;

    if (!q || typeof q !== 'object' || Array.isArray(q)) {
      errors.push(`${label}: must be an object.`);
      continue;
    }

    const qObj = q as Record<string, unknown>;

    // question_text
    const questionText = typeof qObj['question_text'] === 'string' ? qObj['question_text'].trim() : '';
    if (!questionText) {
      errors.push(`${label}: missing or empty "question_text".`);
    }

    // question_type
    const questionType = qObj['question_type'] as string;
    if (!VALID_TYPES.includes(questionType as QuizQuestionType)) {
      errors.push(`${label}: invalid "question_type" "${questionType}". Valid: ${VALID_TYPES.join(', ')}`);
      continue;
    }

    // points (default 1)
    const points = typeof qObj['points'] === 'number' ? qObj['points'] : 1;

    // sort_order (default from index)
    const sortOrder = typeof qObj['sort_order'] === 'number' ? qObj['sort_order'] : i;

    // correct_answer
    const correctAnswer = typeof qObj['correct_answer'] === 'string' ? qObj['correct_answer'] : null;

    // options
    const rawOptions = Array.isArray(qObj['options']) ? (qObj['options'] as unknown[]) : [];
    const options: QuizOptionFormData[] = [];

    for (let j = 0; j < rawOptions.length; j++) {
      const o = rawOptions[j];
      if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
      const oObj = o as Record<string, unknown>;
      options.push({
        option_text: typeof oObj['option_text'] === 'string' ? oObj['option_text'] : '',
        is_correct: typeof oObj['is_correct'] === 'boolean' ? oObj['is_correct'] : false,
        sort_order: typeof oObj['sort_order'] === 'number' ? oObj['sort_order'] : j,
      });
    }

    // Per-type validation
    const type = questionType as QuizQuestionType;

    if (CHOICE_TYPES.includes(type)) {
      if (options.length < 2) {
        errors.push(`${label}: "${type}" requires at least 2 options.`);
      }
      if (type === 'true_false' && options.length !== 2) {
        errors.push(`${label}: "true_false" must have exactly 2 options.`);
      }
    }

    if (type === 'fill_blank' || type === 'short_answer') {
      if (!correctAnswer?.trim()) {
        errors.push(`${label}: "${type}" requires a non-empty "correct_answer".`);
      }
    }

    if (type === 'matching') {
      if (!correctAnswer) {
        errors.push(`${label}: "matching" requires a "correct_answer" with JSON pairs.`);
      } else {
        try {
          const pairs = JSON.parse(correctAnswer) as unknown[];
          if (!Array.isArray(pairs) || pairs.length === 0) {
            errors.push(`${label}: "matching" correct_answer must be a non-empty array of {left, right} pairs.`);
          }
        } catch {
          errors.push(`${label}: "matching" correct_answer is not valid JSON.`);
        }
      }
    }

    const explanation: string | null = typeof qObj['explanation'] === 'string' ? qObj['explanation'].trim() || null : null;

    questions.push({
      question_text: questionText,
      question_type: type,
      points,
      sort_order: sortOrder,
      correct_answer: correctAnswer,
      explanation,
      options,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      title,
      description,
      time_limit,
      passing_score,
      max_attempts,
      show_correct_answers,
      randomize_questions,
      randomize_answers,
      questions,
    },
  };
}
