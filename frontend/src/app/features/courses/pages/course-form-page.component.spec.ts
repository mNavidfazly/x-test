import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { CourseFormPageComponent } from './course-form-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { CourseFormComponent } from '../components/course-form.component';
import { TenantAssignmentComponent } from '../components/tenant-assignment.component';
import { createMockCourseService, createMockCourseDetail, createMockTenantSummary } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

function mockActivatedRoute(params: Record<string, string | null>) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => params[key] ?? null,
      },
    },
  };
}

describe('CourseFormPageComponent', () => {
  describe('create mode', () => {
    it('should render create form for platform admin', async () => {
      const courseService = createMockCourseService();

      await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({}) },
        ],
      });

      expect(screen.getByText('New Course')).toBeTruthy();
      expect(screen.getByText('Back to courses')).toBeTruthy();
    });

    it('should redirect non-admin from create mode', async () => {
      const courseService = createMockCourseService();
      const router = { navigate: vi.fn() };

      await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({}) },
          { provide: Router, useValue: router },
        ],
      });

      expect(router.navigate).toHaveBeenCalledWith(['/courses']);
    });

    it('should call createCourse on save', async () => {
      const courseService = createMockCourseService();

      const { fixture } = await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({}) },
        ],
      });

      // Type a title and click Create Course
      const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
      fireEvent.input(titleInput, { target: { value: 'New Course' } });
      fixture.detectChanges();

      fireEvent.click(screen.getByText('Create Course'));

      expect(courseService.createCourse).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    it('should render edit form for platform admin', async () => {
      const courseService = createMockCourseService({
        courseDetail: createMockCourseDetail({ title: 'X-LNG Advanced' }),
      });
      courseService.loadTenants.mockResolvedValue([
        createMockTenantSummary({ id: 't1', name: 'Calypso', is_master: true }),
      ]);
      courseService.loadTenantAssignments.mockResolvedValue([
        { tenant_id: 't1', tenant_name: 'Calypso' },
      ]);

      await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
        ],
      });

      expect(screen.getByText('Edit Course')).toBeTruthy();
      expect(courseService.loadCourseDetail).toHaveBeenCalledWith('c1');
    });

    it('should show delete button for platform admin in edit mode', async () => {
      const courseService = createMockCourseService({
        courseDetail: createMockCourseDetail(),
      });
      courseService.loadTenants.mockResolvedValue([]);
      courseService.loadTenantAssignments.mockResolvedValue([]);

      const { fixture } = await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
        ],
      });

      await new Promise(r => setTimeout(r));
      fixture.detectChanges();

      expect(screen.getByText('Delete Course')).toBeTruthy();
    });

    it('should show confirmation on delete click', async () => {
      const courseService = createMockCourseService({
        courseDetail: createMockCourseDetail(),
      });
      courseService.loadTenants.mockResolvedValue([]);
      courseService.loadTenantAssignments.mockResolvedValue([]);

      const { fixture } = await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
        ],
      });

      await new Promise(r => setTimeout(r));
      fixture.detectChanges();

      fireEvent.click(screen.getByText('Delete Course'));

      expect(screen.getByText('Yes, Delete')).toBeTruthy();
      expect(screen.getByText(/Are you sure/)).toBeTruthy();
    });

    it('should allow lecturer with can_edit to edit', async () => {
      const courseService = createMockCourseService({
        courseDetail: createMockCourseDetail(),
      });

      const { fixture } = await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          {
            provide: AuthService,
            useValue: createMockAuthService({
              isAuthenticated: true,
              roles: ['learner', 'lecturer'],
              claims: { lecturer_can_edit_course_ids: ['c1'] },
            }),
          },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
        ],
      });

      await new Promise(r => setTimeout(r));
      fixture.detectChanges();

      expect(screen.getByText('Edit Course')).toBeTruthy();
      // Lecturer should NOT see delete button or tenant assignment
      expect(screen.queryByText('Delete Course')).toBeNull();
      expect(screen.queryByText('Tenant Assignment')).toBeNull();
    });

    it('should show tenant assignment section for platform admin', async () => {
      const courseService = createMockCourseService({
        courseDetail: createMockCourseDetail(),
      });
      courseService.loadTenants.mockResolvedValue([
        createMockTenantSummary({ id: 't1', name: 'Calypso', is_master: true }),
        createMockTenantSummary({ id: 't2', name: 'Santos' }),
      ]);
      courseService.loadTenantAssignments.mockResolvedValue([
        { tenant_id: 't1', tenant_name: 'Calypso' },
      ]);

      const { fixture } = await render(CourseFormPageComponent, {
        componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
        providers: [
          provideRouter([]),
          { provide: CourseService, useValue: courseService },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
          { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
        ],
      });

      await new Promise(r => setTimeout(r));
      fixture.detectChanges();

      expect(screen.getByText('Tenant Assignment')).toBeTruthy();
    });
  });

  it('should show error message', async () => {
    const courseService = createMockCourseService();
    courseService.loadCourseDetail.mockRejectedValue(new Error('Network error'));

    const { fixture } = await render(CourseFormPageComponent, {
      componentImports: [MockLucideIconComponent, CourseFormComponent, TenantAssignmentComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute({ courseId: 'c1' }) },
      ],
    });

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Network error')).toBeTruthy();
  });
});
