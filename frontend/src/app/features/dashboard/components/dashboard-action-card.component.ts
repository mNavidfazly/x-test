import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, ChevronRight } from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';

@Component({
  selector: 'app-dashboard-action-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <a [routerLink]="route()"
       class="card-solid p-4 flex items-center gap-4 group">
      <div [class]="'p-2.5 rounded-lg ' + iconBg()">
        <lucide-icon [img]="icon()" [size]="20" [class]="iconColor()"></lucide-icon>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-2xl font-bold tabular-nums text-slate-900">{{ count() }}</div>
        <div class="text-xs text-slate-500">{{ label() }}</div>
      </div>
      <lucide-icon [img]="icons.ChevronRight" [size]="16"
                   class="text-slate-300 group-hover:text-slate-500 transition-colors"></lucide-icon>
    </a>
  `,
})
export class DashboardActionCardComponent {
  readonly icon = input.required<LucideIconData>();
  readonly iconBg = input.required<string>();
  readonly iconColor = input.required<string>();
  readonly count = input.required<number>();
  readonly label = input.required<string>();
  readonly route = input.required<string>();

  readonly icons = { ChevronRight };
}
