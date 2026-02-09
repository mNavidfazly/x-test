import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, GraduationCap } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { filterNavSections } from './sidebar-nav.config';

@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <!-- Mobile backdrop -->
    @if (open()) {
      <div
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
        (click)="close()"
      ></div>
    }

    <!-- Sidebar panel -->
    <aside
      class="fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 flex flex-col
             transition-transform duration-200
             lg:static lg:z-auto lg:translate-x-0"
      [class.-translate-x-full]="!open()"
      [class.translate-x-0]="open()"
    >
      <!-- Brand -->
      <div class="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200 shrink-0">
        <lucide-icon [img]="icons.GraduationCap" class="text-teal-600" [size]="24"></lucide-icon>
        <span class="text-lg font-bold text-slate-900">X-Course</span>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-4 px-3">
        @for (section of sections(); track section.label) {
          @if (section.label) {
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500 px-2 mt-4 mb-2">
              {{ section.label }}
            </div>
          }
          @for (item of section.items; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-teal-50 text-teal-700"
              [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-700
                     hover:bg-slate-100 transition-all duration-200 mb-0.5"
              (click)="close()"
            >
              <lucide-icon [img]="item.icon" [size]="18"></lucide-icon>
              {{ item.label }}
            </a>
          }
        }
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  readonly icons = { GraduationCap };

  open = input(false);
  openChange = output<boolean>();

  #auth = inject(AuthService);
  sections = computed(() => filterNavSections(this.#auth.roles()));

  close() {
    this.openChange.emit(false);
  }
}
