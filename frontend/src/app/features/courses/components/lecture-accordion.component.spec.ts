import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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
  it('should render lecture title and module count', async () => {
    await render(LectureAccordionComponent, {
      componentImports: [MockLucideIconComponent, ModuleItemComponent],
      componentInputs: { lecture: mockLecture, progressMap: {} },
    });

    expect(screen.getByText('Getting Started')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy();
  });

  it('should show completed count', async () => {
    await render(LectureAccordionComponent, {
      componentImports: [MockLucideIconComponent, ModuleItemComponent],
      componentInputs: {
        lecture: mockLecture,
        progressMap: {
          'm1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
          'm2': { status: 'completed', completed_at: '2026-01-16T10:00:00Z' },
        },
      },
    });

    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('should render all modules when open', async () => {
    await render(LectureAccordionComponent, {
      componentImports: [MockLucideIconComponent, ModuleItemComponent],
      componentInputs: { lecture: mockLecture, progressMap: {} },
    });

    expect(screen.getByText('Welcome Video')).toBeTruthy();
    expect(screen.getByText('Setup Guide')).toBeTruthy();
    expect(screen.getByText('Knowledge Check')).toBeTruthy();
  });

  it('should collapse/expand on toggle click', async () => {
    await render(LectureAccordionComponent, {
      componentImports: [MockLucideIconComponent, ModuleItemComponent],
      componentInputs: { lecture: mockLecture, progressMap: {} },
    });

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
});
