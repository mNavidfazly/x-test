export interface KnowledgeCheckOption {
  text: string;
  isCorrect?: boolean; // Present from base table (editor), stripped in safe view (learner)
}

export interface KnowledgeCheckQuestion {
  id: string;
  moduleId: string;
  questionText: string;
  questionType: 'single_choice' | 'true_false';
  options: KnowledgeCheckOption[];
  explanation: string | null;
  orderIndex: number;
}

export interface KnowledgeCheckResponse {
  questionId: string;
  selectedOptionIndex: number;
  isCorrect: boolean;
  correctIndex: number;
  explanation: string | null;
}

export interface KnowledgeCheckQuestionFormData {
  questionText: string;
  questionType: 'single_choice' | 'true_false';
  options: KnowledgeCheckOption[];
  explanation: string | null;
}
