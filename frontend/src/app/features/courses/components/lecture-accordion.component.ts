import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LucideAngularModule, ChevronDown, ChevronRight } from 'lucide-angular';
import { LectureWithModules, ModuleProgress } from '../../../core/models/course.model';
import { ModuleItemComponent } from './module-item.component';

@Component({
  selector: 'app-lecture-accordion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ModuleItemComponent],
  host: { class: 'block' },
  template: `
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <button
        (click)="toggle()"
        class="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-all duration-200 text-left"
        [attr.aria-expanded]="isOpen()"
      >
        <lucide-icon [img]="isOpen() ? chevronDown : chevronRight" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
        <span class="text-sm font-semibold text-slate-900 flex-1">{{ lecture().title }}</span>
        <span class="text-xs font-semibold rounded-full px-2 py-0.5"
              [class]="completedCount() === totalCount() && totalCount() > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'">
          {{ completedCount() }}/{{ totalCount() }}
        </span>
      </button>

      @if (isOpen()) {
        <div class="border-t border-slate-100 bg-slate-50/50 px-2 py-1">
          @for (mod of lecture().modules; track mod.id) {
            <app-module-item
              [module]="mod"
              [progress]="progressMap()[mod.id] || null"
            />
          }
        </div>
      }
    </div>
  `,
})
export class LectureAccordionComponent {
  readonly lecture = input.required<LectureWithModules>();
  readonly progressMap = input.required<Record<string, ModuleProgress>>();

  readonly chevronDown = ChevronDown;
  readonly chevronRight = ChevronRight;

  readonly isOpen = signal(true);

  readonly totalCount = computed(() => this.lecture().modules.length);

  readonly completedCount = computed(() => {
    const map = this.progressMap();
    return this.lecture().modules.filter(m => map[m.id]?.status === 'completed').length;
  });

  toggle() {
    this.isOpen.update(v => !v);
  }
}
