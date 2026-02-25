import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideAngularModule, FileDown } from 'lucide-angular';
import { ModulePdf } from '../../../core/models/course.model';

@Component({
  selector: 'app-pdf-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        @if (pdf().page_count) {
          <span class="text-xs text-slate-500">{{ pdf().page_count }} pages</span>
        }
        <a
          [href]="pdf().file_url"
          download
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
        >
          <lucide-icon [img]="fileDownIcon" [size]="16"></lucide-icon>
          Download PDF
        </a>
      </div>
      <iframe
        [src]="trustedUrl()"
        class="w-full h-[80vh] rounded-lg border border-slate-200"
        title="PDF Viewer"
      ></iframe>
    </div>
  `,
})
export class PdfViewerComponent {
  readonly pdf = input.required<ModulePdf>();
  readonly fileDownIcon = FileDown;

  #sanitizer = inject(DomSanitizer);

  readonly trustedUrl = computed(() =>
    this.#sanitizer.bypassSecurityTrustResourceUrl(this.pdf().file_url + '#pagemode=none'),
  );
}
