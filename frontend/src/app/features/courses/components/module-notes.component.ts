import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { LucideAngularModule, StickyNote, Check, ChevronDown, ChevronUp } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { debouncedSignal } from '../../../core/utils/debounce.utils';

@Component({
  selector: 'app-module-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="card overflow-hidden">
      <button
        type="button"
        (click)="expanded.set(!expanded())"
        class="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors duration-200"
      >
        <div class="flex items-center gap-2">
          <lucide-icon [img]="icons.StickyNote" [size]="16" class="text-teal-600"></lucide-icon>
          <span class="text-sm font-semibold text-slate-700">My Notes</span>
          @if (noteText().length > 0 && !expanded()) {
            <span class="badge-neutral text-xs">Has notes</span>
          }
        </div>
        <div class="flex items-center gap-2">
          @if (saveStatus() === 'saving') {
            <span class="text-xs text-slate-400">Saving...</span>
          } @else if (saveStatus() === 'saved') {
            <span class="text-xs text-teal-600 flex items-center gap-1">
              <lucide-icon [img]="icons.Check" [size]="12"></lucide-icon>
              Saved
            </span>
          }
          <lucide-icon
            [img]="expanded() ? icons.ChevronUp : icons.ChevronDown"
            [size]="16"
            class="text-slate-400"
          ></lucide-icon>
        </div>
      </button>

      @if (expanded()) {
        <div class="px-4 pb-4 border-t border-slate-100">
          <textarea
            class="input-field mt-3 min-h-[120px] resize-y text-sm"
            placeholder="Write your notes here... They auto-save as you type."
            [value]="noteText()"
            (input)="onInput($any($event.target).value)"
          ></textarea>
        </div>
      }
    </div>
  `,
})
export class ModuleNotesComponent {
  readonly moduleId = input.required<string>();
  readonly initialNotes = input<string | null>(null);

  readonly icons = { StickyNote, Check, ChevronDown, ChevronUp };

  readonly #courseService = inject(CourseService);

  readonly expanded = signal(false);
  readonly noteText = signal('');
  readonly saveStatus = signal<'idle' | 'saving' | 'saved'>('idle');

  #lastSavedValue = '';
  #saveStatusTimer: ReturnType<typeof setTimeout> | null = null;
  #userHasTyped = false;

  constructor() {
    // Initialize noteText from initial notes input
    effect(() => {
      const initial = this.initialNotes();
      if (!this.#userHasTyped) {
        const value = initial ?? '';
        this.noteText.set(value);
        this.#lastSavedValue = value;
      }
    });

    // Debounced auto-save — only fires after user has typed
    const debouncedNote = debouncedSignal(this.noteText, 1500);

    effect(() => {
      const value = debouncedNote();
      if (!this.#userHasTyped) return;
      if (value === this.#lastSavedValue) return;
      this.#performSave(value);
    });
  }

  onInput(value: string) {
    this.#userHasTyped = true;
    this.noteText.set(value);
  }

  async #performSave(value: string) {
    this.saveStatus.set('saving');
    try {
      await this.#courseService.saveModuleNotes(this.moduleId(), value);
      this.#lastSavedValue = value;
      this.saveStatus.set('saved');

      if (this.#saveStatusTimer) clearTimeout(this.#saveStatusTimer);
      this.#saveStatusTimer = setTimeout(() => this.saveStatus.set('idle'), 3000);
    } catch {
      this.saveStatus.set('idle');
    }
  }
}
