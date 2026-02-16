import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { SupabaseService } from '../../../core/services/supabase.service';
import { resolveMarkdownStorageUrls } from '../../../core/utils/markdown-storage.utils';

@Component({
  selector: 'app-markdown-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MarkdownComponent],
  host: { class: 'block' },
  template: `
    <div class="card p-6 overflow-x-auto">
      @if (resolving()) {
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-4 bg-slate-200 rounded w-1/2"></div>
          <div class="h-4 bg-slate-200 rounded w-5/6"></div>
        </div>
      } @else {
        <div class="prose prose-slate max-w-none">
          <markdown [data]="resolvedContent()" />
        </div>
      }
    </div>
  `,
})
export class MarkdownViewerComponent {
  readonly content = input.required<string>();

  readonly resolvedContent = signal('');
  readonly resolving = signal(false);

  #supabase = inject(SupabaseService);

  constructor() {
    effect(() => {
      const raw = this.content();
      this.#resolveContent(raw);
    });
  }

  async #resolveContent(markdown: string) {
    if (!markdown) {
      this.resolvedContent.set('');
      return;
    }

    // Fast path: no storage URIs → skip async resolution
    if (!markdown.includes('supabase-storage://')) {
      this.resolvedContent.set(markdown);
      return;
    }

    this.resolving.set(true);
    try {
      const resolved = await resolveMarkdownStorageUrls(this.#supabase.client, markdown);
      this.resolvedContent.set(resolved);
    } catch {
      this.resolvedContent.set(markdown);
    } finally {
      this.resolving.set(false);
    }
  }
}
