import { EnrollmentType, ModuleType } from './course.model';

export interface ContentModule {
  id: string;
  title: string;
  module_type: ModuleType;
  sort_order: number;
  estimated_duration_minutes: number;
  updated_at: string;
  daysSinceUpdate: number;
  isStale: boolean;
  isPostponed: boolean;
  postponedUntil: string | null;
}

export interface ContentLecture {
  id: string;
  title: string;
  sort_order: number;
  modules: ContentModule[];
}

export interface ContentCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  enrollment_type: EnrollmentType;
  staleness_threshold_days: number;
  updated_at: string;
  lectures: ContentLecture[];
  tenantCount: number;
  lectureCount: number;
  totalModules: number;
  modulesByType: Partial<Record<ModuleType, number>>;
  staleModuleCount: number;
  freshModuleCount: number;
  postponedModuleCount: number;
  hasStaleModules: boolean;
  lastModuleUpdate: string | null;
  totalDurationMinutes: number;
}

export type StalenessFilter = 'all' | 'has_stale' | 'all_fresh' | 'has_postponed';
export type ModuleTypeFilter = 'all' | ModuleType;
