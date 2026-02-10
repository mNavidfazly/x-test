import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ModuleItemComponent } from './module-item.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('ModuleItemComponent', () => {
  it('should render module title', async () => {
    await render(ModuleItemComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        module: { id: 'm1', title: 'Introduction Video', module_type: 'video', sort_order: 0 },
      },
    });

    expect(screen.getByText('Introduction Video')).toBeTruthy();
  });

  it('should show "Not started" when no progress', async () => {
    await render(ModuleItemComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        module: { id: 'm1', title: 'Module A', module_type: 'pdf', sort_order: 0 },
        progress: null,
      },
    });

    expect(screen.getByText('Not started')).toBeTruthy();
  });

  it('should show "Done" for completed modules', async () => {
    await render(ModuleItemComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        module: { id: 'm1', title: 'Module A', module_type: 'video', sort_order: 0 },
        progress: { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
      },
    });

    expect(screen.getByText('Done')).toBeTruthy();
  });

  it('should show "In progress" for in-progress modules', async () => {
    await render(ModuleItemComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        module: { id: 'm1', title: 'Module A', module_type: 'quiz', sort_order: 0 },
        progress: { status: 'in_progress', completed_at: null },
      },
    });

    expect(screen.getByText('In progress')).toBeTruthy();
  });
});
