import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
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
      module: { id: 'm1', title: 'Introduction Video', description: null, module_type: 'video', sort_order: 0 },
    });

    expect(screen.getByText(/Introduction Video/)).toBeTruthy();
    const link = document.querySelector('a[href="/courses/c1/modules/m1"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for pdf type', async () => {
    await renderItem({
      module: { id: 'm2', title: 'Setup Guide', description: null, module_type: 'pdf', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m2"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for markdown type', async () => {
    await renderItem({
      module: { id: 'm3', title: 'Notes', description: null, module_type: 'markdown', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m3"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for quiz type', async () => {
    await renderItem({
      module: { id: 'm4', title: 'Knowledge Check', description: null, module_type: 'quiz', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m4"]');
    expect(link).toBeTruthy();
  });

  it('should render as link for exam type', async () => {
    await renderItem({
      module: { id: 'm5', title: 'Final Exam', description: null, module_type: 'exam', sort_order: 0 },
    });

    const link = document.querySelector('a[href="/courses/c1/modules/m5"]');
    expect(link).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('should show "Not started" status via aria-label when no progress', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      progress: null,
    });

    expect(screen.getByRole('link', { name: /Not started/ })).toBeTruthy();
  });

  it('should show "Completed" status via aria-label for completed modules', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      progress: { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
    });

    expect(screen.getByRole('link', { name: /Completed/ })).toBeTruthy();
  });

  it('should show "In progress" status via aria-label for in-progress modules', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'pdf', sort_order: 0 },
      progress: { status: 'in_progress', completed_at: null },
    });

    expect(screen.getByRole('link', { name: /In progress/ })).toBeTruthy();
  });

  // --- Action buttons: visibility ---

  it('should hide action buttons when canEdit is false', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: false,
    });

    expect(screen.queryByTitle('Edit module')).toBeNull();
    expect(screen.queryByTitle('Delete module')).toBeNull();
    expect(screen.queryByTitle('Move up')).toBeNull();
    expect(screen.queryByTitle('Move down')).toBeNull();
  });

  it('should show action buttons when canEdit is true', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
    });

    expect(screen.getByTitle('Edit module')).toBeTruthy();
    expect(screen.getByTitle('Delete module')).toBeTruthy();
  });

  it('should hide Move up when isFirst', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
      isFirst: true,
      isLast: false,
    });

    expect(screen.queryByTitle('Move up')).toBeNull();
    expect(screen.getByTitle('Move down')).toBeTruthy();
  });

  it('should hide Move down when isLast', async () => {
    await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
      isFirst: false,
      isLast: true,
    });

    expect(screen.getByTitle('Move up')).toBeTruthy();
    expect(screen.queryByTitle('Move down')).toBeNull();
  });

  // --- Action buttons: outputs ---

  it('should emit edit on edit button click', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
    });

    const spy = vi.fn();
    fixture.componentInstance.edit.subscribe(spy);

    fireEvent.click(screen.getByTitle('Edit module'));

    expect(spy).toHaveBeenCalledOnce();
  });

  it('should emit moveUp on move up click', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
      isFirst: false,
    });

    const spy = vi.fn();
    fixture.componentInstance.moveUp.subscribe(spy);

    fireEvent.click(screen.getByTitle('Move up'));

    expect(spy).toHaveBeenCalledOnce();
  });

  it('should emit moveDown on move down click', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
      isLast: false,
    });

    const spy = vi.fn();
    fixture.componentInstance.moveDown.subscribe(spy);

    fireEvent.click(screen.getByTitle('Move down'));

    expect(spy).toHaveBeenCalledOnce();
  });

  // --- Delete confirmation flow ---

  it('should show delete confirmation on delete click', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
    });

    fireEvent.click(screen.getByTitle('Delete module'));
    fixture.detectChanges();

    expect(screen.getByText('Delete this module?')).toBeTruthy();
    expect(screen.getByText('Yes, Delete')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('should emit deleteConfirmed on confirm delete', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
    });

    const spy = vi.fn();
    fixture.componentInstance.deleteConfirmed.subscribe(spy);

    fireEvent.click(screen.getByTitle('Delete module'));
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Yes, Delete'));

    expect(spy).toHaveBeenCalledOnce();
  });

  it('should cancel delete confirmation', async () => {
    const { fixture } = await renderItem({
      module: { id: 'm1', title: 'Module A', description: null, module_type: 'video', sort_order: 0 },
      canEdit: true,
    });

    fireEvent.click(screen.getByTitle('Delete module'));
    fixture.detectChanges();

    expect(screen.getByText('Delete this module?')).toBeTruthy();

    fireEvent.click(screen.getByText('Cancel'));
    fixture.detectChanges();

    expect(screen.queryByText('Delete this module?')).toBeNull();
    expect(screen.getByTitle('Delete module')).toBeTruthy();
  });
});
