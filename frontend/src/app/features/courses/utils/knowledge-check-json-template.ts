const TEMPLATE_DATA = {
  questions: [
    {
      questionText: 'What is the capital of France?',
      questionType: 'single_choice',
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
        { text: 'Berlin', isCorrect: false },
      ],
      explanation: 'Paris has been the capital of France since the 10th century.',
    },
    {
      questionText: 'The Earth revolves around the Sun.',
      questionType: 'true_false',
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
    },
  ],
};

export const KNOWLEDGE_CHECK_JSON_TEMPLATE = JSON.stringify(TEMPLATE_DATA, null, 2);
