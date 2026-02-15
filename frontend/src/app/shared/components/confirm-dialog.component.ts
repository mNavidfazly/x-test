import {
  ChangeDetectionStrategy,
  Component,
  inject,
  effect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'contents' },
  template: `
    @if (confirmService.config(); as cfg) {
      <div
        class="modal-backdrop"
        (click)="confirmService.dismiss()"
        role="presentation"
      >
        <div
          class="glass-panel w-full max-w-md mx-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          (click)="$event.stopPropagation()"
          (keydown.escape)="confirmService.dismiss()"
        >
          <div class="modal-header-gradient">
            <h2
              id="confirm-dialog-title"
              class="text-lg font-semibold text-white"
            >
              {{ cfg.title }}
            </h2>
            <button
              (click)="confirmService.dismiss()"
              class="text-white/80 hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <lucide-icon [img]="icons.X" [size]="20"></lucide-icon>
            </button>
          </div>
          <div class="p-6">
            <p class="text-sm text-slate-600">{{ cfg.message }}</p>
          </div>
          <div class="px-6 pb-6 flex justify-end gap-3">
            <button
              class="btn-secondary"
              (click)="confirmService.dismiss()"
              #cancelBtn
            >
              {{ cfg.cancelLabel }}
            </button>
            <button
              [class]="
                cfg.variant === 'danger' ? 'btn-danger-solid' : 'btn-primary'
              "
              (click)="confirmService.accept()"
            >
              {{ cfg.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmDialogService);
  readonly icons = { X };

  private cancelBtn = viewChild<ElementRef<HTMLButtonElement>>('cancelBtn');

  constructor() {
    effect(() => {
      const btn = this.cancelBtn();
      if (btn) {
        btn.nativeElement.focus();
      }
    });
  }
}
