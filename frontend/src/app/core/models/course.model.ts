export type EnrollmentType = 'invite_only' | 'password_protected' | 'open';
export type ModuleType = 'video' | 'pdf' | 'markdown' | 'quiz' | 'exam' | 'external_quiz';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface CourseWithProgress {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  enrollment_type: EnrollmentType;
  moduleCount: number;
  completedModules: number;
  progressPercent: number;
  isEnrolled: boolean;
  lastActivity: string | null;
}

export interface LectureWithModules {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  modules: ModuleSummary[];
}

export interface ModuleSummary {
  id: string;
  title: string;
  module_type: ModuleType;
  sort_order: number;
}

export interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  enrollment_type: EnrollmentType;
  isEnrolled: boolean;
  lectures: LectureWithModules[];
  progressMap: Record<string, ModuleProgress>;
}

export interface EnrolledUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  enrolled_at: string;
}

export type MarkedByType = 'user' | 'system' | 'admin';

export interface ModuleProgress {
  status: ProgressStatus;
  completed_at: string | null;
}

export interface UserProgressRecord {
  module_id: string;
  status: ProgressStatus;
  completed_at: string | null;
  marked_by: MarkedByType | null;
}

export interface UserProgressSummary {
  user_id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  completed: number;
  total: number;
  modules: Record<string, UserProgressRecord>;
}

// Phase 2B: Module Viewer types

export interface ModuleDetail {
  id: string;
  title: string;
  description: string | null;
  module_type: ModuleType;
  sort_order: number;
  lecture_id: string;
  course_id: string;
}

export type BunnyEncodingStatus = 0 | 1 | 2 | 3 | 4 | 5;

export interface ModuleVideo {
  bunny_video_id: string;
  bunny_library_id: number;
  encoding_status: BunnyEncodingStatus;
  duration: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
}

export interface ModulePdf {
  file_url: string;
  file_name: string;
  page_count: number | null;
}

export interface ModuleMarkdownContent {
  content: string;
}

export interface ModuleFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
}

export interface ExamContent {
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  max_file_size: number;
  allowed_file_types: string[];
  exam_file_url: string | null;
}

export interface ExamTakingData {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  max_file_size: number;
  allowed_file_types: string[];
  exam_file_url: string | null;
}

export interface ExamSubmission {
  id: string;
  exam_id: string;
  file_url: string;
  submitted_at: string;
  deadline: string;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
}

// Phase 5D: Exam Grading types

export interface GradingSubmission {
  id: string;
  user_id: string;
  tenant_id: string;
  exam_id: string;
  course_id: string;
  file_url: string;
  file_storage_path: string;
  submitted_at: string;
  deadline: string;
  score: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  learner_email: string;
  learner_name: string | null;
  course_title: string;
  exam_title: string;
  passing_score: number;
}

export interface GradingCourseSummary {
  id: string;
  title: string;
}

export interface GradeExamPayload {
  score: number;
  feedback: string;
}

export interface ExternalQuizContent {
  external_quiz_id: string;
  external_quiz_url: string;
  passing_score: number | null;
}

export type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'true_false'
  | 'fill_blank' | 'matching' | 'short_answer';

export interface QuizContent {
  id: string;
  title: string;
  description: string | null;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number | null;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  questions: {
    id: string;
    question_text: string;
    question_type: QuizQuestionType;
    points: number;
    sort_order: number;
    correct_answer: string | null;
    options: {
      id: string;
      option_text: string;
      is_correct: boolean;
      sort_order: number;
    }[];
  }[];
}

// Phase 5A: Quiz Taking types (learner-safe, no correct answers)

export interface QuizTakingData {
  id: string;
  title: string;
  description: string | null;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number | null;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  questions: QuizTakingQuestion[];
}

export interface QuizTakingQuestion {
  id: string;
  question_text: string;
  question_type: QuizQuestionType;
  points: number;
  sort_order: number;
  options: QuizTakingOption[];
  matchingLeft?: string[];
  matchingRight?: string[];
}

export interface QuizTakingOption {
  id: string;
  option_text: string;
  sort_order: number;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  attempt_number: number;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  passed: boolean | null;
}

export interface QuizGradeResult {
  score: number;
  passed: boolean;
  earned_points: number;
  total_points: number;
}

export interface QuizQuestionResult {
  question_id: string;
  question_text: string;
  question_type: QuizQuestionType;
  points: number;
  correct_answer: string | null;
  user_answer: string | null;
  options: { id: string; option_text: string; is_correct: boolean | null }[] | null;
}

