export type UserRole = 'learner' | 'tenant_admin' | 'platform_admin' | 'csm' | 'lecturer';

export interface JwtClaims {
  tenant_id: string;
  is_tenant_admin: boolean;
  is_platform_admin: boolean;
  csm_tenant_ids: string[];
  lecturer_course_ids: string[];
  lecturer_can_edit_course_ids: string[];
  lecturer_can_grade_course_ids: string[];
}

export interface AppUser {
  id: string;
  email: string;
  tenantId: string;
  roles: UserRole[];
  claims: JwtClaims;
}
