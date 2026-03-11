import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule, ChevronDown, Check } from 'lucide-angular';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-custom-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: {
    class: 'inline-block relative',
    '(document:click)': 'onClickOutside($event)',
  },
  template: `
    <button
      type="button"
      role="combobox"
      [attr.aria-expanded]="isOpen()"
      aria-haspopup="listbox"
      [attr.aria-activedescendant]="activeDescendantId()"
      [attr.aria-label]="ariaLabel() || null"
      [disabled]="disabled()"
      class="custom-select-trigger"
      [class.border-teal-500]="isOpen()"
      [class.ring-2]="isOpen()"
      [class.ring-teal-500]="isOpen()"
      (click)="toggle()"
      (keydown)="onKeydown($event)"
    >
      <span class="truncate" [class.text-slate-400]="!value()">
        {{ displayLabel() }}
      </span>
      <lucide-icon
        [img]="icons.ChevronDown"
        [size]="16"
        class="shrink-0 text-slate-400 transition-transform duration-200"
        [class.rotate-180]="isOpen()"
      ></lucide-icon>
    </button>

    @if (isOpen()) {
      <ul
        role="listbox"
        [attr.aria-label]="ariaLabel() || placeholder()"
        class="custom-select-panel"
      >
        @for (option of options(); track option.value; let i = $index) {
          <li
            [id]="'cso-' + instanceId + '-' + i"
            role="option"
            [attr.aria-selected]="option.value === value()"
            [attr.aria-disabled]="option.disabled || null"
            [class]="optionClass(option, i)"
            (click)="selectOption($event, option)"
            (mouseenter)="highlightedIndex.set(i)"
          >
            <span>{{ option.label }}</span>
            @if (option.value === value()) {
              <lucide-icon [img]="icons.Check" [size]="16" class="shrink-0 text-teal-600"></lucide-icon>
            }
          </li>
        }
      </ul>
    }
  `,
})
export class CustomSelectComponent {
  readonly options = input.required<SelectOption[]>();
  readonly value = input('');
  readonly placeholder = input('Select...');
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  readonly valueChange = output<string>();

  readonly icons = { ChevronDown, Check };
  readonly isOpen = signal(false);
  readonly highlightedIndex = signal(-1);
  readonly instanceId = Math.random().toString(36).slice(2, 10);

  #el = inject(ElementRef);

  readonly displayLabel = computed(() => {
    const v = this.value();
    if (!v && v !== '') return this.placeholder();
    const found = this.options().find(o => o.value === v);
    return found ? found.label : this.placeholder();
  });

  readonly activeDescendantId = computed(() => {
    const idx = this.highlightedIndex();
    return idx >= 0 ? `cso-${this.instanceId}-${idx}` : null;
  });

  onClickOutside(event: Event) {
    if (this.isOpen() && !this.#el.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  toggle() {
    if (this.disabled()) return;
    this.isOpen() ? this.close() : this.open();
  }

  open() {
    this.isOpen.set(true);
    const idx = this.options().findIndex(o => o.value === this.value());
    this.highlightedIndex.set(idx >= 0 ? idx : 0);
  }

  close() {
    this.isOpen.set(false);
    this.highlightedIndex.set(-1);
  }

  selectOption(event: Event, option: SelectOption) {
    event.stopPropagation();
    if (option.disabled) return;
    this.valueChange.emit(option.value);
    this.close();
  }

  optionClass(option: SelectOption, index: number): string {
    const parts = ['custom-select-option'];
    if (option.value === this.value()) parts.push('custom-select-option-selected');
    if (index === this.highlightedIndex()) parts.push('custom-select-option-highlighted');
    parts.push(option.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer');
    return parts.join(' ');
  }

  onKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isOpen()) {
          this.open();
        } else {
          this.#moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.isOpen()) {
          this.open();
        } else {
          this.#selectHighlighted();
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'Tab':
        this.close();
        break;
    }
  }

  #moveHighlight(delta: number) {
    const opts = this.options();
    if (!opts.length) return;
    let next = this.highlightedIndex() + delta;
    while (next >= 0 && next < opts.length && opts[next].disabled) {
      next += delta;
    }
    if (next >= 0 && next < opts.length) {
      this.highlightedIndex.set(next);
    }
  }

  #selectHighlighted() {
    const idx = this.highlightedIndex();
    const opts = this.options();
    if (idx >= 0 && idx < opts.length && !opts[idx].disabled) {
      this.valueChange.emit(opts[idx].value);
      this.close();
    }
  }
}
