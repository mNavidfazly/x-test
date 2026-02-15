import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  LucideAngularModule,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-angular';
import { ToastService, Toast } from '../../core/services/toast.service';
import type { LucideIconData } from 'lucide-angular';

const ICON_MAP: Record<Toast['type'], LucideIconData> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const CLASS_MAP: Record<Toast['type'], string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

@Component({
  selector: 'app-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast-enter flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border transition-[transform,opacity] duration-200"
          [class]="classFor(toast.type)"
          role="alert"
        >
          <lucide-icon
            [img]="iconFor(toast.type)"
            [size]="18"
            class="shrink-0 mt-0.5"
          ></lucide-icon>
          <p class="text-sm flex-1">{{ toast.message }}</p>
          <button
            class="shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors duration-200"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Dismiss"
          >
            <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly icons = { X };
  readonly toastService = inject(ToastService);

  iconFor(type: Toast['type']): LucideIconData {
    return ICON_MAP[type];
  }

  classFor(type: Toast['type']): string {
    return CLASS_MAP[type];
  }
}
