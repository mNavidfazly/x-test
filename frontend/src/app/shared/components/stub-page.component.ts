import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideAngularModule, Construction } from 'lucide-angular';

@Component({
  selector: 'app-stub-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="flex flex-col items-center justify-center py-24 text-center">
      <lucide-icon [img]="icons.Construction" [size]="48" class="text-slate-300 mb-4"></lucide-icon>
      <h2 class="text-lg font-semibold text-slate-700 mb-1">Coming soon</h2>
      <p class="text-sm text-slate-500">This feature is under development.</p>
    </div>
  `,
})
export class StubPageComponent {
  readonly icons = { Construction };
}
