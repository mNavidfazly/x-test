export interface LecturerAssignment {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  course_id: string;
  course_title: string;
  can_edit: boolean;
  can_grade: boolean;
  assigned_at: string;
  assigned_by_name: string | null;
}

export interface AvailableLecturer {
  id: string;
  email: string;
  full_name: string | null;
}

export interface AvailableCourse {
  id: string;
  title: string;
}

export interface UpdatePermissionsData {
  can_edit?: boolean;
  can_grade?: boolean;
}
