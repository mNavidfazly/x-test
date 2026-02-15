import {
  ChangeDetectionStrategy, Component, computed, inject, output, signal,
} from '@angular/core';
import { Router, NavigationEnd, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { LucideAngularModule, Menu, Bell, ChevronDown, User, LogOut } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NotificationService } from '../../core/services/notification.service';
import { UserAvatarComponent } from '../../shared/components/user-avatar.component';

const ROUTE_NAME_MAP: readonly [string, string][] = [
  ['/teaching/courses', 'Teaching Overview'],
  ['/teaching/grading', 'Exam Grading'],
  ['/teaching/questions', 'Questions Board'],
  ['/teaching/issues', 'Issue Management'],
  ['/teaching/staleness', 'Content Staleness'],
  ['/admin/users', 'User Management'],
  ['/admin/access-requests', 'Access Requests'],
  ['/analytics/progress', 'Progress Dashboard'],
  ['/platform/tenants', 'Tenant Management'],
  ['/platform/lecturer-assignments', 'Lecturer Assignments'],
  ['/platform/content', 'Content Management'],
  ['/dashboard', 'Dashboard'],
  ['/courses', 'Courses'],
  ['/questions', 'My Questions'],
  ['/issues', 'My Issues'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
];

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, UserAvatarComponent],
  host: { class: 'block' },
  template: `
    <header class="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4">
      <!-- Left: hamburger (mobile) / breadcrumb (desktop) -->
      <div class="flex items-center">
        <button
          class="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          (click)="menuToggle.emit()"
          aria-label="Toggle menu"
        >
          <lucide-icon [img]="icons.Menu" [size]="20"></lucide-icon>
        </button>

        @if (pageName()) {
          <nav class="hidden lg:flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <span class="italic font-semibold text-teal-600">X</span><span class="font-semibold text-slate-800">-Courses</span>
            <span class="text-slate-300 mx-0.5">/</span>
            <span class="text-slate-500">{{ pageName() }}</span>
          </nav>
        }
      </div>

      <!-- Right: notification bell + user menu -->
      <div class="flex items-center gap-2">
        <a
          routerLink="/notifications"
          class="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          aria-label="Notifications"
        >
          <lucide-icon [img]="icons.Bell" [size]="20"></lucide-icon>
          @if (unreadCount() > 0) {
            <span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none px-1">
              {{ unreadCount() > 99 ? '99+' : unreadCount() }}
            </span>
          }
        </a>

        <!-- User menu -->
        <div class="relative">
          <button
            (click)="menuOpen.set(!menuOpen())"
            class="flex items-center gap-2 p-1.5 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors duration-200
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            aria-label="User menu"
            aria-haspopup="true"
            [attr.aria-expanded]="menuOpen()"
          >
            <app-user-avatar
              [avatarUrl]="avatarUrl()"
              [name]="displayName()"
              size="sm"
            />
            <div class="hidden sm:flex flex-col items-start mr-1">
              <span class="text-sm font-medium text-slate-700 max-w-[120px] truncate leading-tight">
                {{ displayName() }}
              </span>
              <span class="text-[11px] text-slate-400 leading-tight">{{ roleLabel() }}</span>
            </div>
            <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
          </button>

          @if (menuOpen()) {
            <div class="fixed inset-0 z-40" (click)="menuOpen.set(false)"></div>
            <div
              class="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
              role="menu"
            >
              <div class="px-4 py-2.5 border-b border-slate-100">
                <p class="text-sm font-medium text-slate-900 truncate">{{ displayName() }}</p>
                <p class="text-xs text-slate-500 truncate">{{ userEmail() }}</p>
                <span class="badge-neutral text-[11px] mt-1.5 inline-block">{{ roleLabel() }}</span>
              </div>
              <a
                routerLink="/profile"
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                (click)="menuOpen.set(false)"
                role="menuitem"
              >
                <lucide-icon [img]="icons.User" [size]="16"></lucide-icon>
                Profile
              </a>
              <hr class="my-1 border-slate-100" />
              <button
                (click)="onSignOut()"
                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors duration-200"
                role="menuitem"
              >
                <lucide-icon [img]="icons.LogOut" [size]="16"></lucide-icon>
                Sign out
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  readonly icons = { Menu, Bell, ChevronDown, User, LogOut };

  menuToggle = output<void>();
  menuOpen = signal(false);

  #auth = inject(AuthService);
  #profile = inject(ProfileService);
  #notifications = inject(NotificationService);
  #router = inject(Router);

  unreadCount = this.#notifications.unreadCount;

  #currentUrl = toSignal(
    this.#router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.#router.url },
  );

  pageName = computed(() => {
    const url = this.#currentUrl();
    for (const [prefix, name] of ROUTE_NAME_MAP) {
      if (url.startsWith(prefix)) return name;
    }
    return null;
  });

  roleLabel = computed(() => {
    const roles = this.#auth.roles();
    if (roles.includes('platform_admin')) return 'Platform Admin';
    if (roles.includes('tenant_admin')) return 'Tenant Admin';
    if (roles.includes('lecturer')) return 'Lecturer';
    if (roles.includes('csm')) return 'CSM';
    return 'Learner';
  });

  userEmail = computed(() => this.#auth.currentUser()?.email ?? '');

  displayName = computed(() => {
    const profile = this.#profile.profile();
    if (profile?.full_name) return profile.full_name;
    return this.#auth.currentUser()?.email ?? '';
  });

  avatarUrl = computed(() => this.#profile.profile()?.avatar_url ?? null);

  async onSignOut() {
    this.menuOpen.set(false);
    await this.#auth.signOut();
  }
}
