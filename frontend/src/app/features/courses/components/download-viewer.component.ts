import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, FolderArchive, Download } from 'lucide-angular';
import { ModuleDownload } from '../../../core/models/course.model';
import { formatFileSize } from '../../../core/utils/file.utils';

@Component({
  selector: 'app-download-viewer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="card p-6 space-y-4">
      <div class="flex items-center gap-3">
        <lucide-icon [img]="icons.FolderArchive" [size]="24" class="text-teal-600"></lucide-icon>
        <div class="min-w-0 flex-1">
          <h3 class="text-lg font-semibold text-slate-900 truncate">{{ download().file_name }}</h3>
          @if (download().file_size) {
            <p class="text-sm text-slate-500">{{ formatFileSize(download().file_size) }}</p>
          }
        </div>
      </div>

      @if (description()) {
        <p class="text-sm text-slate-600">{{ description() }}</p>
      }

      <a
        [href]="download().file_url"
        target="_blank"
        rel="noopener noreferrer"
        [attr.download]="download().file_name"
        class="btn-primary inline-flex items-center gap-2"
      >
        <lucide-icon [img]="icons.Download" [size]="16"></lucide-icon>
        Download File
      </a>
    </div>
  `,
})
export class DownloadViewerComponent {
  readonly download = input.required<ModuleDownload>();
  readonly description = input<string | null>(null);
  readonly icons = { FolderArchive, Download };
  readonly formatFileSize = formatFileSize;
}
