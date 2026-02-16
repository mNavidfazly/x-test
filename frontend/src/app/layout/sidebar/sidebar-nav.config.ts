import { UserRole } from '../../core/models/auth.model';
import {
  LucideIconData,
  LayoutDashboard, BookOpen, Bell, GraduationCap, MessageSquare,
  ClipboardCheck, Users, UserPlus, Building, HelpCircle, BarChart3,
  Building2, FolderOpen, Clock, Flag, UserCog, StickyNote,
} from 'lucide-angular';

export interface NavItem {
  label: string;
  route: string;
  icon: LucideIconData;
}

export interface NavSection {
  label: string;
  roles: 'all' | UserRole[];
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: '',
    roles: 'all',
    items: [
      { label: 'Dashboard', route: '/dashboard', icon: LayoutDashboard },
      { label: 'My Courses', route: '/courses', icon: BookOpen },
      { label: 'My Questions', route: '/questions', icon: HelpCircle },
      { label: 'My Issues', route: '/issues', icon: Flag },
      { label: 'My Notes', route: '/notes', icon: StickyNote },
      { label: 'Notifications', route: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Teaching',
    roles: ['lecturer', 'platform_admin'],
    items: [
      { label: 'Teaching Overview', route: '/teaching/courses', icon: GraduationCap },
      { label: 'Questions Board', route: '/teaching/questions', icon: MessageSquare },
      { label: 'Exam Grading', route: '/teaching/grading', icon: ClipboardCheck },
      { label: 'Issue Management', route: '/teaching/issues', icon: Flag },
      { label: 'Content Staleness', route: '/teaching/staleness', icon: Clock },
    ],
  },
  {
    label: 'Tenant Admin',
    roles: ['tenant_admin', 'platform_admin'],
    items: [
      { label: 'User Management', route: '/admin/users', icon: Users },
      { label: 'Access Requests', route: '/admin/access-requests', icon: UserPlus },
    ],
  },
  {
    label: 'CSM',
    roles: ['csm'],
    items: [
      { label: 'Assigned Tenants', route: '/csm/tenants', icon: Building },
      { label: 'Expert Questions', route: '/csm/questions', icon: HelpCircle },
    ],
  },
  {
    label: 'Analytics',
    roles: ['tenant_admin', 'csm', 'lecturer', 'platform_admin'],
    items: [
      { label: 'Progress Dashboard', route: '/analytics/progress', icon: BarChart3 },
    ],
  },
  {
    label: 'Platform',
    roles: ['platform_admin'],
    items: [
      { label: 'Tenant Management', route: '/platform/tenants', icon: Building2 },
      { label: 'Lecturer Assignments', route: '/platform/lecturer-assignments', icon: UserCog },
      { label: 'Content Management', route: '/platform/content', icon: FolderOpen },
    ],
  },
];

export function filterNavSections(roles: UserRole[]): NavSection[] {
  return NAV_SECTIONS.filter(
    (section) => section.roles === 'all' || section.roles.some((r) => roles.includes(r)),
  );
}
