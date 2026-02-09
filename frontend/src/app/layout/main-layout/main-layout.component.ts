import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  host: { class: 'block' },
  template: `
    <div class="flex h-screen bg-slate-50">
      <app-sidebar
        [open]="sidebarOpen()"
        (openChange)="sidebarOpen.set($event)"
      />
      <div class="flex-1 flex flex-col min-w-0">
        <app-header (menuToggle)="sidebarOpen.set(!sidebarOpen())" />
        <main class="flex-1 overflow-y-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class MainLayoutComponent {
  sidebarOpen = signal(false);
}
