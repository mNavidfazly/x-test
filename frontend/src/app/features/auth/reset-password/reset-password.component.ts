import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, Loader2, ArrowLeft, CheckCircle } from 'lucide-angular';
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
    <div class="auth-background">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-5xl font-bold">
            <span class="italic text-teal-400">X</span><span class="text-white">-Courses</span>
          </h1>
          <p class="text-sm text-slate-400 mt-2">by Calypso Commodities</p>
        </div>

        <div class="auth-card w-full max-w-md">
        <h2 class="text-xl font-semibold text-slate-800 text-center mb-6">Reset Password</h2>

        @if (errorMessage()) {
          <div class="mb-4 alert-error rounded-lg">
            {{ errorMessage() }}
          </div>
        }

        @switch (step()) {
          @case ('email') {
            <p class="text-sm text-slate-500 text-center mb-8">
              Enter your email and we'll send you a reset code.
            </p>

            <div class="mb-6">
              <label for="email" class="auth-label">Email</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                placeholder="you&#64;company.com"
                class="auth-input"
                [disabled]="loading()"
                (keydown.enter)="onSendCode()"
              />
            </div>

            <button
              (click)="onSendCode()"
              [disabled]="loading()"
              class="auth-btn-primary"
            >
              @if (loading()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
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
              <label for="code" class="auth-label">Reset code</label>
              <input
                id="code"
                type="text"
                [(ngModel)]="code"
                placeholder="Enter 6-digit code"
                maxlength="6"
                inputmode="numeric"
                autocomplete="one-time-code"
                class="auth-input text-center font-mono text-lg tracking-widest"
                [disabled]="loading()"
              />
            </div>

            <div class="mb-4">
              <label for="password" class="auth-label">New password</label>
              <input
                id="password"
                type="password"
                [(ngModel)]="newPassword"
                placeholder="At least 6 characters"
                class="auth-input"
                [disabled]="loading()"
              />
            </div>

            <div class="mb-6">
              <label for="confirmPassword" class="auth-label">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                [(ngModel)]="confirmPassword"
                placeholder="Repeat password"
                class="auth-input"
                [disabled]="loading()"
                (keydown.enter)="onResetPassword()"
              />
            </div>

            <button
              (click)="onResetPassword()"
              [disabled]="loading()"
              class="auth-btn-primary"
            >
              @if (loading()) {
                <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
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
  readonly icons = { Loader2, ArrowLeft, CheckCircle };

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