export interface QuizResults {
  attempt: QuizAttempt;
  grade: QuizGradeResult;
  questions: QuizQuestionResult[];
}

export type QuizAnswerMap = Record<string, string>;

export type ModuleContent =
  | { type: 'video'; data: ModuleVideo }
  | { type: 'pdf'; data: ModulePdf }
  | { type: 'markdown'; data: ModuleMarkdownContent }
  | { type: 'quiz'; data: QuizContent | null }
  | { type: 'exam'; data: ExamContent }
  | { type: 'external_quiz'; data: ExternalQuizContent };

export interface ModuleNavItem {
  id: string;
  title: string;
  module_type: ModuleType;
  lectureTitle: string;
}

export interface ModuleViewerData {
  module: ModuleDetail;
  content: ModuleContent;
  files: ModuleFile[];
  progress: ModuleProgress | null;
  navigation: {
    prev: ModuleNavItem | null;
    next: ModuleNavItem | null;
    current: number;
    total: number;
  };
}

// Phase 3A: Course CRUD types

export interface CourseFormData {
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  enrollment_type: EnrollmentType;
  password_hash: string | null;
  staleness_threshold_days: number | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  domain: string;
  is_master: boolean;
}

export interface TenantAssignment {
  tenant_id: string;
  tenant_name: string;
}

// Phase 3B: Lecture CRUD types

export interface LectureFormData {
  title: string;
  description: string | null;
}

// Phase 3C: Module CRUD types

export interface ModuleFormData {
  title: string;
  description: string | null;
  module_type: ModuleType;
  lecture_id: string;
}

export interface VideoFormData {
  bunny_video_id: string;
  bunny_library_id: number;
  original_filename: string | null;
}

export interface BunnyUploadCredentials {
  video_id: string;
  library_id: number;
  auth_signature: string;
  auth_expire: number;
  tus_endpoint: string;
}

export interface BunnyVideoStatus {
  video_id: string;
  status: number;
  encode_progress: number;
  duration: number | null;
  thumbnail_url: string | null;
  embed_url: string | null;
}

export interface PdfFormData {
  file_url: string;
  file_name: string;
  page_count: number | null;
}

export interface ExamFormData {
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  max_file_size: number;
  allowed_file_types: string[];
  exam_file_url: string | null;
}

export interface MarkdownFormData {
  content: string;
}

export interface ExternalQuizFormData {
  external_quiz_id: string;
  external_quiz_url: string;
  passing_score: number | null;
}

export interface QuizOptionFormData {
  option_text: string;
  is_correct: boolean;
  sort_order: number;
}

export interface QuizQuestionFormData {
  question_text: string;
  question_type: QuizQuestionType;
  points: number;
  sort_order: number;
  options: QuizOptionFormData[];
  correct_answer: string | null;
}

export interface QuizFormData {
  title: string;
  description: string | null;
  time_limit: number | null;
  passing_score: number;
  max_attempts: number | null;
  show_correct_answers: boolean;
  randomize_questions: boolean;
  randomize_answers: boolean;
  questions: QuizQuestionFormData[];
}

export type ModuleContentFormData =
  | { type: 'video'; data: VideoFormData }
  | { type: 'pdf'; data: PdfFormData }
  | { type: 'markdown'; data: MarkdownFormData }
  | { type: 'quiz'; data: QuizFormData | null }
  | { type: 'exam'; data: ExamFormData }
  | { type: 'external_quiz'; data: ExternalQuizFormData };

export interface ModuleSavePayload {
  module: ModuleFormData;
  content: ModuleContentFormData;
  significantUpdate?: boolean;
}

// Phase 4C: Progress Dashboard types

export interface DashboardCourseSummary {
  id: string;
  title: string;
}

export interface DashboardCourseProgress {
  course_id: string;
  course_title: string;
  completed: number;
  total: number;
  percent: number;
}

export interface DashboardUserProgress {
  user_id: string;
  tenant_id: string;
  email: string;
  full_name: string | null;
  tenant_name: string | null;
  courses: DashboardCourseProgress[];
  overallPercent: number;
  lastActive: string | null;
}

export interface ReminderRequest {
  user_ids: string[];
  course_id: string | null;
  message: string;
}

export interface ReminderResponse {
  sent: number;
  failed: number;
}
