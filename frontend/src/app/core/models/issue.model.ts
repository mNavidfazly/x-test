export type IssueType = 'content_error' | 'technical' | 'accessibility' | 'other';
export type IssueStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface Issue {
  id: string;
  user_id: string;
  tenant_id: string;
  course_id: string;
  module_id: string | null;
  description: string;
  issue_type: IssueType;
  status: IssueStatus;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  // FK joins — no internal_notes (using issues_safe view)
  course: { title: string } | null;
  module: { title: string } | null;
}
