import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, GraduationCap, Loader2 } from 'lucide-angular';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-access-request',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <div class="flex items-center justify-center gap-3 mb-6">
            <lucide-icon [img]="icons.GraduationCap" class="text-teal-600" [size]="32"></lucide-icon>
            <h1 class="text-xl font-bold text-slate-900">Request Access</h1>
          </div>

          @if (success()) {
            <div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              Your request has been submitted. You will be notified once it's reviewed.
            </div>
          } @else {
            <p class="text-sm text-slate-500 text-center mb-8">
              Enter your details and we'll notify your organization's admin.
            </p>

            @if (errorMessage()) {
              <div class="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {{ errorMessage() }}
              </div>
            }

            <div class="mb-4">
              <label for="fullName" class="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                id="fullName"
                type="text"
                [(ngModel)]="fullName"
                placeholder="John Doe"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                [disabled]="loading()"
              />
            </div>

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
              Submit Request
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
export class AccessRequestComponent {
  readonly icons = { GraduationCap, Loader2 };

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
