import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule, ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Plus } from 'lucide-angular';
import { LectureWithModules, ModuleProgress } from '../../../core/models/course.model';
import { ModuleItemComponent } from './module-item.component';

@Component({
  selector: 'app-lecture-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ModuleItemComponent],
  host: { class: 'block' },
  template: `
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <!-- Header row -->
      <div class="flex items-center bg-white hover:bg-slate-50 transition-all duration-200">
        <!-- Toggle button -->
        <button
          (click)="toggle()"
          class="flex items-center gap-3 px-4 py-3 flex-1 text-left min-w-0"
          [attr.aria-expanded]="isOpen()"
        >
          <lucide-icon [img]="isOpen() ? icons.ChevronDown : icons.ChevronRight" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
          <span class="text-sm font-semibold text-slate-900 flex-1 truncate">{{ lecture().title }}</span>
          <span class="text-xs font-semibold rounded-full px-2 py-0.5 shrink-0"
                [class]="completedCount() === totalCount() && totalCount() > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">
            {{ completedCount() }}/{{ totalCount() }}
          </span>
        </button>

        <!-- Action buttons -->
        @if (canEdit()) {
          <div class="flex items-center gap-1 px-2 shrink-0" (click)="$event.stopPropagation()">
            <button
              (click)="edit.emit()"
              class="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all duration-200"
              title="Edit lecture"
            >
              <lucide-icon [img]="icons.Pencil" [size]="14"></lucide-icon>
            </button>
            @if (!isFirst()) {
              <button
                (click)="moveUp.emit()"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                title="Move up"
              >
                <lucide-icon [img]="icons.ChevronUp" [size]="14"></lucide-icon>
              </button>
            }
            @if (!isLast()) {
              <button
                (click)="moveDown.emit()"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                title="Move down"
              >
                <lucide-icon [img]="icons.ChevronDown" [size]="14"></lucide-icon>
              </button>
            }
            @if (!confirmingDelete()) {
              <button
                (click)="confirmingDelete.set(true)"
                class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
                title="Delete lecture"
              >
                <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
              </button>
            }
          </div>
        }
      </div>

      <!-- Delete confirmation -->
      @if (confirmingDelete()) {
        <div class="border-t border-rose-200 bg-rose-50 px-4 py-3">
          <p class="text-sm text-rose-700 font-semibold mb-2">Are you sure? This will delete the lecture and all its modules.</p>
          <div class="flex items-center gap-2">
            <button
              (click)="deleteConfirmed.emit(); confirmingDelete.set(false)"
              class="bg-rose-600 text-white rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-rose-700 active:scale-95 transition-all duration-200"
            >
              Yes, Delete
            </button>
            <button
              (click)="confirmingDelete.set(false)"
              class="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Module list -->
      @if (isOpen()) {
        <div class="border-t border-slate-100 bg-slate-50/50 px-2 py-1">
          @for (mod of lecture().modules; track mod.id; let first = $first; let last = $last) {
            <app-module-item
              [module]="mod"
              [courseId]="courseId()"
              [progress]="progressMap()[mod.id] || null"
              [canEdit]="canEdit()"
              [isFirst]="first"
              [isLast]="last"
              (edit)="editModule.emit(mod.id)"
              (deleteConfirmed)="deleteModule.emit(mod.id)"
              (moveUp)="moveModuleUp.emit(mod.id)"
              (moveDown)="moveModuleDown.emit(mod.id)"
            />
          }

          <!-- Add Module button -->
          @if (canEdit()) {
            <button
              type="button"
              (click)="addModule.emit(); $event.stopPropagation()"
              class="w-full mt-1 mb-1 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-400 hover:border-teal-400 hover:text-teal-600 hover:bg-teal-50/30 transition-all duration-200 inline-flex items-center justify-center gap-1.5"
            >
              <lucide-icon [img]="icons.Plus" [size]="12"></lucide-icon>
              Add Module
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class LectureAccordionComponent {
  readonly lecture = input.required<LectureWithModules>();
  readonly progressMap = input.required<Record<string, ModuleProgress>>();
  readonly courseId = input.required<string>();
  readonly canEdit = input(false);
  readonly isFirst = input(false);
  readonly isLast = input(false);

  // Lecture-level outputs
  readonly edit = output<void>();
  readonly deleteConfirmed = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();

  // Module-level outputs
  readonly addModule = output<void>();
  readonly editModule = output<string>();
  readonly deleteModule = output<string>();
  readonly moveModuleUp = output<string>();
  readonly moveModuleDown = output<string>();

  readonly icons = { ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Plus };

  readonly isOpen = signal(true);
  readonly confirmingDelete = signal(false);

  readonly totalCount = computed(() => this.lecture().modules.length);

  readonly completedCount = computed(() => {
    const map = this.progressMap();
    return this.lecture().modules.filter(m => map[m.id]?.status === 'completed').length;
  });

  toggle() {
    this.isOpen.update(v => !v);
  }
}
