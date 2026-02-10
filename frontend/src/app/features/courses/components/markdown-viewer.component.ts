import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-markdown-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent],
  host: { class: 'block' },
  template: `
    <div class="prose prose-slate max-w-none">
      <markdown [data]="content()" />
    </div>
  `,
})
export class MarkdownViewerComponent {
  readonly content = input.required<string>();
}
