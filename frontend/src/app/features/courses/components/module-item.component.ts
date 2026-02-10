import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideAngularModule, LucideIconData, Video, FileText, Type, HelpCircle, ClipboardCheck, Check } from 'lucide-angular';
import { ModuleSummary, ModuleProgress } from '../../../core/models/course.model';

const TYPE_ICONS: Record<string, LucideIconData> = {
  video: Video,
  pdf: FileText,
  markdown: Type,
  quiz: HelpCircle,
  exam: ClipboardCheck,
};

@Component({
  selector: 'app-module-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all duration-200">
      <lucide-icon [img]="typeIcon()" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
      <span class="text-sm text-slate-700 flex-1 truncate">{{ module().title }}</span>
      @if (progress(); as p) {
        @switch (p.status) {
          @case ('completed') {
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <lucide-icon [img]="checkIcon" [size]="14"></lucide-icon>
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
    </div>
  `,
})
export class ModuleItemComponent {
  readonly module = input.required<ModuleSummary>();
  readonly progress = input<ModuleProgress | null>(null);

  readonly checkIcon = Check;

  readonly typeIcon = computed(() => {
    return TYPE_ICONS[this.module().module_type] ?? FileText;
  });
}
