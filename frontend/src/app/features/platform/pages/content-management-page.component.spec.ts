import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { Router } from '@angular/router';
import { ContentManagementPageComponent } from './content-management-page.component';
import { ContentManagementService } from '../../../core/services/content-management.service';
import { CourseService } from '../../../core/services/course.service';
import { TenantManagementService } from '../../../core/services/tenant-management.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  createMockContentManagementService, createMockContentCourse,
  createMockContentLecture, createMockContentModule,
} from '../../../__mocks__/content-management.mock';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { createMockTenantManagementService } from '../../../__mocks__/course.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { createMockRouter } from '../../../__mocks__/router.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select.component';

function renderPage(options?: {
  service?: ReturnType<typeof createMockContentManagementService>;
  courseService?: ReturnType<typeof createMockCourseService>;
  tenantService?: ReturnType<typeof createMockTenantManagementService>;
}) {
  const service = options?.service ?? createMockContentManagementService();
  const courseService = options?.courseService ?? createMockCourseService();
  const tenantService = options?.tenantService ?? createMockTenantManagementService();
  const toast = createMockToastService();
  const router = createMockRouter();

  return render(ContentManagementPageComponent, {
    componentImports: [
      MockLucideIconComponent, LoadingSpinnerComponent, ErrorAlertComponent,
      EmptyStateComponent, StatCardComponent, StatusBadgeComponent, CustomSelectComponent,
    ],
    providers: [
      { provide: ContentManagementService, useValue: service },
      { provide: CourseService, useValue: courseService },
      { provide: TenantManagementService, useValue: tenantService },
      { provide: ToastService, useValue: toast },
      { provide: Router, useValue: router },
    ],
  }).then(result => ({ ...result, service, courseService, tenantService, toast, router }));
}

