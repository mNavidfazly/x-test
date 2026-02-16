import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, Loader2 } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="auth-background">
      <div class="text-center">
        <h1 class="text-5xl font-bold mb-8">
          <span class="italic text-teal-400">X</span><span class="text-white">-Courses</span>
        </h1>
        <span class="inline-flex animate-spin mx-auto mb-4"><lucide-icon [img]="icons.Loader2" [size]="32" class="text-teal-400"></lucide-icon></span>
        <p class="text-sm text-slate-400">Completing sign in...</p>
      </div>
    </div>
  `,
})
export class AuthCallbackComponent {
  readonly icons = { Loader2 };

  #router = inject(Router);

  constructor() {
    const auth = inject(AuthService);

    // Supabase client with detectSessionInUrl: true automatically exchanges the PKCE code.
    // Once auth finishes loading, redirect based on authentication state.
    effect(() => {
      if (auth.loading()) return;

      if (auth.isAuthenticated()) {
        this.#router.navigate(['/']);
      } else {
        this.#router.navigate(['/login']);
      }
    });
  }
}
