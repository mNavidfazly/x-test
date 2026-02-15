import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideAngularModule, LayoutDashboard, BookOpen, ArrowRight,
  UserPlus, Flag, ClipboardCheck, HelpCircle,
} from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { CourseService } from '../../core/services/course.service';
import { DashboardService } from './dashboard.service';
import { DashboardActionCardComponent } from './components/dashboard-action-card.component';
import { CourseCardComponent } from '../courses/components/course-card.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { StatusBadgeComponent, BadgeVariant } from '../../shared/components/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

interface ActionItem {
  icon: LucideIconData;
  iconBg: string;
  iconColor: string;
  count: number;
  label: string;
  route: string;
}

const ROLE_BADGE_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  learner: { label: 'Learner', variant: 'primary' },
  tenant_admin: { label: 'Tenant Admin', variant: 'warning' },
  platform_admin: { label: 'Platform Admin', variant: 'error' },
  csm: { label: 'CSM', variant: 'purple' },
  lecturer: { label: 'Lecturer', variant: 'info' },
};

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, LucideAngularModule,
    DashboardActionCardComponent, CourseCardComponent,
    StatCardComponent, StatusBadgeComponent,
    LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent,
    UserAvatarComponent,
  ],
  host: { class: 'block' },
  template: `
    <!-- Section 1: Welcome Header -->
    <div class="mb-8">
      <div class="flex items-center gap-3 mb-2">
        <app-user-avatar
          [avatarUrl]="currentUserAvatarUrl()"
          [name]="greetingName()"
          size="md"
        />
        <h1 class="page-title">{{ greeting() }}</h1>
      </div>
      <div class="flex flex-wrap gap-1.5">
        @for (badge of roleBadges(); track badge.label) {
          <app-status-badge [variant]="badge.variant">{{ badge.label }}</app-status-badge>
        }
      </div>
    </div>

    <!-- Section 2: Needs Your Attention (admin/teaching roles) -->
    @if (showActionItems()) {
      <div class="mb-8">
        <h2 class="section-label mb-3">Needs Your Attention</h2>
        @if (dashboardService.loading()) {
          <app-loading-spinner message="Loading..." />
        } @else if (dashboardService.error()) {
          <app-error-alert [message]="dashboardService.error()!" />
        } @else {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (item of actionItems(); track item.label) {
              <app-dashboard-action-card
                [icon]="item.icon"
                [iconBg]="item.iconBg"
                [iconColor]="item.iconColor"
                [count]="item.count"
                [label]="item.label"
                [route]="item.route" />
            }
          </div>
        }
      </div>
    }

    <!-- Section 3: Overview Stats (admin/teaching/CSM) -->
    @if (showOverview()) {
      <div class="mb-8">
        <h2 class="section-label mb-3">Overview</h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (stat of overviewStats(); track stat.label) {
            <app-stat-card [label]="stat.label" [value]="stat.value" [color]="stat.color" />
          }
        </div>
      </div>
    }

    <!-- Section 4: My Courses -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-label">My Courses</h2>
        @if (enrolledCourses().length > 0) {
          <a routerLink="/courses" class="btn-link flex items-center gap-1">
            View all courses
            <lucide-icon [img]="icons.ArrowRight" [size]="14"></lucide-icon>
          </a>
        }
      </div>

      @if (courseService.loading()) {
        <app-loading-spinner message="Loading courses..." />
      } @else if (courseService.error()) {
        <app-error-alert [message]="courseService.error()!" />
      } @else if (enrolledCourses().length === 0) {
        <app-empty-state [icon]="icons.BookOpen" message="No enrolled courses yet. Browse available courses to get started." />
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          @for (course of enrolledCourses(); track course.id) {
            <app-course-card [course]="course" />
          }
        </div>
      }
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  #auth = inject(AuthService);
  #profile = inject(ProfileService);
  readonly courseService = inject(CourseService);
  readonly dashboardService = inject(DashboardService);

  readonly icons = { LayoutDashboard, BookOpen, ArrowRight, UserPlus, Flag, ClipboardCheck, HelpCircle };

  readonly currentUserAvatarUrl = computed(() => this.#profile.profile()?.avatar_url ?? null);

  readonly greetingName = computed(() =>
    this.#profile.profile()?.full_name
    ?? this.#auth.currentUser()?.email
    ?? '',
  );

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const name = this.#profile.profile()?.full_name
      ?? this.#auth.currentUser()?.email?.split('@')[0]
      ?? '';
    return name ? `${timeGreeting}, ${name}` : timeGreeting;
  });

  readonly roleBadges = computed(() =>
    (this.#auth.roles() ?? [])
      .map(role => ROLE_BADGE_MAP[role])
      .filter(Boolean),
  );

  readonly showActionItems = computed(() => {
    const claims = this.#auth.currentUser()?.claims;
    if (!claims) return false;
    return claims.is_tenant_admin
      || claims.is_platform_admin
      || claims.lecturer_course_ids.length > 0;
  });

  readonly actionItems = computed((): ActionItem[] => {
    const counts = this.dashboardService.counts();
    const claims = this.#auth.currentUser()?.claims;
    if (!counts || !claims) return [];

    const items: ActionItem[] = [];

    if (claims.is_tenant_admin || claims.is_platform_admin) {
      if (counts.pendingAccessRequests !== null) {
        items.push({
          icon: UserPlus, iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
          count: counts.pendingAccessRequests, label: 'Pending Requests', route: '/admin/access-requests',
        });
      }
    }

    if (claims.lecturer_course_ids.length > 0 || claims.is_platform_admin) {
      if (counts.openIssues !== null) {
        items.push({
          icon: Flag, iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
          count: counts.openIssues, label: 'Open Issues', route: '/teaching/issues',
        });
      }
      if (counts.unansweredQuestions !== null) {
        items.push({
          icon: HelpCircle, iconBg: 'bg-purple-100', iconColor: 'text-purple-600',
          count: counts.unansweredQuestions, label: 'Unanswered Questions', route: '/teaching/questions',
        });
      }
    }

    if ((claims.lecturer_can_grade_course_ids.length > 0 || claims.is_platform_admin) && counts.ungradedExams !== null) {
      items.push({
        icon: ClipboardCheck, iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
        count: counts.ungradedExams, label: 'Ungraded Exams', route: '/teaching/grading',
      });
    }

    return items;
  });

  readonly showOverview = computed(() => {
    const claims = this.#auth.currentUser()?.claims;
    if (!claims) return false;
    return claims.is_tenant_admin
      || claims.is_platform_admin
      || claims.csm_tenant_ids.length > 0
      || claims.lecturer_course_ids.length > 0;
  });

  readonly overviewStats = computed((): { label: string; value: number | string; color: string }[] => {
    const counts = this.dashboardService.counts();
    const claims = this.#auth.currentUser()?.claims;
    if (!claims) return [];

    const stats: { label: string; value: number | string; color: string }[] = [];

    if ((claims.is_tenant_admin || claims.is_platform_admin) && counts.totalUsers !== null) {
      stats.push({ label: 'Total Users', value: counts.totalUsers, color: 'text-slate-900' });
    }

    if (claims.is_platform_admin) {
      if (counts.totalCourses !== null) {
        stats.push({ label: 'Total Courses', value: counts.totalCourses, color: 'text-teal-600' });
      }
      if (counts.totalTenants !== null) {
        stats.push({ label: 'Total Tenants', value: counts.totalTenants, color: 'text-blue-600' });
      }
    }

    if (claims.lecturer_course_ids.length > 0) {
      stats.push({ label: 'Assigned Courses', value: claims.lecturer_course_ids.length, color: 'text-teal-600' });
    }

    if (claims.csm_tenant_ids.length > 0) {
      stats.push({ label: 'Assigned Tenants', value: claims.csm_tenant_ids.length, color: 'text-purple-600' });
    }

    return stats;
  });

  readonly enrolledCourses = computed(() =>
    this.courseService.courses()
      .filter(c => c.isEnrolled)
      .sort((a, b) => {
        if (a.lastActivity && b.lastActivity) return b.lastActivity.localeCompare(a.lastActivity);
        if (a.lastActivity) return -1;
        if (b.lastActivity) return 1;
        return a.title.localeCompare(b.title);
      })
      .slice(0, 6),
  );

  async ngOnInit() {
    await Promise.all([
      this.dashboardService.loadCounts(),
      this.courseService.loadCourses(),
    ]);
  }
}
