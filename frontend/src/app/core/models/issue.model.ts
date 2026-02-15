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

// Board (Lecturer/PA) types — reads from base issues table, includes internal_notes
export interface IssueReporter {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface IssueForBoard {
  id: string;
  user_id: string;
  tenant_id: string;
  course_id: string;
  module_id: string | null;
  description: string;
  issue_type: IssueType;
  status: IssueStatus;
  internal_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  course: { title: string } | null;
  module: { title: string } | null;
  reporter: IssueReporter | null;
}

export interface BoardIssueSummary {
  id: string;
  title: string;
}
