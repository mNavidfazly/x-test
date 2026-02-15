import {
  Bell, BookOpen, Plus, RotateCcw, CheckCircle2, MessageSquare,
  Clock, AlertTriangle, HelpCircle, FileText, Flag, UserPlus, UserCheck,
} from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';

export type NotificationType =
  | 'course_assigned'
  | 'new_module'
  | 'progress_reset'
  | 'exam_graded'
  | 'question_answered'
  | 'reminder'
  | 'exam_deadline'
  | 'new_expert_question'
  | 'new_exam_submission'
  | 'new_issue'
  | 'content_staleness'
  | 'new_access_request'
  | 'issue_resolved'
  | 'exam_reset'
  | 'access_request_reviewed';

export interface AppNotification {
  id: string;
  user_id: string;
  tenant_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

export interface NotificationMeta {
  icon: LucideIconData;
  colorClass: string;
}

const NOTIFICATION_META: Record<NotificationType, NotificationMeta> = {
  course_assigned:          { icon: BookOpen,      colorClass: 'text-teal-600 bg-teal-50' },
  new_module:               { icon: Plus,          colorClass: 'text-teal-600 bg-teal-50' },
  progress_reset:           { icon: RotateCcw,     colorClass: 'text-amber-600 bg-amber-50' },
  exam_graded:              { icon: CheckCircle2,  colorClass: 'text-emerald-600 bg-emerald-50' },
  question_answered:        { icon: MessageSquare, colorClass: 'text-teal-600 bg-teal-50' },
  reminder:                 { icon: Clock,         colorClass: 'text-amber-600 bg-amber-50' },
  exam_deadline:            { icon: AlertTriangle, colorClass: 'text-rose-600 bg-rose-50' },
  new_expert_question:      { icon: HelpCircle,    colorClass: 'text-blue-600 bg-blue-50' },
  new_exam_submission:      { icon: FileText,      colorClass: 'text-blue-600 bg-blue-50' },
  new_issue:                { icon: Flag,          colorClass: 'text-amber-600 bg-amber-50' },
  content_staleness:        { icon: AlertTriangle, colorClass: 'text-amber-600 bg-amber-50' },
  new_access_request:       { icon: UserPlus,      colorClass: 'text-blue-600 bg-blue-50' },
  issue_resolved:           { icon: CheckCircle2,  colorClass: 'text-emerald-600 bg-emerald-50' },
  exam_reset:               { icon: RotateCcw,     colorClass: 'text-amber-600 bg-amber-50' },
  access_request_reviewed:  { icon: UserCheck,     colorClass: 'text-teal-600 bg-teal-50' },
};

const DEFAULT_META: NotificationMeta = { icon: Bell, colorClass: 'text-slate-600 bg-slate-50' };

export function getNotificationMeta(type: NotificationType): NotificationMeta {
  return NOTIFICATION_META[type] ?? DEFAULT_META;
}

export function getNotificationRoute(type: NotificationType, data: Record<string, string>): string | null {
  switch (type) {
    case 'course_assigned':
    case 'new_module':
      if (data['module_id'] && data['course_id']) return `/courses/${data['course_id']}/modules/${data['module_id']}`;
      if (data['course_id']) return `/courses/${data['course_id']}`;
      return null;

    case 'progress_reset':
      if (data['course_id'] && data['module_id']) return `/courses/${data['course_id']}/modules/${data['module_id']}`;
      return data['course_id'] ? `/courses/${data['course_id']}` : null;

    case 'exam_graded':
    case 'exam_reset':
    case 'exam_deadline':
    case 'reminder':
      return data['course_id'] ? `/courses/${data['course_id']}` : null;

    case 'content_staleness':
      return '/teaching/staleness';

    case 'question_answered':
      return '/questions';

    case 'issue_resolved':
      return '/issues';

    case 'new_expert_question':
      return '/teaching/questions';

    case 'new_exam_submission':
      return '/teaching/grading';

    case 'new_issue':
      return '/teaching/issues';

    case 'new_access_request':
      return '/admin/access-requests';

    case 'access_request_reviewed':
      return null;
  }
}
