import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, GraduationCap, Loader2, ArrowLeft, CheckCircle } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

type Step = 'email' | 'code' | 'done';

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

          @if (errorMessage()) {
            <div class="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
              {{ errorMessage() }}
            </div>
          }

          @switch (step()) {
            @case ('email') {
              <p class="text-sm text-slate-500 text-center mb-8">
                Enter your email and we'll send you a reset code.
              </p>

              <div class="mb-6">
                <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  [(ngModel)]="email"
                  placeholder="you&#64;company.com"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  [disabled]="loading()"
                  (keydown.enter)="onSendCode()"
                />
              </div>

              <button
                (click)="onSendCode()"
                [disabled]="loading()"
                class="w-full bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                @if (loading()) {
                  <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
                }
                Send reset code
              </button>
            }

            @case ('code') {
              <div class="flex items-center gap-2 mb-2">
                <button (click)="onBackToEmail()" class="text-slate-400 hover:text-slate-600 transition-colors">
                  <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
                </button>
                <p class="text-sm text-slate-500">Enter the code sent to {{ email }}</p>
              </div>

              <div class="mb-4">
                <label for="code" class="block text-sm font-medium text-slate-700 mb-1">Reset code</label>
                <input
                  id="code"
                  type="text"
                  [(ngModel)]="code"
                  placeholder="Enter 6-digit code"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-center font-mono text-lg tracking-widest focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  [disabled]="loading()"
                />
              </div>

              <div class="mb-4">
                <label for="password" class="block text-sm font-medium text-slate-700 mb-1">New password</label>
                <input
                  id="password"
                  type="password"
                  [(ngModel)]="newPassword"
                  placeholder="At least 6 characters"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  [disabled]="loading()"
                />
              </div>

              <div class="mb-6">
                <label for="confirmPassword" class="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  [(ngModel)]="confirmPassword"
                  placeholder="Repeat password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  [disabled]="loading()"
                  (keydown.enter)="onResetPassword()"
                />
              </div>

              <button
                (click)="onResetPassword()"
                [disabled]="loading()"
                class="w-full bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                @if (loading()) {
                  <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
                }
                Set new password
              </button>
            }

            @case ('done') {
              <div class="text-center">
                <lucide-icon [img]="icons.CheckCircle" class="text-emerald-500 mx-auto mb-3" [size]="48"></lucide-icon>
                <p class="text-sm text-slate-700 mb-2">Your password has been reset successfully.</p>
                <p class="text-sm text-slate-500">You can now sign in with your new password.</p>
              </div>
            }
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
  readonly icons = { GraduationCap, Loader2, ArrowLeft, CheckCircle };

  #api = inject(ApiService);
  #auth = inject(AuthService);
  #route = inject(ActivatedRoute);

  email = this.#route.snapshot.queryParamMap.get('email') ?? '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  step = signal<Step>('email');
  loading = signal(false);
  errorMessage = signal('');

  async onSendCode() {
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
      this.step.set('code');
    } catch {
      this.errorMessage.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async onResetPassword() {
    if (!this.code || this.code.length !== 6) {
      this.errorMessage.set('Please enter the 6-digit code from your email.');
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMessage.set('Password must be at least 6 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.errorMessage.set('');
    this.loading.set(true);

    try {
      const { error: verifyError } = await this.#auth.verifyRecoveryOtp(this.email, this.code);
      if (verifyError) {
        this.errorMessage.set(verifyError.message);
        this.loading.set(false);
        return;
      }

      const { error: updateError } = await this.#auth.updatePassword(this.newPassword);
      if (updateError) {
        this.errorMessage.set(updateError.message);
        this.loading.set(false);
        return;
      }

      this.step.set('done');
    } catch {
      this.errorMessage.set('Something went wrong. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  onBackToEmail() {
    this.step.set('email');
    this.code = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage.set('');
  }
}
