import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, LucideIconData, Video, FileText, Type, HelpCircle, ClipboardCheck, ExternalLink, Headphones, FolderArchive, CheckCircle2, Circle, PlayCircle, Pencil, ChevronUp, ChevronDown, Trash2 } from 'lucide-angular';
import { ModuleSummary, ModuleProgress } from '../../../core/models/course.model';
import { formatDuration } from '../../../core/utils/date.utils';

const TYPE_ICONS: Record<string, LucideIconData> = {
  video: Video,
  pdf: FileText,
  markdown: Type,
  quiz: HelpCircle,
  exam: ClipboardCheck,
  external_quiz: ExternalLink,
  audio: Headphones,
  download: FolderArchive,
};

const LINKABLE_TYPES = new Set(['video', 'pdf', 'markdown', 'external_quiz', 'quiz', 'exam', 'audio', 'download']);

@Component({
  selector: 'app-module-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="group">
      <div class="flex items-center">
        @if (isLinkable()) {
          <a [routerLink]="['/courses', courseId(), 'modules', module().id]"
             class="module-item"
             [class.module-item-completed]="statusClass() === 'completed'"
             [class.module-item-active]="statusClass() === 'in_progress'"
             [attr.aria-label]="module().title + ' — ' + statusLabel()">

            <!-- Progress circle (LEFT) -->
            <span class="shrink-0 flex items-center justify-center w-5">
              @switch (statusClass()) {
                @case ('completed') {
                  <lucide-icon [img]="icons.CheckCircle2" [size]="20" class="text-emerald-500"></lucide-icon>
                }
                @case ('in_progress') {
                  <lucide-icon [img]="icons.PlayCircle" [size]="20" class="text-teal-600"></lucide-icon>
                }
                @default {
                  <lucide-icon [img]="icons.Circle" [size]="20" class="text-slate-300 group-hover:text-slate-400 transition-[color] duration-200"></lucide-icon>
                }
              }
            </span>

            <!-- Module type icon -->
            <lucide-icon [img]="typeIcon()" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>

            <!-- Title -->
            <span class="text-sm flex-1 truncate"
                  [class]="statusClass() === 'completed' ? 'text-slate-500' : statusClass() === 'in_progress' ? 'text-slate-900 font-medium' : 'text-slate-700'">
              {{ moduleNumber() }}. {{ module().title }}
            </span>

            <!-- Duration -->
            @if (formattedDuration() !== '0 min') {
              <span class="text-xs text-slate-400 shrink-0 tabular-nums">{{ formattedDuration() }}</span>
            }
          </a>
        } @else {
          <div class="module-item module-item-disabled" title="Coming soon">
            <span class="shrink-0 flex items-center justify-center w-5">
              <lucide-icon [img]="icons.Circle" [size]="20" class="text-slate-200"></lucide-icon>
            </span>
            <lucide-icon [img]="typeIcon()" [size]="16" class="text-slate-300 shrink-0"></lucide-icon>
            <span class="text-sm text-slate-400 flex-1 truncate">{{ moduleNumber() }}. {{ module().title }}</span>
            <span class="badge-neutral text-[10px]">Coming soon</span>
          </div>
        }

        <!-- Action buttons -->
        @if (canEdit()) {
          <div class="flex items-center gap-0.5 pr-2 shrink-0" (click)="$event.stopPropagation()">
            <button
              (click)="edit.emit()"
              class="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-[color,background-color] duration-200"
              title="Edit module"
            >
              <lucide-icon [img]="icons.Pencil" [size]="12"></lucide-icon>
            </button>
            @if (!isFirst()) {
              <button
                (click)="moveUp.emit()"
                class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-[color,background-color] duration-200"
                title="Move up"
              >
                <lucide-icon [img]="icons.ChevronUp" [size]="12"></lucide-icon>
              </button>
            }
            @if (!isLast()) {
              <button
                (click)="moveDown.emit()"
                class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-[color,background-color] duration-200"
                title="Move down"
              >
                <lucide-icon [img]="icons.ChevronDown" [size]="12"></lucide-icon>
              </button>
            }
            @if (!confirmingDelete()) {
              <button
                (click)="confirmingDelete.set(true)"
                class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-[color,background-color] duration-200"
                title="Delete module"
              >
                <lucide-icon [img]="icons.Trash2" [size]="12"></lucide-icon>
              </button>
            }
          </div>
        }
      </div>

      <!-- Delete confirmation -->
      @if (confirmingDelete()) {
        <div class="mx-3 mb-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
          <p class="text-xs text-rose-700 font-semibold mb-2">Delete this module?</p>
          <div class="flex items-center gap-2">
            <button
              (click)="deleteConfirmed.emit(); confirmingDelete.set(false)"
              class="btn-danger-solid btn-sm"
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
    </div>
  `,
})
export class ModuleItemComponent {
  readonly module = input.required<ModuleSummary>();
  readonly courseId = input.required<string>();
  readonly moduleNumber = input(1);
  readonly progress = input<ModuleProgress | null>(null);
  readonly canEdit = input(false);
  readonly isFirst = input(false);
  readonly isLast = input(false);

  readonly edit = output<void>();
  readonly deleteConfirmed = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();

  readonly icons = { CheckCircle2, Circle, PlayCircle, Pencil, ChevronUp, ChevronDown, Trash2 };
  readonly confirmingDelete = signal(false);

  readonly formattedDuration = computed(() => formatDuration(this.module().estimated_duration_minutes));

  readonly typeIcon = computed(() => {
    return TYPE_ICONS[this.module().module_type] ?? FileText;
  });

  readonly isLinkable = computed(() => {
    return LINKABLE_TYPES.has(this.module().module_type);
  });

  readonly statusClass = computed((): 'completed' | 'in_progress' | 'not_started' => {
    const p = this.progress();
    if (!p) return 'not_started';
    return p.status === 'completed' ? 'completed' : p.status === 'in_progress' ? 'in_progress' : 'not_started';
  });

  readonly statusLabel = computed(() => {
    switch (this.statusClass()) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In progress';
      default: return 'Not started';
    }
  });
}
