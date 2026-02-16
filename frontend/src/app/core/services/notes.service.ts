import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { extractErrorMessage } from '../utils/error.utils';

export interface NoteWithContext {
  module_id: string;
  course_id: string;
  notes: string;
  updated_at: string;
  module_title: string;
  course_title: string;
  lecture_title: string;
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  #supabase = inject(SupabaseService);
  #auth = inject(AuthService);

  #notes = signal<NoteWithContext[]>([]);
  #loading = signal(false);
  #error = signal('');

  readonly notes = this.#notes.asReadonly();
  readonly loading = this.#loading.asReadonly();
  readonly error = this.#error.asReadonly();

  async loadMyNotes() {
    this.#loading.set(true);
    this.#error.set('');

    try {
      const userId = this.#auth.currentUser()?.id;
      if (!userId) {
        this.#error.set('Not authenticated');
        return;
      }

      const { data, error } = await this.#supabase.client
        .from('user_progress')
        .select('module_id, course_id, notes, updated_at, modules(title), lectures(title), courses(title)')
        .eq('user_id', userId)
        .not('notes', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const result: NoteWithContext[] = (data ?? []).map((row: any) => ({
        module_id: row.module_id,
        course_id: row.course_id,
        notes: row.notes,
        updated_at: row.updated_at,
        module_title: row.modules?.title ?? 'Unknown Module',
        course_title: row.courses?.title ?? 'Unknown Course',
        lecture_title: row.lectures?.title ?? '',
      }));

      this.#notes.set(result);
    } catch (err) {
      this.#error.set(extractErrorMessage(err, 'Failed to load notes'));
    } finally {
      this.#loading.set(false);
    }
  }

  async deleteNote(moduleId: string) {
    const userId = this.#auth.currentUser()?.id;
    if (!userId) return;

    const { error } = await this.#supabase.client
      .from('user_progress')
      .update({ notes: null })
      .eq('module_id', moduleId)
      .eq('user_id', userId);

    if (error) throw new Error(extractErrorMessage(error, 'Failed to delete note'));

    this.#notes.update(notes => notes.filter(n => n.module_id !== moduleId));
  }
}
