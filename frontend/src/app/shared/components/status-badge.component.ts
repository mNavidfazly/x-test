import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary' | 'purple';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  neutral: 'badge-neutral',
  primary: 'badge-primary',
  purple: 'badge-purple',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline' },
  template: `
    <span [class]="badgeClass()"><ng-content /></span>
  `,
})
export class StatusBadgeComponent {
  readonly variant = input.required<BadgeVariant>();
  readonly badgeClass = computed(() => VARIANT_CLASS[this.variant()]);
}
