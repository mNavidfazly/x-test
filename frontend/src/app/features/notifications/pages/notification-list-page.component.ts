import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  LucideAngularModule, Bell, CheckCheck, ChevronDown,
} from 'lucide-angular';
import { NotificationService } from '../../../core/services/notification.service';
import {
  AppNotification, NotificationType,
  getNotificationMeta, getNotificationRoute,
} from '../../../core/models/notification.model';
import type { LucideIconData } from 'lucide-angular';
import { formatRelativeTime } from '../../../core/utils/date.utils';
import { ErrorAlertComponent } from '../../../shared/components/error-alert.component';

@Component({
  selector: 'app-notification-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ErrorAlertComponent],
  host: { class: 'block' },
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
          <lucide-icon [img]="icons.Bell" [size]="20"></lucide-icon>
        </div>
        <div>
          <h1 class="page-title">Notifications</h1>
          <p class="text-sm text-slate-500">Stay up to date with your courses</p>
        </div>
        @if (notificationService.unreadCount() > 0) {
          <span class="badge-error">
            {{ notificationService.unreadCount() }} unread
          </span>
        }
        @if (notificationService.unreadCount() > 0) {
          <button
            (click)="onMarkAllAsRead()"
            class="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors"
          >
            <lucide-icon [img]="icons.CheckCheck" [size]="16"></lucide-icon>
            Mark all as read
          </button>
        }
      </div>

      @if (notificationService.loading()) {
        <!-- Loading skeleton -->
        <div class="space-y-3">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="animate-pulse bg-white border border-slate-200 rounded-xl p-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                <div class="flex-1">
                  <div class="h-4 bg-slate-200 rounded w-1/3 mb-2"></div>
                  <div class="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else if (notificationService.error()) {
        <app-error-alert [message]="notificationService.error()!" />
      } @else if (notificationService.notifications().length === 0) {
        <!-- Empty state -->
        <div class="text-center py-16">
          <lucide-icon [img]="icons.Bell" [size]="48" class="text-slate-300 mx-auto mb-4"></lucide-icon>
          <p class="text-sm font-semibold text-slate-600">No notifications yet</p>
          <p class="text-xs text-slate-400 mt-1">You'll see updates about your courses here.</p>
        </div>
      } @else {
        <!-- Notification list -->
        <div class="space-y-2">
          @for (notification of visibleNotifications(); track notification.id) {
            <button
              type="button"
              (click)="onNotificationClick(notification)"
              class="w-full text-left bg-white border rounded-xl p-4 flex items-start gap-3 hover:bg-slate-50 transition-all duration-200"
              [class.border-l-4]="true"
              [class.border-l-teal-500]="!notification.read_at"
              [class.border-l-transparent]="!!notification.read_at"
              [class.border-slate-200]="true"
            >
              <!-- Icon -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                [class]="getIconColorClass(notification.type)"
              >
                <lucide-icon [img]="getIcon(notification.type)" [size]="16"></lucide-icon>
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-slate-900" [class.font-bold]="!notification.read_at">
                  {{ notification.title }}
                </p>
                @if (notification.body) {
                  <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ notification.body }}</p>
                }
              </div>

              <!-- Timestamp -->
              <span class="text-xs text-slate-400 whitespace-nowrap shrink-0">
                {{ formatRelativeTime(notification.created_at) }}
              </span>
            </button>
          }
        </div>

        @if (hasMore()) {
          <div class="text-center mt-4">
            <button
              type="button"
              (click)="onLoadMore()"
              class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all duration-200"
            >
              <lucide-icon [img]="icons.ChevronDown" [size]="16"></lucide-icon>
              Load more ({{ notificationService.notifications().length - visibleCount() }} remaining)
            </button>
          </div>
        }
      }
    </div>
  `,
})
export class NotificationListPageComponent implements OnInit {
  readonly notificationService = inject(NotificationService);
  #router = inject(Router);

  readonly icons = { Bell, CheckCheck, ChevronDown };
  readonly formatRelativeTime = formatRelativeTime;

  // Load-more pagination
  readonly visibleCount = signal(50);
  readonly visibleNotifications = computed(() =>
    this.notificationService.notifications().slice(0, this.visibleCount()),
  );
  readonly hasMore = computed(() =>
    this.notificationService.notifications().length > this.visibleCount(),
  );

  ngOnInit() {
    this.notificationService.loadNotifications();
  }

  async onNotificationClick(notification: AppNotification): Promise<void> {
    if (!notification.read_at) {
      await this.notificationService.markAsRead(notification.id);
    }
    const route = getNotificationRoute(notification.type, notification.data);
    if (route) {
      this.#router.navigateByUrl(route);
    }
  }

  onMarkAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  getIcon(type: NotificationType): LucideIconData {
    return getNotificationMeta(type).icon;
  }

  getIconColorClass(type: NotificationType): string {
    return getNotificationMeta(type).colorClass;
  }

  onLoadMore(): void {
    this.visibleCount.update(v => v + 50);
  }
}
