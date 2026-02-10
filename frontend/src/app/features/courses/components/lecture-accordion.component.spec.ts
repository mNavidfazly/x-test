import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter, RouterLink } from '@angular/router';
import { LectureAccordionComponent } from './lecture-accordion.component';
import { ModuleItemComponent } from './module-item.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

const mockLecture = {
  id: 'l1',
  title: 'Getting Started',
  description: null,
  sort_order: 0,
  modules: [
    { id: 'm1', title: 'Welcome Video', module_type: 'video', sort_order: 0 },
    { id: 'm2', title: 'Setup Guide', module_type: 'pdf', sort_order: 1 },
    { id: 'm3', title: 'Knowledge Check', module_type: 'quiz', sort_order: 2 },
  ],
};

describe('LectureAccordionComponent', () => {
  const renderAccordion = async (inputs?: Record<string, unknown>) => {
    return render(LectureAccordionComponent, {
      componentImports: [MockLucideIconComponent, ModuleItemComponent, RouterLink],
      componentInputs: { lecture: mockLecture, courseId: 'c1', progressMap: {}, ...inputs },
      providers: [provideRouter([])],
    });
  };

  it('should render lecture title and module count', async () => {
    await renderAccordion();

    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
  });

  it('should show completed count', async () => {
    await renderAccordion({
      progressMap: {
        'm1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
        'm2': { status: 'completed', completed_at: '2026-01-16T10:00:00Z' },
      },
    });

    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('should render all modules when open', async () => {
    await renderAccordion();

    expect(screen.getByText('Welcome Video')).toBeTruthy();
    expect(screen.getByText('Setup Guide')).toBeTruthy();
    expect(screen.getByText('Knowledge Check')).toBeTruthy();
  });

  it('should collapse/expand on toggle click', async () => {
    await renderAccordion();

    const user = userEvent.setup();
    const toggleButton = screen.getByRole('button');

    // Initially open
    expect(screen.getByText('Welcome Video')).toBeTruthy();

    // Collapse
    await user.click(toggleButton);
    expect(screen.queryByText('Welcome Video')).toBeNull();

    // Expand
    await user.click(toggleButton);
    expect(screen.getByText('Welcome Video')).toBeTruthy();
  });

  it('should pass courseId to module items', async () => {
    await renderAccordion();

    // Video modules should have links with courseId in the URL
    const link = document.querySelector('a[href="/courses/c1/modules/m1"]');
    expect(link).toBeTruthy();
  });
});
