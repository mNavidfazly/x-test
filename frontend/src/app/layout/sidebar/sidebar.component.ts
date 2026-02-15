import {
  ChangeDetectionStrategy, Component, computed, inject, input, output,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideAngularModule, ChevronsLeft, ChevronsRight } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { SidebarService } from '../../core/services/sidebar.service';
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
      class="fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col
             transition-[transform,width] duration-300
             lg:static lg:translate-x-0"
      [class.-translate-x-full]="!open()"
      [class.translate-x-0]="open()"
      [class.sidebar-desktop-collapsed]="sidebarService.collapsed()"
      [style.z-index]="'var(--z-sidebar)'"
    >
      <!-- Brand -->
      <div
        class="flex items-center shrink-0 h-14 border-b border-slate-200 sidebar-logo-gradient"
        [class.px-5]="!sidebarService.collapsed()"
        [class.justify-center]="sidebarService.collapsed()"
        [class.px-2]="sidebarService.collapsed()"
        aria-label="X-Courses"
      >
        @if (sidebarService.collapsed()) {
          <span class="text-xl font-bold italic text-white">X</span>
        } @else {
          <span class="text-xl font-bold">
            <span class="italic text-white">X</span><span class="text-white/80">-Courses</span>
          </span>
        }
      </div>

      <!-- Navigation -->
      <nav class="flex-1 overflow-y-auto py-4 px-3">
        @for (section of sections(); track section.label; let idx = $index) {
          @if (section.label) {
            @if (sidebarService.collapsed()) {
              <hr class="mx-1 my-2 border-t border-slate-200">
            } @else {
              <div class="section-label px-2 mt-4 mb-2">
                {{ section.label }}
              </div>
            }
          }
          @for (item of section.items; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="sidebar-nav-active"
              [routerLinkActiveOptions]="{ exact: item.route === '/dashboard' }"
              class="flex items-center rounded-xl py-2.5 text-sm text-slate-600
                     hover:bg-slate-100 transition-[background-color,color] duration-200 mb-0.5 border border-transparent"
              [class.gap-3]="!sidebarService.collapsed()"
              [class.px-3]="!sidebarService.collapsed()"
              [class.justify-center]="sidebarService.collapsed()"
              [class.px-0]="sidebarService.collapsed()"
              [attr.aria-label]="sidebarService.collapsed() ? item.label : null"
              (click)="close()"
            >
              <lucide-icon [img]="item.icon" [size]="18"></lucide-icon>
              @if (!sidebarService.collapsed()) {
                {{ item.label }}
              }
            </a>
          }
        }
      </nav>

      <!-- Footer -->
      <div class="shrink-0 border-t border-slate-200 p-2">
        <button
          class="hidden lg:flex items-center justify-center w-full rounded-lg py-2 text-slate-400
                 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          (click)="sidebarService.toggle()"
          [attr.aria-label]="sidebarService.collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <lucide-icon
            [img]="sidebarService.collapsed() ? icons.ChevronsRight : icons.ChevronsLeft"
            [size]="18"
          ></lucide-icon>
          @if (!sidebarService.collapsed()) {
            <span class="ml-2 text-xs">Collapse</span>
          }
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly icons = { ChevronsLeft, ChevronsRight };
  readonly sidebarService = inject(SidebarService);

  open = input(false);
  openChange = output<boolean>();

  #auth = inject(AuthService);
  sections = computed(() => filterNavSections(this.#auth.roles()));

  close() {
    this.openChange.emit(false);
  }
}
