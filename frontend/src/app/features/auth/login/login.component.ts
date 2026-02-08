import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, GraduationCap, Loader2, Mail, ArrowLeft } from 'lucide-angular';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { TenantResolution } from '../../../core/models/tenant.model';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, RouterLink],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <!-- Header -->
          <div class="flex items-center justify-center gap-3 mb-6">
            <lucide-icon [img]="icons.GraduationCap" class="text-teal-600" [size]="32"></lucide-icon>
            <h1 class="text-xl font-bold text-slate-900">X-Course v2</h1>
          </div>

          @if (step() === 'email') {
            <p class="text-sm text-slate-500 text-center mb-8">Enter your email to sign in</p>

            <!-- Error message -->
            @if (errorMessage()) {
              <div class="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {{ errorMessage() }}
              </div>
            }

            <!-- Email input -->
            <div class="mb-6">
              <label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                [(ngModel)]="email"
                placeholder="you&#64;company.com"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                [disabled]="resolving()"
                (keydown.enter)="onContinue()"
              />
            </div>

            <!-- Continue button -->
            <button
              (click)="onContinue()"
              [disabled]="resolving()"
              class="w-full bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              @if (resolving()) {
                <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
              }
              Continue
            </button>

            <p class="mt-6 text-center text-sm text-slate-500">
              Don't have an account?
              <a routerLink="/request-access" class="text-teal-600 font-medium hover:text-teal-700">Request access</a>
            </p>
          }

          @if (step() === 'methods') {
            <!-- Back button + tenant name -->
            <div class="flex items-center gap-2 mb-6">
              <button
                (click)="onBack()"
                class="bg-transparent text-slate-600 rounded-lg p-2 hover:bg-slate-100 transition-all duration-200"
                aria-label="Back"
              >
                <lucide-icon [img]="icons.ArrowLeft" [size]="16"></lucide-icon>
              </button>
              <p class="text-sm text-slate-500">
                @if (tenantName()) {
                  Sign in to <span class="font-semibold text-slate-700">{{ tenantName() }}</span>
                } @else {
                  Sign in
                }
              </p>
            </div>

            <p class="text-xs text-slate-400 mb-6">{{ email }}</p>

            <!-- Error message -->
            @if (errorMessage()) {
              <div class="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {{ errorMessage() }}
              </div>
            }

            <!-- Magic link sent confirmation -->
            @if (magicLinkSent()) {
              <div class="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
                Check your email for a sign-in link.
              </div>
            }

            <!-- No tenant found -->
            @if (noTenant()) {
              <div class="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                No account found for this domain.
              </div>
              <p class="text-sm text-center text-slate-500">
                <a routerLink="/request-access" class="text-teal-600 font-medium hover:text-teal-700">Request access</a>
              </p>
            }

            <!-- Azure SSO -->
            @if (showAzureSso()) {
              <button
                (click)="onAzureSso()"
                [disabled]="loading()"
                class="w-full bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 font-semibold hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
              >
                Sign in with Microsoft
              </button>
            }

            <!-- Email/Password -->
            @if (showEmailPassword()) {
              @if (showAzureSso()) {
                <div class="relative my-4">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-slate-200"></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span class="bg-white px-2 text-slate-400 uppercase tracking-wide">or</span>
                  </div>
                </div>
              }

              <div class="mb-4">
                <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  id="password"
                  type="password"
                  [(ngModel)]="password"
                  placeholder="Enter your password"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  [disabled]="loading()"
                  (keydown.enter)="onSignIn()"
                />
              </div>

              <button
                (click)="onSignIn()"
                [disabled]="loading()"
                class="w-full bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-2"
              >
                @if (loading() && !magicLinkLoading()) {
                  <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
                }
                Sign in
              </button>

              <p class="text-right text-sm mb-4">
                <a [routerLink]="['/reset-password']" [queryParams]="{ email: email }" class="text-teal-600 font-medium hover:text-teal-700">
                  Forgot password?
                </a>
              </p>
            }

            <!-- Magic link -->
            @if (showMagicLink()) {
              @if (showEmailPassword()) {
                <div class="relative my-4">
                  <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-slate-200"></div>
                  </div>
                  <div class="relative flex justify-center text-xs">
                    <span class="bg-white px-2 text-slate-400 uppercase tracking-wide">or</span>
                  </div>
                </div>
              }

              <button
                (click)="onSendMagicLink()"
                [disabled]="loading()"
                class="w-full bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 font-semibold hover:bg-slate-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                @if (magicLinkLoading()) {
                  <lucide-icon [img]="icons.Loader2" [size]="16" class="animate-spin"></lucide-icon>
                } @else {
                  <lucide-icon [img]="icons.Mail" [size]="16"></lucide-icon>
                }
                Send magic link
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  readonly icons = { GraduationCap, Loader2, Mail, ArrowLeft };

  #auth = inject(AuthService);
  #tenant = inject(TenantService);
  #router = inject(Router);

  email = '';
  password = '';

  step = signal<'email' | 'methods'>('email');
  errorMessage = signal('');
  loading = signal(false);
  resolving = signal(false);
  magicLinkSent = signal(false);
  magicLinkLoading = signal(false);

  #resolution = signal<TenantResolution | null>(null);

  tenantName = computed(() => this.#resolution()?.tenant_name ?? null);
  noTenant = computed(() => {
    const r = this.#resolution();
    return r !== null && r.auth_methods.length === 0;
  });
  showAzureSso = computed(() => this.#resolution()?.auth_methods.includes('azure_sso') ?? false);
  showEmailPassword = computed(() => this.#resolution()?.auth_methods.includes('email_password') ?? false);
  showMagicLink = computed(() => this.#resolution()?.auth_methods.includes('magic_link') ?? false);

  async onContinue() {
    if (!this.email) {
      this.errorMessage.set('Please enter your email address.');
      return;
    }

    this.errorMessage.set('');
    this.resolving.set(true);

    try {
      const resolution = await firstValueFrom(this.#tenant.resolveTenant(this.email));
      this.#resolution.set(resolution);
      this.step.set('methods');
    } catch {
      this.errorMessage.set('Unable to resolve your organization. Please try again.');
    } finally {
      this.resolving.set(false);
    }
  }

  onBack() {
    this.step.set('email');
    this.errorMessage.set('');
    this.magicLinkSent.set(false);
    this.#resolution.set(null);
    this.password = '';
  }

  async onSignIn() {
    if (!this.email || !this.password) return;

    this.errorMessage.set('');
    this.loading.set(true);

    const { error } = await this.#auth.signInWithPassword(this.email, this.password);

    if (error) {
      this.errorMessage.set(error.message);
      this.loading.set(false);
    } else {
      this.#router.navigate(['/']);
    }
  }

  async onSendMagicLink() {
    if (!this.email) return;

    this.errorMessage.set('');
    this.magicLinkSent.set(false);
    this.loading.set(true);
    this.magicLinkLoading.set(true);

    const { error } = await this.#auth.signInWithOtp(this.email);

    this.loading.set(false);
    this.magicLinkLoading.set(false);

    if (error) {
      this.errorMessage.set(error.message);
    } else {
      this.magicLinkSent.set(true);
    }
  }

  async onAzureSso() {
    this.errorMessage.set('');
    this.loading.set(true);

    const { error } = await this.#auth.signInWithOAuth('azure');

    if (error) {
      this.errorMessage.set(error.message);
      this.loading.set(false);
    }
  }
}
