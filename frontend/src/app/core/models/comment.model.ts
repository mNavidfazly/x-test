export type BadgeType = 'expert' | 'calypso';

export interface CommentAuthor {
  full_name: string | null;
  email: string;
}

export interface CommentReply {
  id: string;
  comment_id: string;
  user_id: string;
  tenant_id: string;
  body: string;
  badge_type: BadgeType | null;
  created_at: string;
  updated_at: string;
  author: CommentAuthor | null;
}

export interface Comment {
  id: string;
  user_id: string;
  tenant_id: string;
  module_id: string;
  body: string;
  badge_type: BadgeType | null;
  created_at: string;
  updated_at: string;
  author: CommentAuthor | null;
  replies: CommentReply[];
}
