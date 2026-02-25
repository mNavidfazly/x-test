import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ElementRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { LucideAngularModule, FileDown, Maximize } from 'lucide-angular';
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
        <div class="flex items-center gap-3">
          <button
            (click)="enterFullscreen()"
            class="btn-ghost text-sm"
          >
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
      <iframe
        #pdfFrame
        [src]="trustedUrl()"
        class="w-full h-[80vh] rounded-lg border border-slate-200"
        title="PDF Viewer"
      ></iframe>
    </div>
  `,
})
export class PdfViewerComponent {
  readonly pdf = input.required<ModulePdf>();
  readonly icons = { FileDown, Maximize };

  private pdfFrame = viewChild<ElementRef<HTMLIFrameElement>>('pdfFrame');

  #sanitizer = inject(DomSanitizer);

  readonly trustedUrl = computed(() =>
    this.#sanitizer.bypassSecurityTrustResourceUrl(this.pdf().file_url + '#pagemode=none'),
  );

  enterFullscreen() {
    this.pdfFrame()?.nativeElement.requestFullscreen();
  }
}
