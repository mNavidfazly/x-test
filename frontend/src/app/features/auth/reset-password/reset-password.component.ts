import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, GraduationCap, Loader2 } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <div class="flex items-center justify-center gap-3 mb-6">
            <lucide-icon [img]="icons.GraduationCap" class="text-teal-600" [size]="32"></lucide-icon>
            <h1 class="text-xl font-bold text-slate-900">Reset Password</h1>
          </div>

          @if (success()) {
            <div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Check your email for a password reset link.
            </div>
          } @else {
            <p class="text-sm text-slate-500 text-center mb-8">
              Enter your email and we'll send you a password reset link.
            </p>

            @if (errorMessage()) {
              <div class="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {{ errorMessage() }}
              </div>
            }

            <div class="mb-6">
              <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                placeholder="you&#64;company.com"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                [disabled]="loading()"
                (keydown.enter)="onSubmit()"
              />
            </div>

            <button
              (click)="onSubmit()"
              [disabled]="loading()"
              class="w-full bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              @if (loading()) {
                <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
              }
              Send reset link
            </button>
          }

          <p class="mt-6 text-center text-sm text-slate-500">
            <a routerLink="/login" class="text-teal-600 font-medium hover:text-teal-700">Back to sign in</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent {
  readonly icons = { GraduationCap, Loader2 };

  #api = inject(ApiService);
  #route = inject(ActivatedRoute);

  email = this.#route.snapshot.queryParamMap.get('email') ?? '';
  loading = signal(false);
  success = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (!this.email) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    this.errorMessage.set('');
    this.loading.set(true);

    try {
      await firstValueFrom(
        this.#api.post('/auth/reset-password', { email: this.email }),
      );
      this.success.set(true);
    } catch {
      this.errorMessage.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
