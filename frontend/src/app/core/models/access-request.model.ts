export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequestForBoard {
  id: string;
  email: string;
  full_name: string | null;
  domain: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  status: AccessRequestStatus;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface ReviewAccessRequestData {
  status: AccessRequestStatus;
  review_notes?: string;
}
