import { ChangeDetectionStrategy, Component, input, output, viewChild, ElementRef } from '@angular/core';
import { LucideAngularModule, FileDown, Maximize } from 'lucide-angular';
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
        <div class="flex items-center gap-3">
          <button (click)="enterFullscreen()" class="btn-ghost text-sm">
            <lucide-icon [img]="icons.Maximize" [size]="16"></lucide-icon>
            Fullscreen
          </button>
          <a
            [href]="pdf().file_url"
            download
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          >
            <lucide-icon [img]="icons.FileDown" [size]="16"></lucide-icon>
            Download PDF
          </a>
        </div>
      </div>
      <div #viewerContainer>
        <ngx-extended-pdf-viewer
          [src]="pdf().file_url"
          [height]="'80vh'"
          [page]="initialPage()"
          (pageChange)="onPageChange($event)"
          [pageViewMode]="'infinite-scroll'"
          [sidebarVisible]="false"
          [showToolbar]="true"
          [showSidebarButton]="true"
          [showFindButton]="true"
          [showPagingButtons]="true"
          [showZoomButtons]="true"
          [showPresentationModeButton]="false"
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
    </div>
  `,
})
export class PdfViewerComponent {
  readonly pdf = input.required<ModulePdf>();
  readonly initialPage = input(1);
  readonly pageChange = output<number>();
  readonly icons = { FileDown, Maximize };

  private viewerContainer = viewChild<ElementRef<HTMLDivElement>>('viewerContainer');

  constructor() {
    pdfDefaultOptions.disableRange = true;
    pdfDefaultOptions.disableStream = true;
  }

  onPageChange(page: number) {
    this.pageChange.emit(page);
  }

  enterFullscreen() {
    this.viewerContainer()?.nativeElement.requestFullscreen();
  }
}
