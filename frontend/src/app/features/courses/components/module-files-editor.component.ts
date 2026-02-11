import { ChangeDetectionStrategy, Component, inject, input, signal, OnInit } from '@angular/core';
import { LucideAngularModule, File, Trash2 } from 'lucide-angular';
import { CourseService } from '../../../core/services/course.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { ModuleFile } from '../../../core/models/course.model';

@Component({
  selector: 'app-module-files-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FileUploadComponent],
  host: { class: 'block' },
  template: `
    <div class="mt-6 pt-6 border-t border-slate-200">
      <h3 class="text-sm font-semibold text-slate-900 mb-3">Attached Files</h3>

      @if (loading()) {
        <p class="text-sm text-slate-500">Loading files...</p>
      } @else {
        @for (file of files(); track file.id) {
          <div class="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 group">
            <lucide-icon [img]="icons.File" [size]="16" class="text-slate-400 shrink-0"></lucide-icon>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-700 truncate">{{ file.file_name }}</p>
              @if (file.file_size) {
                <p class="text-xs text-slate-400">{{ formatSize(file.file_size) }}</p>
              }
            </div>
            <button
              type="button"
              (click)="onDeleteFile(file)"
              class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
              aria-label="Delete file"
            >
              <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
            </button>
          </div>
        }

        <div class="mt-3">
          <app-file-upload
            (fileSelected)="onFileSelected($event)"
            [uploading]="uploading()"
            [error]="uploadError()"
          />
        </div>
      }
    </div>
  `,
})
export class ModuleFilesEditorComponent implements OnInit {
  readonly moduleId = input.required<string>();
  readonly courseId = input.required<string>();

  readonly icons = { File, Trash2 };

  readonly files = signal<ModuleFile[]>([]);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly loading = signal(true);

  #courseService = inject(CourseService);
  #supabase = inject(SupabaseService);

  ngOnInit() {
    this.#loadFiles();
  }

  async onFileSelected(file: File) {
    this.uploading.set(true);
    this.uploadError.set('');

    try {
      const timestamp = Date.now();
      const path = `${this.courseId()}/${timestamp}-${file.name}`;

      const { data, error } = await this.#supabase.client.storage
        .from('course-files')
        .upload(path, file);

      if (error) throw new Error(error.message);

      // Store the storage path (not a public URL) — signed URLs are generated at view time
      await this.#courseService.addModuleFile(this.moduleId(), {
        file_url: data.path,
        file_name: file.name,
        file_size: file.size,
      });

      await this.#loadFiles();
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      this.uploading.set(false);
    }
  }

  async onDeleteFile(file: ModuleFile) {
    try {
      // file_url stores the storage path directly — delete from bucket
      await this.#supabase.client.storage
        .from('course-files')
        .remove([file.file_url]);

      await this.#courseService.deleteModuleFile(file.id);
      await this.#loadFiles();
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async #loadFiles() {
    this.loading.set(true);
    try {
      const files = await this.#courseService.loadModuleFiles(this.moduleId());
      this.files.set(files);
    } catch (err) {
      this.uploadError.set(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      this.loading.set(false);
    }
  }
}
