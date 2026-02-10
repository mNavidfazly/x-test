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

export interface ModuleVideo {
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
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

export type ModuleContent =
  | { type: 'video'; data: ModuleVideo }
  | { type: 'pdf'; data: ModulePdf }
  | { type: 'markdown'; data: ModuleMarkdownContent }
  | { type: 'quiz'; data: null }
  | { type: 'exam'; data: null };

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
