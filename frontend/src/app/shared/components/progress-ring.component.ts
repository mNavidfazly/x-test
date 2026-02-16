import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <svg viewBox="0 0 36 36" [class]="sizeClass()" role="img" [attr.aria-label]="percent() + '% complete'">
      <circle cx="18" cy="18" r="15.9155" fill="none"
              [attr.stroke-width]="strokeWidth()" class="stroke-slate-200" />
      <circle cx="18" cy="18" r="15.9155" fill="none"
              [attr.stroke-width]="strokeWidth()"
              [class]="percent() === 100 ? 'stroke-emerald-500' : 'stroke-teal-500'"
              stroke-linecap="round" stroke-dasharray="100"
              [attr.stroke-dashoffset]="100 - percent()"
              transform="rotate(-90 18 18)"
              class="transition-[stroke-dashoffset] duration-500 ease-out" />
      @if (showLabel()) {
        <text x="18" y="18" text-anchor="middle" dominant-baseline="central"
              class="fill-slate-700 text-[8px] font-semibold" style="font-variant-numeric: tabular-nums">
          {{ percent() }}%
        </text>
      }
    </svg>
  `,
})
export class ProgressRingComponent {
  readonly percent = input.required<number>();
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly showLabel = input(true);

  // r=15.9155 → circumference ≈ 100 → stroke-dashoffset = 100 - percent maps directly
  readonly sizeClass = computed(() => ({ sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' })[this.size()]);
  readonly strokeWidth = computed(() => this.size() === 'sm' ? 4 : 3);
}
