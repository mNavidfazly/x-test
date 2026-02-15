import { render, screen } from '@testing-library/angular';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter, RouterLink } from '@angular/router';
import { signal } from '@angular/core';
import { DashboardComponent } from './dashboard.component';
import { DashboardService, DashboardCounts } from './dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { CourseService } from '../../core/services/course.service';
import { createMockAuthService, MockAuthService } from '../../__mocks__/auth.mock';
import { createMockProfileService, MockProfileService } from '../../__mocks__/profile.mock';
import { createMockCourseService } from '../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../__mocks__/lucide.mock';
import { DashboardActionCardComponent } from './components/dashboard-action-card.component';
import { CourseCardComponent } from '../courses/components/course-card.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { CourseWithProgress } from '../../core/models/course.model';

const EMPTY_COUNTS: DashboardCounts = {
  pendingAccessRequests: null,
  openIssues: null,
  ungradedExams: null,
  unansweredQuestions: null,
  totalUsers: null,
  totalCourses: null,
  totalTenants: null,
};

function createMockDashboardService(counts?: Partial<DashboardCounts>) {
  return {
    counts: signal<DashboardCounts>({ ...EMPTY_COUNTS, ...counts }),
    loading: signal(false),
    error: signal<string | null>(null),
    loadCounts: vi.fn().mockResolvedValue(undefined),
  };
}

function createTestCourse(overrides: Partial<CourseWithProgress> & { id: string; title: string }): CourseWithProgress {
  return {
    description: null,
    thumbnail_url: null,
    enrollment_type: 'open',
    moduleCount: 10,
    completedModules: 5,
    progressPercent: 50,
    isEnrolled: true,
    lastActivity: '2025-06-01T10:00:00Z',
    totalDurationMinutes: 120,
    lecturers: [],
    ...overrides,
  };
}

