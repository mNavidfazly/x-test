import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { LucideAngularModule, ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Plus, Clock } from 'lucide-angular';
import { formatDuration } from '../../../core/utils/date.utils';
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
      <div class="flex items-center bg-white hover:bg-slate-50 transition-colors duration-200">
        <!-- Toggle button -->
        <button
          (click)="toggle()"
          class="flex items-center gap-3 px-4 py-3.5 flex-1 text-left min-w-0"
          [attr.aria-expanded]="isOpen()"
        >
          <lucide-icon [img]="isOpen() ? icons.ChevronDown : icons.ChevronRight" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
          <div class="flex-1 min-w-0">
            <span class="text-sm font-semibold text-slate-900 block truncate">{{ lectureNumber() }}. {{ lecture().title }}</span>
            @if (lecture().description) {
              <span class="text-sm text-slate-500 block truncate mt-0.5">{{ lecture().description }}</span>
            }
            @if (totalCount() > 0) {
              <div class="lecture-progress-bar">
                <div class="lecture-progress-fill" [style.width.%]="lectureProgressPercent()"></div>
              </div>
            }
          </div>
          <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ formattedLectureDuration() }}</span>
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
              class="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors duration-200"
              title="Edit lecture"
            >
              <lucide-icon [img]="icons.Pencil" [size]="14"></lucide-icon>
            </button>
            @if (!isFirst()) {
              <button
                (click)="moveUp.emit()"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                title="Move up"
              >
                <lucide-icon [img]="icons.ChevronUp" [size]="14"></lucide-icon>
              </button>
            }
            @if (!isLast()) {
              <button
                (click)="moveDown.emit()"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                title="Move down"
              >
                <lucide-icon [img]="icons.ChevronDown" [size]="14"></lucide-icon>
              </button>
            }
            @if (!confirmingDelete()) {
              <button
                (click)="confirmingDelete.set(true)"
                class="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors duration-200"
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
              class="btn-danger-solid"
            >
              Yes, Delete
            </button>
            <button
              (click)="confirmingDelete.set(false)"
              class="btn-secondary btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Module list -->
      @if (isOpen()) {
        <div class="border-t border-slate-100 bg-white px-2 py-1">
          @for (mod of lecture().modules; track mod.id; let i = $index; let first = $first; let last = $last) {
            <app-module-item
              [module]="mod"
              [courseId]="courseId()"
              [moduleNumber]="i + 1"
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
              class="dashed-action-btn mt-1 mb-1 py-2 text-xs inline-flex items-center justify-center gap-1.5 font-semibold"
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
  readonly lectureNumber = input(1);
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

  readonly icons = { ChevronDown, ChevronRight, ChevronUp, Pencil, Trash2, Plus, Clock };

  readonly #hasProgress = computed(() => {
    const map = this.progressMap();
    return this.lecture().modules.some(m => {
      const status = map[m.id]?.status;
      return status === 'in_progress' || status === 'completed';
    });
  });

  readonly isOpen = linkedSignal(() => this.#hasProgress());
  readonly confirmingDelete = signal(false);

  readonly totalCount = computed(() => this.lecture().modules.length);

  readonly lectureDuration = computed(() =>
    this.lecture().modules.reduce((sum, m) => sum + m.estimated_duration_minutes, 0),
  );
  readonly formattedLectureDuration = computed(() => formatDuration(this.lectureDuration()));

  readonly completedCount = computed(() => {
    const map = this.progressMap();
    return this.lecture().modules.filter(m => map[m.id]?.status === 'completed').length;
  });

  readonly lectureProgressPercent = computed(() => {
    const total = this.totalCount();
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  });

  toggle() {
    this.isOpen.update(v => !v);
  }
}
