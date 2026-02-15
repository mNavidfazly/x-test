import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { CourseListPageComponent } from './course-list-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { CourseCardComponent } from '../components/course-card.component';
import { createMockCourseService, createMockCourseWithProgress } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

describe('CourseListPageComponent', () => {
  it('should render page title', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(screen.getByText('My Courses')).toBeTruthy();
  });

  it('should call loadCourses on init', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(courseService.loadCourses).toHaveBeenCalled();
  });

  it('should show loading skeletons', async () => {
    const courseService = createMockCourseService({ loading: true });

    const { container } = await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(6);
  });

  it('should show empty state when no courses', async () => {
    const courseService = createMockCourseService({ courses: [] });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(screen.getByText('No courses available yet.')).toBeTruthy();
  });

  it('should render course cards', async () => {
    const courseService = createMockCourseService({
      courses: [
        createMockCourseWithProgress({ id: 'c1', title: 'Course One' }),
        createMockCourseWithProgress({ id: 'c2', title: 'Course Two' }),
      ],
    });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(screen.getByText('Course One')).toBeTruthy();
    expect(screen.getByText('Course Two')).toBeTruthy();
  });

  it('should show error message', async () => {
    const courseService = createMockCourseService({ error: 'Failed to load' });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(screen.getByText('Failed to load')).toBeTruthy();
  });

  it('should show Create Course button for platform admin', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
      ],
    });

    expect(screen.getByText('Create Course')).toBeTruthy();
  });

  it('should hide Create Course button for non-admin', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
      ],
    });

    expect(screen.queryByText('Create Course')).toBeNull();
  });
});
