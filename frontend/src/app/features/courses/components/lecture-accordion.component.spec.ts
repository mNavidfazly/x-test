import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
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
    const toggleButton = screen.getByRole('button', { name: /Getting Started/ });

    expect(screen.getByText('Welcome Video')).toBeTruthy();

    await user.click(toggleButton);
    expect(screen.queryByText('Welcome Video')).toBeNull();

    await user.click(toggleButton);
    expect(screen.getByText('Welcome Video')).toBeTruthy();
  });

  it('should pass courseId to module items', async () => {
    await renderAccordion();

    const link = document.querySelector('a[href="/courses/c1/modules/m1"]');
    expect(link).toBeTruthy();
  });

  // --- Edit/Delete/Reorder tests ---

  it('should hide action buttons when canEdit is false', async () => {
    await renderAccordion({ canEdit: false });

    expect(screen.queryByTitle('Edit lecture')).toBeNull();
    expect(screen.queryByTitle('Delete lecture')).toBeNull();
    expect(screen.queryByTitle('Move up')).toBeNull();
    expect(screen.queryByTitle('Move down')).toBeNull();
  });

  it('should show action buttons when canEdit is true', async () => {
    await renderAccordion({ canEdit: true, isFirst: false, isLast: false });

    expect(screen.getByTitle('Edit lecture')).toBeTruthy();
    expect(screen.getByTitle('Delete lecture')).toBeTruthy();
    expect(screen.getByTitle('Move up')).toBeTruthy();
    expect(screen.getByTitle('Move down')).toBeTruthy();
  });

  it('should hide Move up when isFirst', async () => {
    await renderAccordion({ canEdit: true, isFirst: true, isLast: false });

    expect(screen.queryByTitle('Move up')).toBeNull();
    expect(screen.getByTitle('Move down')).toBeTruthy();
  });

  it('should hide Move down when isLast', async () => {
    await renderAccordion({ canEdit: true, isFirst: false, isLast: true });

    expect(screen.getByTitle('Move up')).toBeTruthy();
    expect(screen.queryByTitle('Move down')).toBeNull();
  });

  it('should emit edit on edit button click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let editEmitted = false;
    fixture.componentInstance.edit.subscribe(() => { editEmitted = true; });

    fireEvent.click(screen.getByTitle('Edit lecture'));

    expect(editEmitted).toBe(true);
  });

  it('should emit moveUp on move up click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true, isFirst: false });

    let moveUpEmitted = false;
    fixture.componentInstance.moveUp.subscribe(() => { moveUpEmitted = true; });

    fireEvent.click(screen.getByTitle('Move up'));

    expect(moveUpEmitted).toBe(true);
  });

  it('should emit moveDown on move down click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true, isLast: false });

    let moveDownEmitted = false;
    fixture.componentInstance.moveDown.subscribe(() => { moveDownEmitted = true; });

    fireEvent.click(screen.getByTitle('Move down'));

    expect(moveDownEmitted).toBe(true);
  });

  it('should show delete confirmation on delete click', async () => {
    await renderAccordion({ canEdit: true });

    fireEvent.click(screen.getByTitle('Delete lecture'));

    expect(screen.getByText('Yes, Delete')).toBeTruthy();
    expect(screen.getByText(/Are you sure/)).toBeTruthy();
  });

  it('should emit deleteConfirmed on confirm delete', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let deleteEmitted = false;
    fixture.componentInstance.deleteConfirmed.subscribe(() => { deleteEmitted = true; });

    fireEvent.click(screen.getByTitle('Delete lecture'));
    fireEvent.click(screen.getByText('Yes, Delete'));

    expect(deleteEmitted).toBe(true);
  });

  it('should cancel delete confirmation', async () => {
    await renderAccordion({ canEdit: true });

    fireEvent.click(screen.getByTitle('Delete lecture'));
    expect(screen.getByText('Yes, Delete')).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Yes, Delete')).toBeNull();
    expect(screen.getByTitle('Delete lecture')).toBeTruthy();
  });
});
