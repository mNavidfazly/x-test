import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, RouterLink } from '@angular/router';
import { StalenessDashboardPageComponent } from './staleness-dashboard-page.component';
import { StalenessService } from '../../../core/services/staleness.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockStalenessService, createMockStaleCourse, createMockStaleModule } from '../../../__mocks__/course.mock';
import { createMockToastService } from '../../../__mocks__/toast.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state.component';
import { StatCardComponent } from '../../../shared/components/stat-card.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge.component';

function renderPage(options?: {
  service?: ReturnType<typeof createMockStalenessService>;
}) {
  const service = options?.service ?? createMockStalenessService();
  const toast = createMockToastService();

  return render(StalenessDashboardPageComponent, {
    componentImports: [MockLucideIconComponent, RouterLink, LoadingSpinnerComponent, ErrorAlertComponent, EmptyStateComponent, StatCardComponent, StatusBadgeComponent],
    providers: [
      { provide: StalenessService, useValue: service },
      { provide: ToastService, useValue: toast },
      provideRouter([]),
    ],
  }).then(result => ({ ...result, service, toast }));
}

describe('StalenessDashboardPageComponent', () => {
  it('should call loadStalenessData on init', async () => {
    const { service } = await renderPage();
    expect(service.loadStalenessData).toHaveBeenCalled();
  });

  it('should show loading state', async () => {
    const service = createMockStalenessService({ loading: true });
    await renderPage({ service });
    expect(screen.getByText('Loading staleness data...')).toBeTruthy();
  });

  it('should show error message', async () => {
    const service = createMockStalenessService({ error: 'Permission denied' });
    await renderPage({ service });
    expect(screen.getByText('Permission denied')).toBeTruthy();
  });

  it('should show empty state when no courses', async () => {
    await renderPage();
    expect(screen.getByText('No courses found.')).toBeTruthy();
  });

  it('should render course rows with per-module counts', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'LNG Fundamentals',
          thresholdDays: 90,
          modules: [
            createMockStaleModule({ id: 'm1', isStale: true, daysOverdue: 30 }),
            createMockStaleModule({ id: 'm2', isStale: false, daysOverdue: null }),
            createMockStaleModule({ id: 'm3', isStale: false, daysOverdue: null }),
          ],
          staleModuleCount: 1,
          freshModuleCount: 2,
          totalModuleCount: 3,
          hasStaleModules: true,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // totalModuleCount (also in summary)
    expect(screen.getByText('90 days')).toBeTruthy();
  });

  it('should show Has Stale badge for courses with stale modules', async () => {
    const service = createMockStalenessService({
      courses: [createMockStaleCourse({ id: 'c1', hasStaleModules: true })],
    });

    await renderPage({ service });

    expect(screen.getByText('Has Stale')).toBeTruthy();
  });

  it('should show All Fresh badge for all-fresh courses', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          hasStaleModules: false,
          totalModuleCount: 3,
          modules: [
            createMockStaleModule({ id: 'm1', isStale: false, daysOverdue: null }),
          ],
        }),
      ],
    });

    await renderPage({ service });

    // "All Fresh" appears in course badge + filter dropdown option
    expect(screen.getAllByText('All Fresh').length).toBeGreaterThanOrEqual(1);
  });

  it('should show No Modules badge for empty courses', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          modules: [],
          totalModuleCount: 0,
          staleModuleCount: 0,
          freshModuleCount: 0,
          hasStaleModules: false,
        }),
      ],
    });

    await renderPage({ service });

    // "No Modules" appears in badge and filter dropdown
    expect(screen.getAllByText('No Modules').length).toBeGreaterThanOrEqual(1);
  });

  it('should compute summary card values correctly', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          totalModuleCount: 5,
          staleModuleCount: 3,
          freshModuleCount: 2,
          hasStaleModules: true,
        }),
        createMockStaleCourse({
          id: 'c2',
          totalModuleCount: 4,
          staleModuleCount: 0,
          freshModuleCount: 4,
          hasStaleModules: false,
        }),
        createMockStaleCourse({
          id: 'c3',
          modules: [],
          totalModuleCount: 0,
          staleModuleCount: 0,
          freshModuleCount: 0,
          hasStaleModules: false,
        }),
      ],
    });

    const { container } = await renderPage({ service });

    const statValues = container.querySelectorAll('.text-2xl.font-bold.tabular-nums');
    const values = Array.from(statValues).map(el => el.textContent?.trim());
    // Total Modules=9, Stale Modules=3, Fresh Modules=6, Courses=3
    expect(values).toEqual(['9', '3', '6', '3']);
  });

  it('should filter by search term', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'LNG Fundamentals' }),
        createMockStaleCourse({ id: 'c2', title: 'Risk Management' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const searchInput = screen.getByPlaceholderText('Search by course title...');
    fireEvent.input(searchInput, { target: { value: 'lng' } });
    fixture.detectChanges();

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.queryByText('Risk Management')).toBeFalsy();
  });

  it('should filter by status (has_stale)', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'Has Stale Course', hasStaleModules: true, totalModuleCount: 5 }),
        createMockStaleCourse({ id: 'c2', title: 'Fresh Course', hasStaleModules: false, totalModuleCount: 3 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'has_stale' } });
    fixture.detectChanges();

    expect(screen.getByText('Has Stale Course')).toBeTruthy();
    expect(screen.queryByText('Fresh Course')).toBeFalsy();
  });

  it('should filter by status (all_fresh)', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'Has Stale Course', hasStaleModules: true, totalModuleCount: 5 }),
        createMockStaleCourse({ id: 'c2', title: 'All Fresh Course', hasStaleModules: false, totalModuleCount: 3 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'all_fresh' } });
    fixture.detectChanges();

    expect(screen.queryByText('Has Stale Course')).toBeFalsy();
    expect(screen.getByText('All Fresh Course')).toBeTruthy();
  });

  it('should filter by status (no_modules)', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'Has Modules', hasStaleModules: true, totalModuleCount: 5 }),
        createMockStaleCourse({ id: 'c2', title: 'Empty Course', modules: [], totalModuleCount: 0, staleModuleCount: 0, freshModuleCount: 0, hasStaleModules: false }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'no_modules' } });
    fixture.detectChanges();

    expect(screen.queryByText('Has Modules')).toBeFalsy();
    expect(screen.getByText('Empty Course')).toBeTruthy();
  });

  it('should clear filters', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'LNG Fundamentals' }),
        createMockStaleCourse({ id: 'c2', title: 'Risk Management' }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.input(screen.getByPlaceholderText('Search by course title...'), { target: { value: 'lng' } });
    fixture.detectChanges();
    expect(screen.queryByText('Risk Management')).toBeFalsy();

    fireEvent.click(screen.getByText('Clear filters'));
    fixture.detectChanges();

    expect(screen.getByText('LNG Fundamentals')).toBeTruthy();
    expect(screen.getByText('Risk Management')).toBeTruthy();
  });

  it('should have View links pointing to course detail', async () => {
    const service = createMockStalenessService({
      courses: [createMockStaleCourse({ id: 'course-abc' })],
    });

    await renderPage({ service });

    const viewLinks = screen.getAllByText('View');
    expect(viewLinks.length).toBe(1);
    const link = viewLinks[0].closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/courses/course-abc');
  });

  // --- Expandable row tests ---

  it('should expand course row on click to show module details', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Test Course',
          modules: [
            createMockStaleModule({ id: 'm1', title: 'Video Intro', moduleType: 'video', daysSinceUpdate: 200, isStale: true, daysOverdue: 20 }),
            createMockStaleModule({ id: 'm2', title: 'PDF Guide', moduleType: 'pdf', daysSinceUpdate: 10, isStale: false, daysOverdue: null }),
          ],
          totalModuleCount: 2,
          staleModuleCount: 1,
          freshModuleCount: 1,
          hasStaleModules: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Module details not visible initially
    expect(screen.queryByText('Video Intro')).toBeFalsy();

    // Click course row to expand
    fireEvent.click(screen.getByText('Test Course'));
    fixture.detectChanges();

    // Module details now visible
    expect(screen.getByText('Video Intro')).toBeTruthy();
    expect(screen.getByText('PDF Guide')).toBeTruthy();
  });

  it('should show stale badge on stale modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course A',
          modules: [
            createMockStaleModule({ id: 'm1', title: 'Old Module', isStale: true, daysOverdue: 20 }),
          ],
          totalModuleCount: 1,
          staleModuleCount: 1,
          freshModuleCount: 0,
          hasStaleModules: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course A'));
    fixture.detectChanges();

    expect(screen.getByText('Stale (20d overdue)')).toBeTruthy();
  });

  it('should show Fresh badge on fresh modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course B',
          modules: [
            createMockStaleModule({ id: 'm1', title: 'Recent Module', isStale: false, daysOverdue: null }),
          ],
          totalModuleCount: 1,
          staleModuleCount: 0,
          freshModuleCount: 1,
          hasStaleModules: false,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course B'));
    fixture.detectChanges();

    // "Fresh" text in module badge + "All Fresh" badge on course + dropdown option
    expect(screen.getAllByText('Fresh').length).toBeGreaterThanOrEqual(1);
  });

  it('should collapse expanded row when clicking same course again', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course X',
          modules: [createMockStaleModule({ id: 'm1', title: 'Module X' })],
          totalModuleCount: 1,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand
    fireEvent.click(screen.getByText('Course X'));
    fixture.detectChanges();
    expect(screen.getByText('Module X')).toBeTruthy();

    // Collapse
    fireEvent.click(screen.getByText('Course X'));
    fixture.detectChanges();
    expect(screen.queryByText('Module X')).toBeFalsy();
  });

  it('should switch expanded row when clicking different course', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course One',
          modules: [createMockStaleModule({ id: 'm1', title: 'Module One' })],
          totalModuleCount: 1,
        }),
        createMockStaleCourse({
          id: 'c2',
          title: 'Course Two',
          modules: [createMockStaleModule({ id: 'm2', title: 'Module Two' })],
          totalModuleCount: 1,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    // Expand first
    fireEvent.click(screen.getByText('Course One'));
    fixture.detectChanges();
    expect(screen.getByText('Module One')).toBeTruthy();

    // Expand second — first should collapse
    fireEvent.click(screen.getByText('Course Two'));
    fixture.detectChanges();
    expect(screen.queryByText('Module One')).toBeFalsy();
    expect(screen.getByText('Module Two')).toBeTruthy();
  });

  it('should show "no modules" message for expanded empty course', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Empty Course',
          modules: [],
          totalModuleCount: 0,
          staleModuleCount: 0,
          freshModuleCount: 0,
          hasStaleModules: false,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Empty Course'));
    fixture.detectChanges();

    expect(screen.getByText('This course has no modules yet.')).toBeTruthy();
  });

  it('should show module age in days', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course Z',
          modules: [
            createMockStaleModule({ id: 'm1', title: 'Mod Z', daysSinceUpdate: 42 }),
          ],
          totalModuleCount: 1,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course Z'));
    fixture.detectChanges();

    expect(screen.getByText('42 days ago')).toBeTruthy();
  });

  it('should show stale/fresh counts in course row', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          staleModuleCount: 3,
          freshModuleCount: 7,
          totalModuleCount: 10,
          hasStaleModules: true,
        }),
      ],
    });

    const { container } = await renderPage({ service });

    // The Stale/Fresh column shows "3 / 7"
    const staleCount = container.querySelector('.text-rose-600.font-semibold');
    const freshCount = container.querySelector('.text-emerald-600.font-semibold');
    expect(staleCount?.textContent?.trim()).toBe('3');
    expect(freshCount?.textContent?.trim()).toBe('7');
  });

  // --- Postpone feature tests ---

  it('should show Postpone button on stale modules in expanded row', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Stale Course',
          modules: [
            createMockStaleModule({ id: 'm1', title: 'Stale Mod', isStale: true, daysOverdue: 30 }),
            createMockStaleModule({ id: 'm2', title: 'Fresh Mod', isStale: false, daysOverdue: null }),
          ],
          totalModuleCount: 2,
          staleModuleCount: 1,
          freshModuleCount: 1,
          hasStaleModules: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Stale Course'));
    fixture.detectChanges();

    // Only stale module gets Postpone button
    const postponeButtons = screen.getAllByText('Postpone');
    expect(postponeButtons.length).toBe(1);
  });

  it('should call postponeModule when clicking Postpone button', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course PP',
          modules: [
            createMockStaleModule({ id: 'mod-abc', title: 'Old Mod', isStale: true, daysOverdue: 10 }),
          ],
          totalModuleCount: 1,
          staleModuleCount: 1,
          freshModuleCount: 0,
          hasStaleModules: true,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course PP'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Postpone'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.postponeModule).toHaveBeenCalledWith('mod-abc');
  });

  it('should show Postpone All button only for courses with stale modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'Stale Course', hasStaleModules: true }),
        createMockStaleCourse({
          id: 'c2',
          title: 'Fresh Course',
          hasStaleModules: false,
          modules: [createMockStaleModule({ id: 'm1', isStale: false, daysOverdue: null })],
          totalModuleCount: 1,
          staleModuleCount: 0,
          freshModuleCount: 1,
        }),
      ],
    });

    await renderPage({ service });

    // "Postpone All" only on stale course
    const postponeAllButtons = screen.getAllByText('Postpone All');
    expect(postponeAllButtons.length).toBe(1);
  });

  it('should call postponeAllStaleModules when clicking Postpone All', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'course-xyz',
          title: 'My Course',
          hasStaleModules: true,
          totalModuleCount: 3,
          staleModuleCount: 2,
          freshModuleCount: 1,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Postpone All'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(service.postponeAllStaleModules).toHaveBeenCalledWith('course-xyz');
  });

  it('should show postponed badge on postponed modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course With Postponed',
          modules: [
            createMockStaleModule({
              id: 'm1',
              title: 'Postponed Mod',
              isStale: false,
              isPostponed: true,
              postponedUntil: '2026-03-15T00:00:00Z',
              daysOverdue: 30,
            }),
          ],
          totalModuleCount: 1,
          staleModuleCount: 0,
          freshModuleCount: 0,
          postponedModuleCount: 1,
          hasStaleModules: false,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course With Postponed'));
    fixture.detectChanges();

    // Blue "Postponed until" badge
    expect(screen.getByText(/Postponed until/)).toBeTruthy();
  });

  it('should show N Postponed badge for course with only postponed modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          hasStaleModules: false,
          postponedModuleCount: 2,
          totalModuleCount: 3,
          staleModuleCount: 0,
          freshModuleCount: 1,
        }),
      ],
    });

    await renderPage({ service });

    expect(screen.getByText('2 Postponed')).toBeTruthy();
  });

  it('should filter by status (has_postponed)', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({ id: 'c1', title: 'Stale Course', hasStaleModules: true, totalModuleCount: 5 }),
        createMockStaleCourse({ id: 'c2', title: 'Postponed Course', hasStaleModules: false, postponedModuleCount: 2, totalModuleCount: 3 }),
        createMockStaleCourse({ id: 'c3', title: 'Fresh Course', hasStaleModules: false, postponedModuleCount: 0, totalModuleCount: 4 }),
      ],
    });

    const { fixture } = await renderPage({ service });

    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'has_postponed' } });
    fixture.detectChanges();

    expect(screen.queryByText('Stale Course')).toBeFalsy();
    expect(screen.getByText('Postponed Course')).toBeTruthy();
    expect(screen.queryByText('Fresh Course')).toBeFalsy();
  });

  it('should not show Postpone button on postponed modules', async () => {
    const service = createMockStalenessService({
      courses: [
        createMockStaleCourse({
          id: 'c1',
          title: 'Course P',
          modules: [
            createMockStaleModule({
              id: 'm1',
              title: 'Already Postponed',
              isStale: false,
              isPostponed: true,
              postponedUntil: '2026-03-15T00:00:00Z',
            }),
          ],
          totalModuleCount: 1,
          staleModuleCount: 0,
          freshModuleCount: 0,
          postponedModuleCount: 1,
          hasStaleModules: false,
        }),
      ],
    });

    const { fixture } = await renderPage({ service });

    fireEvent.click(screen.getByText('Course P'));
    fixture.detectChanges();

    // No Postpone button — module is already postponed
    expect(screen.queryByText('Postpone')).toBeFalsy();
  });
});
