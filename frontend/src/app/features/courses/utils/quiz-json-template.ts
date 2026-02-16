import { QuizFormData } from '../../../core/models/course.model';

const TEMPLATE_DATA: QuizFormData = {
  title: 'Sample Quiz',
  description: 'A sample quiz demonstrating all 6 question types',
  time_limit: 900,
  passing_score: 70,
  max_attempts: 3,
  show_correct_answers: true,
  randomize_questions: false,
  randomize_answers: false,
  questions: [
    {
      question_text: 'What is the capital of France?',
      question_type: 'single_choice',
      points: 2,
      sort_order: 0,
      correct_answer: null,
      explanation: 'Paris has been the capital of France since the 10th century.',
      options: [
        { option_text: 'London', is_correct: false, sort_order: 0 },
        { option_text: 'Paris', is_correct: true, sort_order: 1 },
        { option_text: 'Berlin', is_correct: false, sort_order: 2 },
      ],
    },
    {
      question_text: 'Which of the following are programming languages?',
      question_type: 'multiple_choice',
      points: 1,
      sort_order: 1,
      correct_answer: null,
      explanation: null,
      options: [
        { option_text: 'Python', is_correct: true, sort_order: 0 },
        { option_text: 'HTML', is_correct: false, sort_order: 1 },
        { option_text: 'JavaScript', is_correct: true, sort_order: 2 },
        { option_text: 'CSS', is_correct: false, sort_order: 3 },
      ],
    },
    {
      question_text: 'The Earth revolves around the Sun.',
      question_type: 'true_false',
      points: 1,
      sort_order: 2,
      correct_answer: null,
      explanation: null,
      options: [
        { option_text: 'True', is_correct: true, sort_order: 0 },
        { option_text: 'False', is_correct: false, sort_order: 1 },
      ],
    },
    {
      question_text: 'The chemical symbol for water is ___.',
      question_type: 'fill_blank',
      points: 1,
      sort_order: 3,
      correct_answer: 'H2O',
      explanation: 'H2O is the chemical formula — two hydrogen atoms bonded to one oxygen atom.',
      options: [],
    },
    {
      question_text: 'Describe the process of photosynthesis in one sentence.',
      question_type: 'short_answer',
      points: 2,
      sort_order: 4,
      correct_answer: 'The process by which green plants convert sunlight, carbon dioxide, and water into glucose and oxygen.',
      explanation: null,
      options: [],
    },
    {
      question_text: 'Match the countries to their capitals.',
      question_type: 'matching',
      points: 3,
      sort_order: 5,
      explanation: null,
      correct_answer: JSON.stringify([
        { left: 'France', right: 'Paris' },
        { left: 'Germany', right: 'Berlin' },
        { left: 'Spain', right: 'Madrid' },
      ]),
      options: [],
    },
  ],
};

export const QUIZ_JSON_TEMPLATE = JSON.stringify(TEMPLATE_DATA, null, 2);
