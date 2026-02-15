import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter, RouterLink } from '@angular/router';
import { CourseCardComponent } from './course-card.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockCourseWithProgress, createMockCourseLecturer } from '../../../__mocks__/course.mock';
import { UserAvatarComponent } from '../../../shared/components/user-avatar.component';

async function renderCard(overrides?: Parameters<typeof createMockCourseWithProgress>[0]) {
  await render(CourseCardComponent, {
    componentImports: [MockLucideIconComponent, RouterLink, UserAvatarComponent],
    componentInputs: { course: createMockCourseWithProgress(overrides) },
    providers: [provideRouter([])],
  });
}

describe('CourseCardComponent', () => {
  it('should render course title', async () => {
    await renderCard({ title: 'Angular Fundamentals' });
    expect(screen.getByText('Angular Fundamentals')).toBeTruthy();
  });

  it('should render course description', async () => {
    await renderCard({ description: 'Learn the basics of Angular' });
    expect(screen.getByText('Learn the basics of Angular')).toBeTruthy();
  });

  it('should show progress bar for enrolled courses', async () => {
    await renderCard({ isEnrolled: true, moduleCount: 10, completedModules: 3, progressPercent: 30 });
    expect(screen.getByText('3/10 modules')).toBeTruthy();
    expect(screen.getByText('30%')).toBeTruthy();
  });

  it('should not show progress bar for unenrolled courses', async () => {
    await renderCard({ isEnrolled: false, moduleCount: 10 });
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });

  it('should show "Continue" for in-progress courses', async () => {
    await renderCard({ isEnrolled: true, completedModules: 3, progressPercent: 30 });
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('should show "Start" for enrolled courses with no progress', async () => {
    await renderCard({ isEnrolled: true, completedModules: 0, progressPercent: 0 });
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('should show "Review" for completed courses', async () => {
    await renderCard({ isEnrolled: true, completedModules: 10, progressPercent: 100 });
    expect(screen.getByText('Review')).toBeTruthy();
  });

  it('should show "View" for unenrolled courses', async () => {
    await renderCard({ isEnrolled: false });
    expect(screen.getByText('View')).toBeTruthy();
  });

  it('should render enrollment badge', async () => {
    await renderCard({ enrollment_type: 'invite_only' });
    expect(screen.getByText('Invite only')).toBeTruthy();
  });

  it('should link to course detail page', async () => {
    await renderCard({ id: 'abc-123' });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/courses/abc-123');
  });

  // --- Lecturer display tests ---

  it('should show single lecturer name', async () => {
    await renderCard({
      lecturers: [createMockCourseLecturer({ full_name: 'Dr. Chen' })],
    });
    expect(screen.getByText('Dr. Chen')).toBeTruthy();
  });

  it('should show comma-joined names for 2 lecturers', async () => {
    await renderCard({
      lecturers: [
        createMockCourseLecturer({ user_id: 'l1', full_name: 'Dr. Chen' }),
        createMockCourseLecturer({ user_id: 'l2', full_name: 'Jane Smith' }),
      ],
    });
    expect(screen.getByText('Dr. Chen, Jane Smith')).toBeTruthy();
  });

  it('should show "+N more" for 3+ lecturers', async () => {
    await renderCard({
      lecturers: [
        createMockCourseLecturer({ user_id: 'l1', full_name: 'Dr. Chen' }),
        createMockCourseLecturer({ user_id: 'l2', full_name: 'Jane Smith' }),
        createMockCourseLecturer({ user_id: 'l3', full_name: 'Bob Jones' }),
      ],
    });
    expect(screen.getByText('Dr. Chen +2 more')).toBeTruthy();
  });

  it('should show nothing when lecturers is empty', async () => {
    await renderCard({ lecturers: [] });
    expect(screen.queryByText(/Dr\.|more/)).toBeNull();
  });

  it('should show avatar image when avatar_url is present', async () => {
    await renderCard({
      lecturers: [createMockCourseLecturer({ full_name: 'Dr. Chen', avatar_url: 'https://example.com/avatar.jpg' })],
    });
    const img = screen.getByAltText('Dr. Chen');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/avatar.jpg');
  });

  it('should show initials fallback when avatar_url is null', async () => {
    await renderCard({
      lecturers: [createMockCourseLecturer({ full_name: 'Dr. Chen', avatar_url: null })],
    });
    expect(screen.getByText('DC')).toBeTruthy();
  });
});
