export type EnrollmentType = 'invite_only' | 'password_protected' | 'open';
export type ModuleType = 'video' | 'pdf' | 'markdown' | 'quiz' | 'exam';
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
  lectures: LectureWithModules[];
  progressMap: Record<string, ModuleProgress>;
}

export interface ModuleProgress {
  status: ProgressStatus;
  completed_at: string | null;
}
