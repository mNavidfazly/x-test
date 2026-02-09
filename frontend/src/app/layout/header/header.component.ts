import {
  ChangeDetectionStrategy, Component, computed, inject, output, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Menu, Bell, ChevronDown, User, LogOut } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6">
      <!-- Left: hamburger -->
      <button
        class="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-all duration-200"
        (click)="menuToggle.emit()"
        aria-label="Toggle menu"
      >
        <lucide-icon [img]="icons.Menu" [size]="20"></lucide-icon>
      </button>

      <!-- Spacer on desktop -->
      <div class="hidden lg:block"></div>

      <!-- Right: notification bell + user menu -->
      <div class="flex items-center gap-3">
        <!-- Notification bell -->
        <a
          routerLink="/notifications"
          class="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-all duration-200"
          aria-label="Notifications"
        >
          <lucide-icon [img]="icons.Bell" [size]="20"></lucide-icon>
        </a>

        <!-- User menu -->
        <div class="relative">
          <button
            (click)="menuOpen.set(!menuOpen())"
            class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-all duration-200"
            aria-label="User menu"
          >
            <!-- Avatar -->
            @if (avatarUrl()) {
              <img
                [src]="avatarUrl()"
                [alt]="displayName()"
                class="w-8 h-8 rounded-full object-cover"
              />
            } @else {
              <div class="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold">
                {{ initials() }}
              </div>
            }
            <span class="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
              {{ displayName() }}
            </span>
            <lucide-icon [img]="icons.ChevronDown" [size]="16" class="text-slate-400"></lucide-icon>
          </button>

          <!-- Dropdown -->
          @if (menuOpen()) {
            <div class="fixed inset-0 z-40" (click)="menuOpen.set(false)"></div>
            <div class="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1">
              <a
                routerLink="/profile"
                class="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-all duration-200"
                (click)="menuOpen.set(false)"
              >
                <lucide-icon [img]="icons.User" [size]="16"></lucide-icon>
                Profile
              </a>
              <hr class="my-1 border-slate-100" />
              <button
                (click)="onSignOut()"
                class="w-full flex items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-all duration-200"
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

  displayName = computed(() => {
    const profile = this.#profile.profile();
    if (profile?.full_name) return profile.full_name;
    return this.#auth.currentUser()?.email ?? '';
  });

  avatarUrl = computed(() => this.#profile.profile()?.avatar_url ?? null);

  initials = computed(() => {
    const name = this.displayName();
    if (!name || name.includes('@')) {
      return name.charAt(0).toUpperCase();
    }
    return name
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  async onSignOut() {
    this.menuOpen.set(false);
    await this.#auth.signOut();
  }
}