describe('ContentManagementPageComponent', () => {
  it('should call loadContentOverview on init', async () => {
    const { service } = await renderPage();
    expect(service.loadContentOverview).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockContentManagementService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading content overview...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockContentManagementService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no courses', async () => {
    await renderPage();
    expect(screen.getByText('No courses found.')).toBeTruthy();
  });

  it('should render course rows with correct data', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          id: 'c1', title: 'Angular Basics', enrollment_type: 'open',
          lectureCount: 3, totalModules: 8, tenantCount: 2,
          modulesByType: { video: 5, pdf: 2, quiz: 1 },
        }),
        createMockContentCourse({
          id: 'c2', title: 'React Advanced', enrollment_type: 'invite_only',
          lectureCount: 5, totalModules: 12, tenantCount: 0,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Angular Basics')).toBeTruthy();
    expect(screen.getByText('React Advanced')).toBeTruthy();
    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getByText('Invite')).toBeTruthy();
  });

  it('should show module type breakdown pills', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          modulesByType: { video: 3, pdf: 2, quiz: 1 },
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('3 Video')).toBeTruthy();
    expect(screen.getByText('2 PDF')).toBeTruthy();
    expect(screen.getByText('1 Quiz')).toBeTruthy();
  });

  it('should show staleness indicator for stale courses', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          hasStaleModules: true, staleModuleCount: 3, totalModules: 5,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('3 stale')).toBeTruthy();
  });

  it('should show Fresh badge when no stale modules', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          hasStaleModules: false, staleModuleCount: 0,
          postponedModuleCount: 0, totalModules: 3,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('Fresh')).toBeTruthy();
  });

  it('should display summary cards with correct counts', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({ totalModules: 5, staleModuleCount: 2, tenantCount: 1 }),
        createMockContentCourse({ id: 'c2', title: 'Course 2', totalModules: 3, staleModuleCount: 0, tenantCount: 0 }),
      ],
    });

    await renderPage({ service });

    // Total Courses = 2
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    // Total Modules = 8
    expect(screen.getAllByText('8').length).toBeGreaterThanOrEqual(1);
    // Stale Modules = 2 (already checked above)
    // Unassigned Courses = 1
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by search term', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({ id: 'c1', title: 'Angular Basics' }),
        createMockContentCourse({ id: 'c2', title: 'React Advanced' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    vi.useFakeTimers();

    const searchInput = screen.getByPlaceholderText('Search courses or modules...');
    await fireEvent.input(searchInput, { target: { value: 'Angular' } });

    vi.advanceTimersByTime(300);
    vi.useRealTimers();
    fixture.detectChanges();

    expect(screen.getByText('Angular Basics')).toBeTruthy();
    expect(screen.queryByText('React Advanced')).toBeNull();
  });

  it('should filter by staleness status', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({ id: 'c1', title: 'Stale Course', hasStaleModules: true, staleModuleCount: 2 }),
        createMockContentCourse({ id: 'c2', title: 'Fresh Course', hasStaleModules: false, staleModuleCount: 0, postponedModuleCount: 0, totalModules: 3 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('All Staleness'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'Has Stale' }));
    fixture.detectChanges();

    expect(screen.getByText('Stale Course')).toBeTruthy();
    expect(screen.queryByText('Fresh Course')).toBeNull();
  });

  it('should filter by module type', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({ id: 'c1', title: 'Video Course', modulesByType: { video: 3 } }),
        createMockContentCourse({ id: 'c2', title: 'PDF Course', modulesByType: { pdf: 2 } }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('All Types'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'Video' }));
    fixture.detectChanges();

    expect(screen.getByText('Video Course')).toBeTruthy();
    expect(screen.queryByText('PDF Course')).toBeNull();
  });

  it('should filter unassigned courses', async () => {
    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({ id: 'c1', title: 'Assigned', tenantCount: 2 }),
        createMockContentCourse({ id: 'c2', title: 'Unassigned', tenantCount: 0 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const checkbox = screen.getByLabelText('Unassigned only');
    await fireEvent.click(checkbox);
    fixture.detectChanges();

    expect(screen.getByText('Unassigned')).toBeTruthy();
    expect(screen.queryByText('Assigned')).toBeNull();
  });

  it('should show clear filters button when filters active', async () => {
    const service = createMockContentManagementService({
      courses: [createMockContentCourse()],
    });

    const { fixture } = await renderPage({ service });

    // No clear button initially
    expect(screen.queryByText('Clear filters')).toBeNull();

    // Activate a filter
    fireEvent.click(screen.getByText('All Staleness'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'Has Stale' }));
    fixture.detectChanges();

    expect(screen.getByText('Clear filters')).toBeTruthy();
  });

  it('should expand course row on click', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([
      { tenant_id: 't1', tenant_name: 'Test Tenant' },
    ]);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([]);

    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          lectures: [
            createMockContentLecture({
              title: 'Intro Lecture',
              modules: [createMockContentModule({ title: 'Video 1' })],
            }),
          ],
        }),
      ],
    });

    const { fixture } = await renderPage({ service, courseService, tenantService });

    // Click on course row
    const row = screen.getByText('Test Course');
    await fireEvent.click(row);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Content Structure')).toBeTruthy();
    expect(screen.getByText('Tenant Assignments')).toBeTruthy();
    expect(screen.getByText('Intro Lecture')).toBeTruthy();
  });

  it('should show module staleness badges in expanded row', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([]);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([]);

    const service = createMockContentManagementService({
      courses: [
        createMockContentCourse({
          lectures: [
            createMockContentLecture({
              modules: [
                createMockContentModule({ id: 'm1', title: 'Stale Module', isStale: true }),
                createMockContentModule({ id: 'm2', title: 'Fresh Module', isStale: false, isPostponed: false }),
                createMockContentModule({ id: 'm3', title: 'Postponed Module', isStale: false, isPostponed: true }),
              ],
            }),
          ],
        }),
      ],
    });

    const { fixture } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Stale Module')).toBeTruthy();
    expect(screen.getByText('Fresh Module')).toBeTruthy();
    expect(screen.getByText('Postponed Module')).toBeTruthy();
    // Staleness badges (there may be duplicate "Stale" from the table row badge)
    expect(screen.getAllByText('Stale').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Postponed').length).toBeGreaterThanOrEqual(1);
  });

  it('should show tenant assignments in expanded row', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([
      { tenant_id: 't1', tenant_name: 'Calypso Corp' },
      { tenant_id: 't2', tenant_name: 'Santos Ltd' },
    ]);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([
      { id: 't1', name: 'Calypso Corp' },
      { id: 't2', name: 'Santos Ltd' },
      { id: 't3', name: 'Available Tenant' },
    ]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse()],
    });

    const { fixture } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Calypso Corp')).toBeTruthy();
    expect(screen.getByText('Santos Ltd')).toBeTruthy();
  });

  it('should assign tenant to course', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([]);
    courseService.assignCourseToTenant.mockResolvedValue(undefined);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([
      { id: 't1', name: 'New Tenant' },
    ]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse({ id: 'c1' })],
    });

    const { fixture, toast } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Select a tenant from custom dropdown
    fireEvent.click(screen.getByText('Select a tenant...'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'New Tenant' }));
    fixture.detectChanges();

    // Click Add
    const addButton = screen.getByText('Add');
    await fireEvent.click(addButton);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(courseService.assignCourseToTenant).toHaveBeenCalledWith('c1', 't1');
    expect(toast.success).toHaveBeenCalledWith('Tenant assigned');
  });

  it('should remove tenant from course', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([
      { tenant_id: 't1', tenant_name: 'Remove Me Tenant' },
    ]);
    courseService.removeCourseFromTenant.mockResolvedValue(undefined);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse({ id: 'c1' })],
    });

    const { fixture, toast } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Find the remove button (X icon next to tenant name)
    const removeButtons = screen.getAllByTitle('Remove tenant');
    await fireEvent.click(removeButtons[0]);
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(courseService.removeCourseFromTenant).toHaveBeenCalledWith('c1', 't1');
    expect(toast.success).toHaveBeenCalledWith('Tenant removed');
  });

  it('should collapse expanded row on second click', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([]);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse()],
    });

    const { fixture } = await renderPage({ service, courseService, tenantService });

    // Expand
    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();
    expect(screen.getByText('Content Structure')).toBeTruthy();

    // Collapse
    await fireEvent.click(screen.getByText('Test Course'));
    fixture.detectChanges();
    expect(screen.queryByText('Content Structure')).toBeNull();
  });

  it('should navigate to course edit on Edit Course click', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([]);
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse({ id: 'c1' })],
    });

    const { fixture, router } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    const editLink = screen.getByText(/Edit Course/);
    await fireEvent.click(editLink);

    expect(router.navigate).toHaveBeenCalledWith(['/courses', 'c1']);
  });

  it('should show toast on tenant assignment error', async () => {
    const courseService = createMockCourseService();
    courseService.loadTenantAssignments.mockResolvedValue([]);
    courseService.assignCourseToTenant.mockRejectedValue(new Error('Assignment failed'));
    const tenantService = createMockTenantManagementService();
    tenantService.loadAvailableTenantsList.mockResolvedValue([
      { id: 't1', name: 'Tenant' },
    ]);

    const service = createMockContentManagementService({
      courses: [createMockContentCourse({ id: 'c1' })],
    });

    const { fixture, toast } = await renderPage({ service, courseService, tenantService });

    await fireEvent.click(screen.getByText('Test Course'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Select a tenant...'));
    fixture.detectChanges();
    fireEvent.click(screen.getByRole('option', { name: 'Tenant' }));
    fixture.detectChanges();

    await fireEvent.click(screen.getByText('Add'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalledWith('Assignment failed');
  });
});
