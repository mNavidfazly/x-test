export type ExpertQuestionStatus = 'pending' | 'answered' | 'closed';

export interface ExpertQuestionResponder {
  full_name: string | null;
  email: string;
}

export interface ExpertQuestion {
  id: string;
  user_id: string;
  tenant_id: string;
  course_id: string;
  module_id: string | null;
  question_text: string;
  status: ExpertQuestionStatus;
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  course: { title: string } | null;
  module: { title: string } | null;
  responder: ExpertQuestionResponder | null;
}

// --- Board (Lecturer/PA) types ---

export interface QuestionAsker {
  full_name: string | null;
  email: string;
}

export interface ExpertQuestionForBoard {
  id: string;
  user_id: string;
  tenant_id: string;
  course_id: string;
  module_id: string | null;
  question_text: string;
  status: ExpertQuestionStatus;
  response_text: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  course: { title: string } | null;
  module: { title: string } | null;
  asker: QuestionAsker | null;
}

export interface BoardCourseSummary {
  id: string;
  title: string;
}
