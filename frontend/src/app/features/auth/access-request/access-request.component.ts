import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Loader2 } from 'lucide-angular';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-access-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="auth-background">
      <div class="text-center mb-8">
        <h1 class="text-5xl font-bold">
          <span class="italic text-teal-400">X</span><span class="text-white">-Courses</span>
        </h1>
        <p class="text-sm text-slate-400 mt-2">by Calypso Commodities</p>
      </div>

      <div class="auth-card w-full max-w-md">
        <h2 class="text-xl font-semibold text-slate-800 text-center mb-6">Request Access</h2>

        @if (success()) {
          <div class="mb-4 alert-success rounded-lg">
            Your request has been submitted. You will be notified once it's reviewed.
          </div>
        } @else {
          <p class="text-sm text-slate-500 text-center mb-8">
            Enter your details and we'll notify your organization's admin.
          </p>

          @if (errorMessage()) {
            <div class="mb-4 alert-error rounded-lg">
              {{ errorMessage() }}
            </div>
          }

          <div class="mb-4">
            <label for="fullName" class="auth-label">Full Name</label>
            <input
              id="fullName"
              type="text"
              [(ngModel)]="fullName"
              placeholder="John Doe"
              class="auth-input"
              [disabled]="loading()"
            />
          </div>

          <div class="mb-6">
            <label for="email" class="auth-label">Email</label>
            <input
              id="email"
              type="email"
              [(ngModel)]="email"
              placeholder="you&#64;company.com"
              class="auth-input"
              [disabled]="loading()"
              (keydown.enter)="onSubmit()"
            />
          </div>

          <button
            (click)="onSubmit()"
            [disabled]="loading()"
            class="auth-btn-primary"
          >
            @if (loading()) {
              <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Loader2" [size]="16"></lucide-icon></span>
            }
            Submit Request
          </button>
        }

        <p class="mt-6 text-center text-sm text-slate-500">
          <a routerLink="/login" class="text-teal-600 font-medium hover:text-teal-700">Back to sign in</a>
        </p>
      </div>
    </div>
  `,
})
export class AccessRequestComponent {
  readonly icons = { Loader2 };

  #supabase = inject(SupabaseService);

  fullName = '';
  email = '';
  loading = signal(false);
  success = signal(false);
  errorMessage = signal('');

  async onSubmit() {
    if (!this.fullName || !this.email) {
      this.errorMessage.set('Please fill in all fields.');
      return;
    }

    if (!this.email.includes('@')) {
      this.errorMessage.set('Please enter a valid email address.');
      return;
    }

    const domain = this.email.split('@')[1].toLowerCase();

    this.errorMessage.set('');
    this.loading.set(true);

    const { error } = await this.#supabase.client
      .from('access_requests')
      .insert({
        email: this.email,
        full_name: this.fullName,
        domain,
        status: 'pending',
      });

    this.loading.set(false);

    if (error) {
      this.errorMessage.set(error.message);
    } else {
      this.success.set(true);
    }
  }
}
