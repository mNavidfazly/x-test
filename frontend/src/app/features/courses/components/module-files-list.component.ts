import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideAngularModule, FileDown } from 'lucide-angular';
import { ModuleFile } from '../../../core/models/course.model';
import { formatFileSize } from '../../../core/utils/file.utils';

@Component({
  selector: 'app-module-files-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    @if (files().length > 0) {
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Downloadable Files</h3>
        </div>
        <ul class="divide-y divide-slate-100">
          @for (file of files(); track file.id) {
            <li>
              <a
                [href]="file.file_url"
                download
                class="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-200"
              >
                <lucide-icon [img]="fileDownIcon" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
                <span class="text-sm text-slate-700 flex-1 truncate">{{ file.file_name }}</span>
                @if (file.file_size) {
                  <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ formatSize(file.file_size) }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </div>
    }
  `,
})
export class ModuleFilesListComponent {
  readonly files = input.required<ModuleFile[]>();
  readonly fileDownIcon = FileDown;

  formatSize(bytes: number | null): string {
    return formatFileSize(bytes);
  }
}
