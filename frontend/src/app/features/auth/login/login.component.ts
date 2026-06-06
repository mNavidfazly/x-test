import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, Loader2, KeyRound } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="auth-background">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-5xl font-bold">
            <span class="italic text-teal-400">X</span><span class="text-white">-Test</span>
          </h1>
          <p class="text-sm text-slate-400 mt-2">by Calypso Commodities</p>
        </div>

        <div class="auth-card w-full max-w-md">
          <p class="text-sm text-slate-500 text-center mb-8">Sign in to access the platform</p>

          <button
            (click)="onSignIn()"
            [disabled]="auth.loading()"
            class="auth-btn-primary flex items-center justify-center gap-2"
          >
            @if (auth.loading()) {
              <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
            } @else {
              <lucide-icon [img]="icons.KeyRound" [size]="16"></lucide-icon>
            }
            Sign in with SSO
          </button>

          <p class="text-xs text-slate-400 text-center mt-4">
            You will be redirected to your organization's login page
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly icons = { Loader2, KeyRound };
  readonly auth = inject(AuthService);

  #router = inject(Router);

  constructor() {
    effect(() => {
      if (!this.auth.loading() && this.auth.isAuthenticated()) {
        this.#router.navigate(['/']);
      }
    });
  }

  onSignIn(): void {
    this.auth.login();
  }
}
