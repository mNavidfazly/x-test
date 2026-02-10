import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter, RouterLink } from '@angular/router';
import { ModuleItemComponent } from './module-item.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('ModuleItemComponent', () => {
  const renderItem = async (inputs: Record<string, unknown>) => {
    return render(ModuleItemComponent, {
      componentImports: [MockLucideIconComponent, RouterLink],
      componentInputs: { courseId: 'c1', ...inputs },
      providers: [provideRouter([])],
    });
  };

  it('should render module title as link for video', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Introduction Video', module_type: 'video', sort_order: 0 },
    });

    expect(screen.getByText('Introduction Video')).toBeTruthy();
    const link = document.querySelector('a[href="/courses/c1/modules/m1"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for pdf type', async () => {
    await renderItem({
      module: { id: 'm2', title: 'Setup Guide', module_type: 'pdf', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m2"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for markdown type', async () => {
    await renderItem({
      module: { id: 'm3', title: 'Notes', module_type: 'markdown', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m3"]');
    expect(link).toBeTruthy();
  });

  it('should show "Coming soon" for quiz modules (no link)', async () => {
    await renderItem({
      module: { id: 'm4', title: 'Knowledge Check', module_type: 'quiz', sort_order: 0 },
    });

    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(document.querySelector('a')).toBeNull();
  });

  it('should show "Coming soon" for exam modules (no link)', async () => {
    await renderItem({
      module: { id: 'm5', title: 'Final Exam', module_type: 'exam', sort_order: 0 },
    });

    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(document.querySelector('a')).toBeNull();
  });

  it('should show "Not started" when no progress', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', module_type: 'video', sort_order: 0 },
      progress: null,
    });

    expect(screen.getByText('Not started')).toBeTruthy();
  });

  it('should show "Done" for completed modules', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', module_type: 'video', sort_order: 0 },
      progress: { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
    });

    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('should show "In progress" for in-progress modules', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', module_type: 'pdf', sort_order: 0 },
      progress: { status: 'in_progress', completed_at: null },
    });

    expect(screen.getByText('In progress')).toBeTruthy();
  });
});
