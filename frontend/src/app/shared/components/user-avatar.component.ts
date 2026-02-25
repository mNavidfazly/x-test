import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getInitials } from '../../core/utils/avatar.utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';
export type AvatarColor = 'teal' | 'slate';

const SIZE_CLASSES: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]' },
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-28 h-28', text: 'text-3xl' },
};

const COLOR_CLASSES: Record<AvatarColor, string> = {
  teal: 'bg-teal-100 text-teal-700',
  slate: 'bg-slate-100 text-slate-600',
};

@Component({
  selector: 'app-user-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    @if (avatarUrl()) {
      <div [class]="pulseClass()">
        <img
          [src]="avatarUrl()"
          [alt]="name()"
          [class]="imgClass()"
          loading="lazy"
          class="opacity-0 transition-opacity duration-200"
          (load)="$any($event.target).classList.remove('opacity-0'); $any($event.target).parentElement.classList.remove('animate-pulse')"
          (error)="$any($event.target).classList.remove('opacity-0'); $any($event.target).parentElement.classList.remove('animate-pulse')"
        />
      </div>
    } @else {
      <div [class]="fallbackClass()">
        {{ initials() }}
      </div>
    }
  `,
})
export class UserAvatarComponent {
  readonly avatarUrl = input<string | null>(null);
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('sm');
  readonly color = input<AvatarColor>('teal');
  readonly extraClass = input('');

  readonly initials = computed(() => getInitials(this.name()));

  readonly imgClass = computed(() => {
    const s = SIZE_CLASSES[this.size()];
    return `${s.container} rounded-full object-cover ${this.extraClass()}`.trim();
  });

  readonly pulseClass = computed(() => {
    const s = SIZE_CLASSES[this.size()];
    return `${s.container} rounded-full bg-slate-200 animate-pulse ${this.extraClass()}`.trim();
  });

  readonly fallbackClass = computed(() => {
    const s = SIZE_CLASSES[this.size()];
    const c = COLOR_CLASSES[this.color()];
    return `${s.container} ${s.text} rounded-full ${c} font-semibold flex items-center justify-center ${this.extraClass()}`.trim();
  });
}
