import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideRouter, RouterLink } from '@angular/router';
import { MyNotesPageComponent } from './my-notes-page.component';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';
import { NotesService } from '../../../core/services/notes.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { createMockNotesService, createMockNoteWithContext } from '../../../__mocks__/course.mock';
import { createMockConfirmDialogService } from '../../../__mocks__/confirm-dialog.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('MyNotesPageComponent', () => {
  let mockNotesService: ReturnType<typeof createMockNotesService>;
  let mockConfirmDialog: ReturnType<typeof createMockConfirmDialogService>;
  let mockToast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockNotesService = createMockNotesService();
    mockConfirmDialog = createMockConfirmDialogService();
    mockToast = { success: vi.fn(), error: vi.fn() };
  });

  const renderPage = async () => {
    return render(MyNotesPageComponent, {
      componentImports: [MockLucideIconComponent, RouterLink, ErrorAlertComponent],
      providers: [
        provideRouter([]),
        { provide: NotesService, useValue: mockNotesService },
        { provide: ConfirmDialogService, useValue: mockConfirmDialog },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  };

  it('should show loading skeleton', async () => {
    mockNotesService._setLoading(true);
    await renderPage();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('should show error alert', async () => {
    mockNotesService._setError('Failed to load');
    await renderPage();

    expect(screen.getByText('Failed to load')).toBeTruthy();
  });

  it('should show empty state when no notes', async () => {
    await renderPage();

    expect(screen.getByText('No notes yet')).toBeTruthy();
    expect(screen.getByText(/Start taking notes/)).toBeTruthy();
  });

  it('should render notes with course/module context', async () => {
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', course_title: 'Finance 101', module_title: 'Intro', lecture_title: 'Basics', notes: 'Key concepts here' }),
      createMockNoteWithContext({ module_id: 'mod-2', course_title: 'Finance 102', module_title: 'Advanced', lecture_title: '', notes: 'More notes' }),
    ]);
    await renderPage();

    expect(screen.getByText('Finance 101')).toBeTruthy();
    expect(screen.getByText('Key concepts here')).toBeTruthy();
    expect(screen.getByText('Finance 102')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // count badge
  });

  it('should expand and collapse note details', async () => {
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', notes: 'Full note text here' }),
    ]);
    await renderPage();
    const user = userEvent.setup();

    // Click to expand
    await user.click(screen.getByText('Full note text here'));

    expect(screen.getByText('Go to module')).toBeTruthy();
    expect(screen.getByText('Delete note')).toBeTruthy();

    // Click to collapse
    await user.click(screen.getAllByText('Full note text here')[0]);

    expect(screen.queryByText('Go to module')).toBeNull();
  });

  it('should filter notes by search query', async () => {
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', course_title: 'Finance 101', notes: 'Revenue analysis' }),
      createMockNoteWithContext({ module_id: 'mod-2', course_title: 'Marketing 201', notes: 'Brand strategy' }),
    ]);
    await renderPage();
    const user = userEvent.setup();

    const searchInput = screen.getByPlaceholderText('Search notes...');
    await user.type(searchInput, 'revenue');

    expect(screen.getByText('Finance 101')).toBeTruthy();
    expect(screen.queryByText('Marketing 201')).toBeNull();
  });

  it('should show no results message when search has no matches', async () => {
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', notes: 'Some notes' }),
    ]);
    await renderPage();
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Search notes...'), 'zzzznotfound');

    expect(screen.getByText('No notes match your search.')).toBeTruthy();
  });

  it('should delete note with confirmation', async () => {
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', notes: 'Will be deleted' }),
    ]);
    await renderPage();
    const user = userEvent.setup();

    // Expand note
    await user.click(screen.getByText('Will be deleted'));

    // Click delete
    await user.click(screen.getByText('Delete note'));

    expect(mockConfirmDialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Delete note', variant: 'danger' }),
    );
    expect(mockNotesService.deleteNote).toHaveBeenCalledWith('mod-1');
    expect(mockToast.success).toHaveBeenCalledWith('Note deleted');
  });

  it('should not delete note when confirmation cancelled', async () => {
    mockConfirmDialog.confirm = vi.fn().mockResolvedValue(false);
    mockNotesService._setNotes([
      createMockNoteWithContext({ module_id: 'mod-1', notes: 'Keep this' }),
    ]);
    await renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByText('Keep this'));
    await user.click(screen.getByText('Delete note'));

    expect(mockNotesService.deleteNote).not.toHaveBeenCalled();
  });

  it('should call loadMyNotes on init', async () => {
    await renderPage();

    expect(mockNotesService.loadMyNotes).toHaveBeenCalled();
  });
});
