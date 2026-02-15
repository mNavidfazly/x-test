import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="stat-card">
      <div class="section-label mb-1">{{ label() }}</div>
      <div class="text-2xl font-bold tabular-nums" [class]="color()">{{ value() }}</div>
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly color = input('text-slate-900');
}
