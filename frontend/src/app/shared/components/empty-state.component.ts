import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import type { LucideIconData } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="text-center py-12">
      <lucide-icon [img]="icon()" [size]="40" class="text-slate-300 mx-auto mb-3"></lucide-icon>
      <p class="text-sm text-slate-500">{{ message() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input.required<LucideIconData>();
  readonly message = input.required<string>();
}
