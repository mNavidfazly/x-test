import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TenantSummary } from '../../../core/models/course.model';

@Component({
  selector: 'app-tenant-assignment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Tenant Assignment</h3>

      @if (tenants().length === 0) {
        <p class="text-sm text-slate-500">No tenants available.</p>
      } @else {
        <div class="space-y-2">
          @for (tenant of tenants(); track tenant.id) {
            <label
              class="flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-[background-color,border-color] duration-200"
              [class.border-teal-300]="isAssigned(tenant.id)"
              [class.bg-teal-50]="isAssigned(tenant.id)"
              [class.border-slate-200]="!isAssigned(tenant.id)"
              [class.hover:bg-slate-50]="!isAssigned(tenant.id)"
            >
              <input
                type="checkbox"
                [checked]="isAssigned(tenant.id)"
                (change)="onToggle(tenant.id, $event)"
                class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-slate-700">{{ tenant.name }}</span>
                <span class="text-xs text-slate-500 ml-2">{{ tenant.domain }}</span>
              </div>
              @if (tenant.is_master) {
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-teal-100 text-teal-700">Master</span>
              }
            </label>
          }
        </div>
      }
    </div>
  `,
})
export class TenantAssignmentComponent {
  readonly tenants = input.required<TenantSummary[]>();
  readonly assignedTenantIds = input.required<string[]>();
  readonly assign = output<string>();
  readonly unassign = output<string>();

  #assignedSet = computed(() => new Set(this.assignedTenantIds()));

  isAssigned(tenantId: string): boolean {
    return this.#assignedSet().has(tenantId);
  }

  onToggle(tenantId: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.assign.emit(tenantId);
    } else {
      this.unassign.emit(tenantId);
    }
  }
}
