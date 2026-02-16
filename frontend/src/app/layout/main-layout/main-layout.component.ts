import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { LucideAngularModule, X } from 'lucide-angular';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { HeaderComponent } from '../header/header.component';
import { ToastContainerComponent } from '../../shared/components/toast-container.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { SidebarService } from '../../core/services/sidebar.service';
import { AppNotification } from '../../core/models/notification.model';
import { getNotificationRoute } from '../../core/models/notification.model';

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, ToastContainerComponent, ConfirmDialogComponent, LucideAngularModule],
  host: {
    class: 'block',
    '(document:keydown)': 'onKeydown($event)',
  },
  template: `
    <div class="flex h-screen bg-slate-50">
      <app-sidebar
        [open]="sidebarOpen()"
        (openChange)="sidebarOpen.set($event)"
      />
      <div class="flex-1 flex flex-col min-w-0">
        <app-header (menuToggle)="sidebarOpen.set(!sidebarOpen())" />
        <main id="main-content" class="flex-1 overflow-y-auto p-3 lg:p-4">
          <router-outlet />
        </main>
      </div>
    </div>

    <app-toast-container />
    <app-confirm-dialog />

    @if (notificationService.latestToast(); as toast) {
      <div
        class="notification-enter fixed top-4 left-4 right-4 z-50 sm:left-auto sm:max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg p-4 flex items-start gap-3 cursor-pointer"
        (click)="onToastClick(toast)"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-900 truncate">{{ toast.title }}</p>
          @if (toast.body) {
            <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ toast.body }}</p>
          }
        </div>
        <button
          class="text-slate-400 hover:text-slate-600 p-1 shrink-0"
          (click)="onDismissToast($event)"
          aria-label="Dismiss"
        >
          <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
        </button>
      </div>
    }
  `,
})
export class MainLayoutComponent {
  readonly icons = { X };
  readonly notificationService = inject(NotificationService);
  #router = inject(Router);
  #sidebar = inject(SidebarService);

  sidebarOpen = signal(false);

  onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      if (window.innerWidth >= 1024) this.#sidebar.toggle();
    }
  }

  async onToastClick(notification: AppNotification): Promise<void> {
    this.notificationService.dismissToast();
    await this.notificationService.markAsRead(notification.id);
    const route = getNotificationRoute(notification.type, notification.data);
    if (route) {
      this.#router.navigateByUrl(route);
    }
  }

  onDismissToast(event: Event): void {
    event.stopPropagation();
    this.notificationService.dismissToast();
  }
}
