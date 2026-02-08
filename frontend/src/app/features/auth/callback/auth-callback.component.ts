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
    <div class="min-h-screen bg-slate-50 flex items-center justify-center">
      <div class="text-center">
        <lucide-icon [img]="icons.Loader2" [size]="32" class="animate-spin text-teal-600 mx-auto mb-4"></lucide-icon>
        <p class="text-sm text-slate-500">Completing sign in...</p>
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
