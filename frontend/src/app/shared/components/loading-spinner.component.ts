import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, Loader2 } from 'lucide-angular';

@Component({
  selector: 'app-loading-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="flex items-center justify-center py-12">
      <lucide-icon [img]="icons.Loader2" [size]="24" class="text-slate-400 animate-spin mr-2"></lucide-icon>
      <span class="text-sm text-slate-500">{{ message() }}</span>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  readonly message = input('Loading...');
  readonly icons = { Loader2 };
}
