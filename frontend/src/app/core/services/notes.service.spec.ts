import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { NotesService } from './notes.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('NotesService', () => {
  let service: NotesService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotesService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, userId: 'test-user-id' }) },
      ],
    });
    service = TestBed.inject(NotesService);
  });

  it('should load notes successfully', async () => {
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({
        data: [
          {
            module_id: 'mod-1', course_id: 'c1', notes: 'My study notes',
            updated_at: '2026-02-16T10:00:00Z',
            modules: { title: 'Module 1' }, lectures: { title: 'Lecture 1' }, courses: { title: 'Course A' },
          },
        ],
        error: null,
      }),
    );

    await service.loadMyNotes();

    expect(service.notes()).toHaveLength(1);
    expect(service.notes()[0].notes).toBe('My study notes');
    expect(service.notes()[0].module_title).toBe('Module 1');
    expect(service.notes()[0].course_title).toBe('Course A');
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should handle load error', async () => {
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
      resolve({ data: null, error: { message: 'DB error' } }),
    );

    await service.loadMyNotes();

    expect(service.notes()).toHaveLength(0);
    expect(service.error()).toBe('DB error');
  });

  it('should delete note and update local state', async () => {
    // Pre-populate notes
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
      resolve({
        data: [
          { module_id: 'mod-1', course_id: 'c1', notes: 'Note 1', updated_at: '2026-02-16T10:00:00Z', modules: { title: 'M1' }, lectures: { title: 'L1' }, courses: { title: 'C1' } },
          { module_id: 'mod-2', course_id: 'c1', notes: 'Note 2', updated_at: '2026-02-16T09:00:00Z', modules: { title: 'M2' }, lectures: { title: 'L1' }, courses: { title: 'C1' } },
        ],
        error: null,
      }),
    );
    await service.loadMyNotes();
    expect(service.notes()).toHaveLength(2);

    // Mock the delete (update) call
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: null }) => void) =>
      resolve({ data: null, error: null }),
    );

    await service.deleteNote('mod-1');

    expect(service.notes()).toHaveLength(1);
    expect(service.notes()[0].module_id).toBe('mod-2');
  });

  it('should throw on delete error', async () => {
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
      resolve({ data: null, error: { message: 'Delete failed' } }),
    );

    await expect(service.deleteNote('mod-1')).rejects.toThrow('Delete failed');
  });

  it('should set loading state during load', async () => {
    let loadingDuringCall = false;
    supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) => {
      loadingDuringCall = service.loading();
      resolve({ data: [], error: null });
    });

    await service.loadMyNotes();

    expect(loadingDuringCall).toBe(true);
    expect(service.loading()).toBe(false);
  });
});
