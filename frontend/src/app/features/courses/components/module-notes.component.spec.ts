import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TestBed } from '@angular/core/testing';
import { ModuleNotesComponent } from './module-notes.component';
import { CourseService } from '../../../core/services/course.service';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('ModuleNotesComponent', () => {
  let mockCourseService: ReturnType<typeof createMockCourseService>;

  beforeEach(() => {
    mockCourseService = createMockCourseService();
  });

  const renderNotes = async (inputs?: { moduleId?: string; initialNotes?: string | null }) => {
    return render(ModuleNotesComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        moduleId: inputs?.moduleId ?? 'mod-1',
        initialNotes: inputs?.initialNotes ?? null,
      },
      providers: [
        { provide: CourseService, useValue: mockCourseService },
      ],
    });
  };

  it('should render collapsed by default', async () => {
    await renderNotes();

    expect(screen.getByText('My Notes')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Write your notes/)).toBeNull();
  });

  it('should show textarea when expanded', async () => {
    await renderNotes();
    const user = userEvent.setup();

    await user.click(screen.getByText('My Notes'));

    expect(screen.getByPlaceholderText(/Write your notes/)).toBeTruthy();
  });

  it('should initialize textarea with initialNotes', async () => {
    await renderNotes({ initialNotes: 'My existing note' });
    const user = userEvent.setup();

    await user.click(screen.getByText('My Notes'));

    const textarea = screen.getByPlaceholderText(/Write your notes/) as HTMLTextAreaElement;
    expect(textarea.value).toBe('My existing note');
  });

  it('should show "Has notes" badge when collapsed and has text', async () => {
    await renderNotes({ initialNotes: 'Some note content' });

    expect(screen.getByText('Has notes')).toBeTruthy();
  });

  it('should not show "Has notes" badge when no notes', async () => {
    await renderNotes({ initialNotes: null });

    expect(screen.queryByText('Has notes')).toBeNull();
  });

  it('should call saveModuleNotes after debounce', async () => {
    vi.useFakeTimers();
    const { fixture } = await renderNotes({ moduleId: 'mod-42' });

    // Directly call onInput to simulate user typing (avoids DOM timing issues with fake timers)
    fixture.componentInstance.onInput('New notes');
    fixture.detectChanges();
    TestBed.flushEffects();

    // Before debounce — not saved yet
    expect(mockCourseService.saveModuleNotes).not.toHaveBeenCalled();

    // Advance past debounce — timer fires debounced.set()
    vi.advanceTimersByTime(2000);
    // Signal change needs CD + effect flush to propagate
    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(mockCourseService.saveModuleNotes).toHaveBeenCalledWith('mod-42', 'New notes');

    vi.useRealTimers();
  });

  it('should not save if text unchanged from initial', async () => {
    vi.useFakeTimers();
    await renderNotes({ initialNotes: 'Existing text' });

    // Advance time — should not trigger save since text hasn't changed
    vi.advanceTimersByTime(3000);
    TestBed.flushEffects();

    expect(mockCourseService.saveModuleNotes).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should show save status indicators', async () => {
    vi.useFakeTimers();
    let resolvePromise: () => void;
    mockCourseService.saveModuleNotes = vi.fn().mockImplementation(() =>
      new Promise<void>(resolve => { resolvePromise = resolve; }),
    );

    const { fixture } = await renderNotes();

    // Expand
    fixture.componentInstance.expanded.set(true);
    fixture.detectChanges();

    // Simulate user typing
    const textarea = screen.getByPlaceholderText(/Write your notes/);
    fireEvent.input(textarea, { target: { value: 'Hello' } });
    fixture.detectChanges();
    TestBed.flushEffects();

    vi.advanceTimersByTime(2000);
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(screen.getByText('Saving...')).toBeTruthy();

    // Resolve the save
    resolvePromise!();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(screen.getByText('Saved')).toBeTruthy();

    vi.useRealTimers();
  });
});
