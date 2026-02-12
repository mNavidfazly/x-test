import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, LucideIconData, Video, FileText, Type, HelpCircle, ClipboardCheck, ExternalLink, Check, Pencil, ChevronUp, ChevronDown, Trash2 } from 'lucide-angular';
import { ModuleSummary, ModuleProgress } from '../../../core/models/course.model';

const TYPE_ICONS: Record<string, LucideIconData> = {
  video: Video,
  pdf: FileText,
  markdown: Type,
  quiz: HelpCircle,
  exam: ClipboardCheck,
  external_quiz: ExternalLink,
};

const LINKABLE_TYPES = new Set(['video', 'pdf', 'markdown', 'external_quiz']);

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
             class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200 cursor-pointer flex-1 min-w-0">
            <lucide-icon [img]="typeIcon()" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <span class="text-sm text-slate-700 flex-1 truncate">{{ module().title }}</span>
            @if (progress(); as p) {
              @switch (p.status) {
                @case ('completed') {
                  <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <lucide-icon [img]="icons.Check" [size]="14"></lucide-icon>
                    Done
                  </span>
                }
                @case ('in_progress') {
                  <span class="inline-flex items-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
                    In progress
                  </span>
                }
                @default {
                  <span class="text-xs text-slate-400">Not started</span>
                }
              }
            } @else {
              <span class="text-xs text-slate-400">Not started</span>
            }
          </a>
        } @else {
          <div class="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-default flex-1 min-w-0" title="Coming soon">
            <lucide-icon [img]="typeIcon()" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <span class="text-sm text-slate-400 flex-1 truncate">{{ module().title }}</span>
            <span class="text-xs text-slate-400">Coming soon</span>
          </div>
        }

        <!-- Action buttons -->
        @if (canEdit()) {
          <div class="flex items-center gap-0.5 pr-2 shrink-0" (click)="$event.stopPropagation()">
            <button
              (click)="edit.emit()"
              class="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-all duration-200"
              title="Edit module"
            >
              <lucide-icon [img]="icons.Pencil" [size]="12"></lucide-icon>
            </button>
            @if (!isFirst()) {
              <button
                (click)="moveUp.emit()"
                class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                title="Move up"
              >
                <lucide-icon [img]="icons.ChevronUp" [size]="12"></lucide-icon>
              </button>
            }
            @if (!isLast()) {
              <button
                (click)="moveDown.emit()"
                class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
                title="Move down"
              >
                <lucide-icon [img]="icons.ChevronDown" [size]="12"></lucide-icon>
              </button>
            }
            @if (!confirmingDelete()) {
              <button
                (click)="confirmingDelete.set(true)"
                class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200"
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
              class="bg-rose-600 text-white rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-rose-700 active:scale-95 transition-all duration-200"
            >
              Yes, Delete
            </button>
            <button
              (click)="confirmingDelete.set(false)"
              class="bg-white border border-slate-300 text-slate-700 rounded-md px-2.5 py-1 text-xs font-semibold hover:bg-slate-50 transition-all duration-200"
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
  readonly progress = input<ModuleProgress | null>(null);
  readonly canEdit = input(false);
  readonly isFirst = input(false);
  readonly isLast = input(false);

  readonly edit = output<void>();
  readonly deleteConfirmed = output<void>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();

  readonly icons = { Check, Pencil, ChevronUp, ChevronDown, Trash2 };
  readonly confirmingDelete = signal(false);

  readonly typeIcon = computed(() => {
    return TYPE_ICONS[this.module().module_type] ?? FileText;
  });

  readonly isLinkable = computed(() => {
    return LINKABLE_TYPES.has(this.module().module_type);
  });
}
