import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-error-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="alert-error" role="alert">{{ message() }}</div>
  `,
})
export class ErrorAlertComponent {
  readonly message = input.required<string>();
}
