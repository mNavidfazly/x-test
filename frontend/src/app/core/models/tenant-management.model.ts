import { AuthMethod } from './tenant.model';

export interface TenantSettings {
  auth_methods?: AuthMethod[];
}

export interface TenantForBoard {
  id: string;
  name: string;
  domain: string | null;
  is_master: boolean;
  settings: TenantSettings;
  created_at: string;
  updated_at: string;
  courseCount: number;
  csmCount: number;
}

export interface TenantCourseAssignment {
  id: string;
  course_id: string;
  course_title: string;
}

export interface CsmAssignment {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  assigned_at: string;
}

export interface AvailableCourse {
  id: string;
  title: string;
}

export interface AvailableCsm {
  id: string;
  email: string;
  full_name: string | null;
}

export interface TenantFormData {
  name: string;
  domain: string | null;
  auth_methods: AuthMethod[];
}