describe('DashboardComponent', () => {
  let mockAuth: MockAuthService;
  let mockProfile: MockProfileService;
  let mockCourseService: ReturnType<typeof createMockCourseService>;
  let mockDashboardService: ReturnType<typeof createMockDashboardService>;

  async function setup(options?: {
    authOptions?: Parameters<typeof createMockAuthService>[0];
    profileOptions?: Parameters<typeof createMockProfileService>[0];
    courses?: CourseWithProgress[];
    dashboardCounts?: Partial<DashboardCounts>;
    dashboardLoading?: boolean;
    dashboardError?: string | null;
  }) {
    mockAuth = createMockAuthService({
      isAuthenticated: true,
      ...options?.authOptions,
    });
    mockProfile = createMockProfileService(options?.profileOptions);
    mockCourseService = createMockCourseService({ courses: options?.courses ?? [] });
    mockDashboardService = createMockDashboardService(options?.dashboardCounts);

    if (options?.dashboardLoading) mockDashboardService.loading.set(true);
    if (options?.dashboardError) mockDashboardService.error.set(options.dashboardError);

    return render(DashboardComponent, {
      componentImports: [
        MockLucideIconComponent, RouterLink,
        DashboardActionCardComponent, CourseCardComponent,
        StatCardComponent, StatusBadgeComponent,
        LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent,
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: ProfileService, useValue: mockProfile },
        { provide: CourseService, useValue: mockCourseService },
        { provide: DashboardService, useValue: mockDashboardService },
      ],
    });
  }

  // ─── Section 1: Welcome Header ─────────────────────

  describe('greeting', () => {
    it('should show greeting with user full name', async () => {
      await setup({
        profileOptions: { profile: { full_name: 'Eugen', avatar_url: null } },
      });
      await new Promise(r => setTimeout(r));

      const greeting = screen.getByRole('heading', { level: 1 });
      expect(greeting.textContent).toContain('Eugen');
    });

    it('should fall back to email prefix when no full name', async () => {
      await setup({
        authOptions: { email: 'john.doe@example.com' },
      });
      await new Promise(r => setTimeout(r));

      const greeting = screen.getByRole('heading', { level: 1 });
      expect(greeting.textContent).toContain('john.doe');
    });

    it('should contain time-of-day greeting', async () => {
      await setup();
      await new Promise(r => setTimeout(r));

      const greeting = screen.getByRole('heading', { level: 1 });
      expect(greeting.textContent).toMatch(/Good (morning|afternoon|evening)/);
    });
  });

  describe('role badges', () => {
    it('should show Learner badge for pure learner', async () => {
      await setup({ authOptions: { roles: ['learner'] } });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Learner')).toBeTruthy();
    });

    it('should show multiple role badges for PA', async () => {
      await setup({
        authOptions: { roles: ['learner', 'platform_admin'], claims: { is_platform_admin: true } },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Learner')).toBeTruthy();
      expect(screen.getByText('Platform Admin')).toBeTruthy();
    });

    it('should show Lecturer badge', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'lecturer'],
          claims: { lecturer_course_ids: ['c1'] },
        },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Lecturer')).toBeTruthy();
    });
  });

  // ─── Section 2: Needs Your Attention ──────────────

  describe('action items section', () => {
    it('should NOT show for pure learner', async () => {
      await setup({ authOptions: { roles: ['learner'] } });
      await new Promise(r => setTimeout(r));

      expect(screen.queryByText('Needs Your Attention')).toBeNull();
    });

    it('should show for tenant admin', async () => {
      await setup({
        authOptions: { roles: ['learner', 'tenant_admin'], claims: { is_tenant_admin: true } },
        dashboardCounts: { pendingAccessRequests: 3 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Needs Your Attention')).toBeTruthy();
      expect(screen.getByText('Pending Requests')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('should show all action items for platform admin', async () => {
      await setup({
        authOptions: { roles: ['learner', 'platform_admin'], claims: { is_platform_admin: true } },
        dashboardCounts: {
          pendingAccessRequests: 2,
          openIssues: 5,
          ungradedExams: 1,
          unansweredQuestions: 3,
        },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Pending Requests')).toBeTruthy();
      expect(screen.getByText('Open Issues')).toBeTruthy();
      expect(screen.getByText('Ungraded Exams')).toBeTruthy();
      expect(screen.getByText('Unanswered Questions')).toBeTruthy();
    });

    it('should show issues and questions for lecturer', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'lecturer'],
          claims: { lecturer_course_ids: ['c1'] },
        },
        dashboardCounts: { openIssues: 2, unansweredQuestions: 4 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Open Issues')).toBeTruthy();
      expect(screen.getByText('Unanswered Questions')).toBeTruthy();
      expect(screen.queryByText('Pending Requests')).toBeNull();
    });

    it('should NOT show ungraded exams for lecturer without can_grade', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'lecturer'],
          claims: { lecturer_course_ids: ['c1'], lecturer_can_grade_course_ids: [] },
        },
        dashboardCounts: { openIssues: 1, unansweredQuestions: 0 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.queryByText('Ungraded Exams')).toBeNull();
    });

    it('should show ungraded exams for lecturer WITH can_grade', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'lecturer'],
          claims: {
            lecturer_course_ids: ['c1'],
            lecturer_can_grade_course_ids: ['c1'],
          },
        },
        dashboardCounts: { openIssues: 0, unansweredQuestions: 0, ungradedExams: 7 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Ungraded Exams')).toBeTruthy();
      expect(screen.getByText('7')).toBeTruthy();
    });

    it('should show loading state', async () => {
      await setup({
        authOptions: { roles: ['learner', 'tenant_admin'], claims: { is_tenant_admin: true } },
        dashboardLoading: true,
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('should show error state', async () => {
      await setup({
        authOptions: { roles: ['learner', 'tenant_admin'], claims: { is_tenant_admin: true } },
        dashboardError: 'Failed to load',
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Failed to load')).toBeTruthy();
    });
  });

  // ─── Section 3: Overview Stats ─────────────────────

  describe('overview stats', () => {
    it('should NOT show for pure learner', async () => {
      await setup({ authOptions: { roles: ['learner'] } });
      await new Promise(r => setTimeout(r));

      expect(screen.queryByText('Overview')).toBeNull();
    });

    it('should show Total Users for tenant admin', async () => {
      await setup({
        authOptions: { roles: ['learner', 'tenant_admin'], claims: { is_tenant_admin: true } },
        dashboardCounts: { totalUsers: 45 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('45')).toBeTruthy();
    });

    it('should show all stats for platform admin', async () => {
      await setup({
        authOptions: { roles: ['learner', 'platform_admin'], claims: { is_platform_admin: true } },
        dashboardCounts: { totalUsers: 100, totalCourses: 12, totalTenants: 6 },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Total Users')).toBeTruthy();
      expect(screen.getByText('Total Courses')).toBeTruthy();
      expect(screen.getByText('Total Tenants')).toBeTruthy();
    });

    it('should show Assigned Courses for lecturer from JWT', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'lecturer'],
          claims: { lecturer_course_ids: ['c1', 'c2', 'c3'] },
        },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Assigned Courses')).toBeTruthy();
      // Count derived from JWT claim length, not DB
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('should show Assigned Tenants for CSM from JWT', async () => {
      await setup({
        authOptions: {
          roles: ['learner', 'csm'],
          claims: { csm_tenant_ids: ['t1', 't2'] },
        },
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Assigned Tenants')).toBeTruthy();
      expect(screen.getByText('2')).toBeTruthy();
    });
  });

  // ─── Section 4: My Courses ─────────────────────────

  describe('my courses', () => {
    it('should show empty state when no enrolled courses', async () => {
      await setup();
      await new Promise(r => setTimeout(r));

      expect(screen.getByText(/No enrolled courses/)).toBeTruthy();
    });

    it('should show enrolled courses', async () => {
      await setup({
        courses: [
          createTestCourse({ id: 'c1', title: 'Angular Advanced', isEnrolled: true }),
          createTestCourse({ id: 'c2', title: 'React Basics', isEnrolled: true }),
        ],
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Angular Advanced')).toBeTruthy();
      expect(screen.getByText('React Basics')).toBeTruthy();
    });

    it('should NOT show non-enrolled courses', async () => {
      await setup({
        courses: [
          createTestCourse({ id: 'c1', title: 'Enrolled Course', isEnrolled: true }),
          createTestCourse({ id: 'c2', title: 'Not Enrolled', isEnrolled: false }),
        ],
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Enrolled Course')).toBeTruthy();
      expect(screen.queryByText('Not Enrolled')).toBeNull();
    });

    it('should limit to 6 courses', async () => {
      const courses = Array.from({ length: 8 }, (_, i) =>
        createTestCourse({
          id: `c${i}`,
          title: `Course ${i}`,
          isEnrolled: true,
          lastActivity: `2025-06-0${i + 1}T10:00:00Z`,
        }),
      );
      await setup({ courses });
      await new Promise(r => setTimeout(r));

      // Should show the 6 most recent (Course 7 down to Course 2)
      expect(screen.getByText('Course 7')).toBeTruthy();
      expect(screen.getByText('Course 2')).toBeTruthy();
      expect(screen.queryByText('Course 0')).toBeNull();
      expect(screen.queryByText('Course 1')).toBeNull();
    });

    it('should sort by last activity descending', async () => {
      await setup({
        courses: [
          createTestCourse({ id: 'c1', title: 'Old Course', isEnrolled: true, lastActivity: '2025-01-01T10:00:00Z' }),
          createTestCourse({ id: 'c2', title: 'Recent Course', isEnrolled: true, lastActivity: '2025-06-15T10:00:00Z' }),
        ],
      });
      await new Promise(r => setTimeout(r));

      const courseElements = screen.getAllByText(/Course/);
      const recentIdx = courseElements.findIndex(el => el.textContent?.includes('Recent Course'));
      const oldIdx = courseElements.findIndex(el => el.textContent?.includes('Old Course'));
      expect(recentIdx).toBeLessThan(oldIdx);
    });

    it('should show "View all courses" link when enrolled', async () => {
      await setup({
        courses: [createTestCourse({ id: 'c1', title: 'Course 1', isEnrolled: true })],
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('View all courses')).toBeTruthy();
    });

    it('should NOT show "View all courses" link when no enrollments', async () => {
      await setup();
      await new Promise(r => setTimeout(r));

      expect(screen.queryByText('View all courses')).toBeNull();
    });

    it('should show loading state', async () => {
      const mockCourse = createMockCourseService({ loading: true });
      mockAuth = createMockAuthService({ isAuthenticated: true });
      mockProfile = createMockProfileService();
      mockDashboardService = createMockDashboardService();

      await render(DashboardComponent, {
        componentImports: [
          MockLucideIconComponent, RouterLink,
          DashboardActionCardComponent, CourseCardComponent,
          StatCardComponent, StatusBadgeComponent,
          LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent,
        ],
        providers: [
          provideRouter([]),
          { provide: AuthService, useValue: mockAuth },
          { provide: ProfileService, useValue: mockProfile },
          { provide: CourseService, useValue: mockCourse },
          { provide: DashboardService, useValue: mockDashboardService },
        ],
      });
      await new Promise(r => setTimeout(r));

      expect(screen.getByText('Loading courses...')).toBeTruthy();
    });
  });

  // ─── Data Loading ──────────────────────────────────

  describe('data loading', () => {
    it('should call loadCounts and loadCourses on init', async () => {
      await setup();
      await new Promise(r => setTimeout(r));

      expect(mockDashboardService.loadCounts).toHaveBeenCalled();
      expect(mockCourseService.loadCourses).toHaveBeenCalled();
    });
  });
});
