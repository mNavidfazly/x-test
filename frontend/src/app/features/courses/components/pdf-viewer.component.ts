import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, FileDown } from 'lucide-angular';
import { NgxExtendedPdfViewerModule, pdfDefaultOptions } from 'ngx-extended-pdf-viewer';
import { ModulePdf } from '../../../core/models/course.model';

@Component({
  selector: 'app-pdf-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, NgxExtendedPdfViewerModule],
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
          <lucide-icon [img]="icons.FileDown" [size]="16"></lucide-icon>
          Download PDF
        </a>
      </div>
      <ngx-extended-pdf-viewer
        [src]="pdf().file_url"
        [height]="'80vh'"
        [showToolbar]="true"
        [showSidebarButton]="true"
        [showFindButton]="true"
        [showPagingButtons]="true"
        [showZoomButtons]="true"
        [showPresentationModeButton]="true"
        [showDownloadButton]="false"
        [showPrintButton]="true"
        [showOpenFileButton]="false"
        [showSecondaryToolbarButton]="true"
        [showTextEditor]="false"
        [showDrawEditor]="false"
        [showHighlightEditor]="false"
        [showStampEditor]="false"
        [textLayer]="true"
      ></ngx-extended-pdf-viewer>
    </div>
  `,
})
export class PdfViewerComponent {
  readonly pdf = input.required<ModulePdf>();
  readonly icons = { FileDown };

  constructor() {
    pdfDefaultOptions.disableRange = true;
    pdfDefaultOptions.disableStream = true;
  }
}
