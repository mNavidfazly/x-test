import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, StickyNote, Search, ChevronDown, ChevronUp, BookOpen, Trash2 } from 'lucide-angular';
import { NotesService } from '../../../core/services/notes.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-my-notes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink, ErrorAlertComponent],
  host: { class: 'block page-enter' },
  template: `
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
          <lucide-icon [img]="icons.StickyNote" [size]="20"></lucide-icon>
        </div>
        <div>
          <h1 class="page-title">My Notes</h1>
          <p class="text-sm text-slate-500">Notes you've taken across courses</p>
        </div>
        @if (notesService.notes().length > 0) {
          <span class="ml-auto badge-neutral">
            {{ notesService.notes().length }}
          </span>
        }
      </div>

      @if (notesService.loading()) {
        <div class="space-y-4">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="animate-pulse card p-4">
              <div class="h-4 bg-slate-200 rounded w-1/4 mb-2"></div>
              <div class="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          }
        </div>
      } @else if (notesService.error()) {
        <app-error-alert [message]="notesService.error()!" />
      } @else if (filteredNotes().length === 0 && !searchQuery()) {
        <div class="text-center py-16">
          <lucide-icon [img]="icons.StickyNote" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm font-semibold text-slate-600">No notes yet</p>
          <p class="text-xs text-slate-400 mt-1">Start taking notes from any module page.</p>
        </div>
      } @else {
        <!-- Search -->
        <div class="mb-4">
          <div class="relative">
            <lucide-icon [img]="icons.Search" [size]="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></lucide-icon>
            <input
              type="text"
              placeholder="Search notes..."
              class="search-input"
              [value]="searchQuery()"
              (input)="onSearch($event)"
            />
          </div>
        </div>

        @if (filteredNotes().length === 0) {
          <p class="text-center text-sm text-slate-400 py-8">No notes match your search.</p>
        } @else {
          <div class="space-y-3">
            @for (note of filteredNotes(); track note.module_id) {
              <div class="card overflow-hidden">
                <!-- Collapsed row -->
                <button
                  type="button"
                  (click)="toggleExpand(note.module_id)"
                  class="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-sm font-semibold text-slate-900">{{ note.course_title }}</span>
                    @if (note.lecture_title) {
                      <span class="text-xs text-slate-400">/ {{ note.lecture_title }}</span>
                    }
                    <span class="text-xs text-slate-400">/ {{ note.module_title }}</span>
                    <span class="ml-auto text-xs text-slate-400 whitespace-nowrap">{{ formatRelativeTime(note.updated_at) }}</span>
                    <lucide-icon
                      [img]="expandedId() === note.module_id ? icons.ChevronUp : icons.ChevronDown"
                      [size]="16"
                      class="text-slate-400 shrink-0"
                    ></lucide-icon>
                  </div>
                  <p class="text-sm text-slate-600 truncate">{{ note.notes }}</p>
                </button>

                <!-- Expanded detail -->
                @if (expandedId() === note.module_id) {
                  <div class="px-4 pb-4 border-t border-slate-100">
                    <p class="text-sm text-slate-700 whitespace-pre-wrap mt-3">{{ note.notes }}</p>
                    <div class="flex items-center gap-3 mt-3">
                      <a
                        [routerLink]="['/courses', note.course_id, 'modules', note.module_id]"
                        class="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-semibold transition-colors"
                      >
                        <lucide-icon [img]="icons.BookOpen" [size]="12"></lucide-icon>
                        Go to module
                      </a>
                      <button
                        type="button"
                        (click)="onDelete(note.module_id, $event)"
                        class="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-semibold transition-colors"
                      >
                        <lucide-icon [img]="icons.Trash2" [size]="12"></lucide-icon>
                        Delete note
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class MyNotesPageComponent implements OnInit {
  readonly notesService = inject(NotesService);
  #confirmDialog = inject(ConfirmDialogService);
  #toast = inject(ToastService);

  readonly icons = { StickyNote, Search, ChevronDown, ChevronUp, BookOpen, Trash2 };
  readonly formatRelativeTime = formatRelativeTime;

  readonly expandedId = signal<string | null>(null);
  readonly searchQuery = signal('');

  readonly filteredNotes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.notesService.notes();
    return this.notesService.notes().filter(n =>
      n.notes.toLowerCase().includes(q) ||
      n.module_title.toLowerCase().includes(q) ||
      n.course_title.toLowerCase().includes(q),
    );
  });

  ngOnInit() {
    this.notesService.loadMyNotes();
  }

  toggleExpand(id: string) {
    this.expandedId.update(current => current === id ? null : id);
  }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  async onDelete(moduleId: string, event: Event) {
    event.stopPropagation();
    const confirmed = await this.#confirmDialog.confirm({
      title: 'Delete note',
      message: 'This note will be permanently deleted.',
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.notesService.deleteNote(moduleId);
      this.#toast.success('Note deleted');
      if (this.expandedId() === moduleId) {
        this.expandedId.set(null);
      }
    } catch {
      this.#toast.error('Failed to delete note');
    }
  }
}
