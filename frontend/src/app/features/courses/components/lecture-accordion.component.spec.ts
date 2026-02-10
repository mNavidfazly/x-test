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
    // Module items also render Move up/down buttons, so use getAllByTitle
    expect(screen.getAllByTitle('Move up').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTitle('Move down').length).toBeGreaterThanOrEqual(1);
  });

  it('should hide lecture-level Move up when isFirst', async () => {
    await renderAccordion({ canEdit: true, isFirst: true, isLast: false });

    // Lecture-level Move up is hidden, but module items still have their own Move up buttons.
    // The lecture-level button has class p-1.5, module-level has p-1. We verify by counting:
    // Without lecture Move up: only module-level buttons remain (m2 and m3 have Move up).
    const moveUpButtons = screen.queryAllByTitle('Move up');
    // All remaining Move up buttons should be module-level (p-1 class, size 12)
    moveUpButtons.forEach(btn => {
      expect(btn.className).toContain('p-1 ');
    });
    expect(screen.getAllByTitle('Move down').length).toBeGreaterThanOrEqual(1);
  });

  it('should hide lecture-level Move down when isLast', async () => {
    await renderAccordion({ canEdit: true, isFirst: false, isLast: true });

    expect(screen.getAllByTitle('Move up').length).toBeGreaterThanOrEqual(1);
    // Lecture-level Move down is hidden, but module items still have their own Move down buttons.
    const moveDownButtons = screen.queryAllByTitle('Move down');
    // All remaining Move down buttons should be module-level (p-1 class, size 12)
    moveDownButtons.forEach(btn => {
      expect(btn.className).toContain('p-1 ');
    });
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

    // First "Move up" button is the lecture-level one (p-1.5 class)
    fireEvent.click(screen.getAllByTitle('Move up')[0]);

    expect(moveUpEmitted).toBe(true);
  });

  it('should emit moveDown on move down click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true, isLast: false });

    let moveDownEmitted = false;
    fixture.componentInstance.moveDown.subscribe(() => { moveDownEmitted = true; });

    // First "Move down" button is the lecture-level one (p-1.5 class)
    fireEvent.click(screen.getAllByTitle('Move down')[0]);

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

  // --- Module-level action tests ---

  it('should show Add Module button when canEdit is true', async () => {
    await renderAccordion({ canEdit: true });

    expect(screen.getByText('Add Module')).toBeTruthy();
  });

  it('should hide Add Module button when canEdit is false', async () => {
    await renderAccordion({ canEdit: false });

    expect(screen.queryByText('Add Module')).toBeNull();
  });

  it('should emit addModule on Add Module click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let addModuleEmitted = false;
    fixture.componentInstance.addModule.subscribe(() => { addModuleEmitted = true; });

    fireEvent.click(screen.getByText('Add Module'));

    expect(addModuleEmitted).toBe(true);
  });

  it('should emit editModule with module id on edit module click', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let emittedId: string | null = null;
    fixture.componentInstance.editModule.subscribe((id: string) => { emittedId = id; });

    fireEvent.click(screen.getAllByTitle('Edit module')[0]);

    expect(emittedId).toBe('m1');
  });

  it('should emit deleteModule with module id on delete module confirm', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let emittedId: string | null = null;
    fixture.componentInstance.deleteModule.subscribe((id: string) => { emittedId = id; });

    // Click "Delete module" on the first module item
    fireEvent.click(screen.getAllByTitle('Delete module')[0]);
    // Confirm deletion — the module-item component shows "Yes, Delete"
    const deleteButtons = screen.getAllByText('Yes, Delete');
    fireEvent.click(deleteButtons[0]);

    expect(emittedId).toBe('m1');
  });

  it('should emit moveModuleUp with module id', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let emittedId: string | null = null;
    fixture.componentInstance.moveModuleUp.subscribe((id: string) => { emittedId = id; });

    // m1 is $first so no module-level Move up; m2 and m3 have module-level Move up.
    // With defaults isFirst=false, isLast=false: lecture-level Move up exists too.
    // moveUpButtons[0] = lecture Move up, [1] = m2 Move up, [2] = m3 Move up
    const moveUpButtons = screen.getAllByTitle('Move up');
    fireEvent.click(moveUpButtons[1]);

    expect(emittedId).toBe('m2');
  });

  it('should emit moveModuleDown with module id', async () => {
    const { fixture } = await renderAccordion({ canEdit: true });

    let emittedId: string | null = null;
    fixture.componentInstance.moveModuleDown.subscribe((id: string) => { emittedId = id; });

    // m1 and m2 have module-level Move down; m3 is $last so no module-level Move down.
    // With defaults isLast=false: lecture-level Move down exists too.
    // moveDownButtons[0] = lecture Move down, [1] = m1 Move down, [2] = m2 Move down
    const moveDownButtons = screen.getAllByTitle('Move down');
    fireEvent.click(moveDownButtons[1]);

    expect(emittedId).toBe('m1');
  });
});
