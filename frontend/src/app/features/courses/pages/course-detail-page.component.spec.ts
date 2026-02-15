import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { CourseDetailPageComponent } from './course-detail-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { LectureAccordionComponent } from '../components/lecture-accordion.component';
import { LectureFormComponent } from '../components/lecture-form.component';
import { EnrollmentCtaComponent } from '../components/enrollment-cta.component';
import { EnrollmentManagerComponent } from '../components/enrollment-manager.component';
import { ProgressManagerComponent } from '../components/progress-manager.component';
import { createMockCourseService, createMockCourseDetail } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ToastService } from '../../../core/services/toast.service';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

function mockActivatedRoute(courseId: string) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => key === 'courseId' ? courseId : null,
      },
    },
  };
}

const defaultImports = [MockLucideIconComponent, LectureAccordionComponent, LectureFormComponent, EnrollmentCtaComponent, EnrollmentManagerComponent, ProgressManagerComponent, ErrorAlertComponent, StatusBadgeComponent];

describe('CourseDetailPageComponent', () => {
  it('should call loadCourseDetail with route param', async () => {
    const courseService = createMockCourseService();
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('abc-123') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(courseService.loadCourseDetail).toHaveBeenCalledWith('abc-123');
  });

  it('should show back link', async () => {
    const courseService = createMockCourseService();
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Back to courses')).toBeTruthy();
  });

  it('should show loading skeleton', async () => {
    const courseService = createMockCourseService({ loading: true });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should show error message', async () => {
    const courseService = createMockCourseService({ error: 'Course not found' });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Course not found')).toBeTruthy();
  });

  it('should render course title and description', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({
        title: 'Angular Advanced',
        description: 'Deep dive into Angular',
      }),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Angular Advanced')).toBeTruthy();
    expect(screen.getByText('Deep dive into Angular')).toBeTruthy();
  });

  it('should show progress summary', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({
        lectures: [
          {
            id: 'l1', title: 'L1', description: null, sort_order: 0,
            modules: [
              { id: 'm1', title: 'M1', module_type: 'video', sort_order: 0 },
              { id: 'm2', title: 'M2', module_type: 'pdf', sort_order: 1 },
            ],
          },
        ],
        progressMap: {
          'm1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
        },
      }),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('1/2 modules completed')).toBeTruthy();
  });

  it('should render lecture accordions', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Lecture 1')).toBeTruthy();
    expect(screen.getByText('Lecture 2')).toBeTruthy();
  });

  it('should show Edit button for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Edit')).toBeTruthy();
  });

  it('should show Edit button for lecturer with can_edit', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
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
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.queryByText('Delete Course')).toBeNull();
  });

  it('should hide Edit button for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete Course')).toBeNull();
  });

  it('should show Delete button for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Delete Course')).toBeTruthy();
  });

  it('should show delete confirmation on click', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    fireEvent.click(screen.getByText('Delete Course'));

    expect(screen.getByText('Yes, Delete')).toBeTruthy();
    expect(screen.getByText(/Are you sure/)).toBeTruthy();
  });

  // --- Lecture CRUD tests ---

  it('should show Add Lecture button for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Add Lecture')).toBeTruthy();
  });

  it('should show Add Lecture button for lecturer with can_edit', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
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
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText('Add Lecture')).toBeTruthy();
  });

  it('should hide Add Lecture button for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.queryByText('Add Lecture')).toBeNull();
  });

  it('should show new lecture form on Add Lecture click', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    fireEvent.click(screen.getByText('Add Lecture'));

    expect(screen.getByText('New Lecture')).toBeTruthy();
  });

  it('should call createLecture on new lecture save', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { fixture } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    // Open the form
    fireEvent.click(screen.getByText('Add Lecture'));

    // Type a title
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'New Lecture' } });
    fixture.detectChanges();

    // Submit
    fireEvent.click(screen.getByText('Add Lecture', { selector: 'button' }));
    await new Promise(r => setTimeout(r));

    expect(courseService.createLecture).toHaveBeenCalledWith('c1', { title: 'New Lecture', description: null });
  });

  it('should call deleteLecture and reload on confirmed delete', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    // Click delete on first lecture accordion
    const deleteButtons = screen.getAllByTitle('Delete lecture');
    fireEvent.click(deleteButtons[0]);

    // Confirm
    fireEvent.click(screen.getAllByText('Yes, Delete')[0]);
    await new Promise(r => setTimeout(r));

    expect(courseService.deleteLecture).toHaveBeenCalledWith('lecture-1');
    expect(courseService.loadCourseDetail).toHaveBeenCalledWith('c1');
  });

  it('should show toast error on lecture delete failure', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();
    courseService.deleteLecture.mockRejectedValueOnce(new Error('Cannot delete lecture'));

    const { fixture } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    // Trigger delete
    const deleteButtons = screen.getAllByTitle('Delete lecture');
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByText('Yes, Delete')[0]);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Cannot delete lecture');
  });

  // --- Module CRUD tests ---

  it('should show Add Module buttons for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    const addModuleButtons = screen.getAllByText('Add Module');
    expect(addModuleButtons.length).toBe(2); // one per lecture
  });

  it('should hide Add Module buttons for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.queryByText('Add Module')).toBeNull();
  });

  it('should call deleteModule and reload on confirmed module delete', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    // Click delete on first module
    const moduleDeleteButtons = screen.getAllByTitle('Delete module');
    fireEvent.click(moduleDeleteButtons[0]);

    // Confirm module delete
    const yesDeleteButtons = screen.getAllByText('Yes, Delete');
    fireEvent.click(yesDeleteButtons[yesDeleteButtons.length - 1]); // last one is the module's
    await new Promise(r => setTimeout(r));

    expect(courseService.deleteModule).toHaveBeenCalledWith('mod-1');
    expect(courseService.loadCourseDetail).toHaveBeenCalledWith('c1');
  });

  it('should show toast error on module delete failure', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();
    courseService.deleteModule.mockRejectedValueOnce(new Error('Cannot delete module'));

    const { fixture } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    const moduleDeleteButtons = screen.getAllByTitle('Delete module');
    fireEvent.click(moduleDeleteButtons[0]);
    const yesDeleteButtons = screen.getAllByText('Yes, Delete');
    fireEvent.click(yesDeleteButtons[yesDeleteButtons.length - 1]);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Cannot delete module');
  });

  // --- Enrollment tests ---

  it('should show enrollment CTA when not enrolled and not editor', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({ isEnrolled: false, enrollment_type: 'open' }),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByRole('button', { name: /enroll now/i })).toBeTruthy();
  });

  it('should show enrolled badge when already enrolled', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({ isEnrolled: true }),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.getByText("You're enrolled")).toBeTruthy();
  });

  it('should hide enrollment CTA when canEdit is true', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({ isEnrolled: false }),
    });
    const toast = createMockToastService();

    await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(screen.queryByRole('button', { name: /enroll now/i })).toBeNull();
  });

  it('should show enrollment manager for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-enrollment-manager')).toBeTruthy();
  });

  it('should show enrollment manager for tenant admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_tenant_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-enrollment-manager')).toBeTruthy();
  });

  it('should hide enrollment manager for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-enrollment-manager')).toBeNull();
  });

  // --- Progress Manager tests ---

  it('should show progress manager for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-progress-manager')).toBeTruthy();
  });

  it('should show progress manager for tenant admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_tenant_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-progress-manager')).toBeTruthy();
  });

  it('should hide progress manager for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });
    const toast = createMockToastService();

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
        { provide: ToastService, useValue: toast },
      ],
    });

    expect(container.querySelector('app-progress-manager')).toBeNull();
  });
});
