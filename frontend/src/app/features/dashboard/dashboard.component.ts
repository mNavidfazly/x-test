import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { LucideAngularModule, GraduationCap, LogOut } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="min-h-screen bg-slate-50">
      <div class="max-w-2xl mx-auto pt-16 px-4">
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-8">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <lucide-icon [img]="icons.GraduationCap" class="text-teal-600" [size]="28"></lucide-icon>
              <h1 class="text-xl font-bold text-slate-900">Dashboard</h1>
            </div>
            <button
              (click)="onLogout()"
              class="bg-white border border-slate-300 text-slate-700 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition-all duration-200 flex items-center gap-2"
            >
              <lucide-icon [img]="icons.LogOut" [size]="16"></lucide-icon>
              Sign out
            </button>
          </div>

          <div class="space-y-3 text-sm">
            <div class="flex items-center gap-2">
              <span class="text-slate-500 w-24">Email:</span>
              <span class="text-slate-900 font-medium">{{ email() }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-500 w-24">Tenant ID:</span>
              <span class="text-slate-900 font-mono text-xs">{{ tenantId() }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-slate-500 w-24">Roles:</span>
              <div class="flex flex-wrap gap-1">
                @for (role of roles(); track role) {
                  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700">
                    {{ role }}
                  </span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  readonly icons = { GraduationCap, LogOut };

  #auth = inject(AuthService);

  email = computed(() => this.#auth.currentUser()?.email ?? '');
  tenantId = computed(() => this.#auth.currentUser()?.tenantId ?? '');
  roles = computed(() => this.#auth.roles());

  async onLogout() {
    await this.#auth.signOut();
  }
}
