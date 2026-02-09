import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h1 class="text-xl font-bold text-slate-900 mb-6">Dashboard</h1>

    <div class="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
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
  `,
})
export class DashboardComponent {
  #auth = inject(AuthService);

  email = computed(() => this.#auth.currentUser()?.email ?? '');
  tenantId = computed(() => this.#auth.currentUser()?.tenantId ?? '');
  roles = computed(() => this.#auth.roles());
}
