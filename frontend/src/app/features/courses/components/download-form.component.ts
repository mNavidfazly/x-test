import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseTusUploadService } from '../../../core/services/supabase-tus-upload.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { DownloadFormData, ModuleFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-download-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FileUploadComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <!-- Title -->
      <div>
        <label for="moduleTitle" class="form-label">Title</label>
        <input
          id="moduleTitle"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Module title"
          class="input-field"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="moduleDescription" class="form-label">Description</label>
        <textarea
          id="moduleDescription"
          [(ngModel)]="form.description"
          placeholder="Module description (optional)"
          rows="2"
          class="input-field resize-none"
        ></textarea>
      </div>

      <!-- Download File Upload -->
      <div>
        <label class="form-label">ZIP File</label>
        <app-file-upload
          accept="application/zip,application/x-zip-compressed"
          [maxSizeMB]="500"
          [currentFileName]="downloadForm.file_name || null"
          [uploading]="tusUpload.uploading()"
          [progress]="tusUpload.progress()"
          [error]="tusUpload.error() ?? ''"
          (fileSelected)="onFileSelected($event)"
          (removeFile)="onRemoveFile()"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!isValid() || tusUpload.uploading()"
          class="btn-primary"
        >
          {{ isEditMode() ? 'Save Changes' : 'Create Module' }}
        </button>
        <button
          type="button"
          (click)="cancel.emit()"
          class="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  `,
})
export class DownloadFormComponent implements OnInit {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialDownloadData = input.required<DownloadFormData>();
  readonly isEditMode = input(false);
  readonly courseId = input.required<string>();
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  readonly tusUpload = inject(SupabaseTusUploadService);
  readonly #destroyRef = inject(DestroyRef);

  form: { title: string; description: string | null } = { title: '', description: null };
  downloadForm: DownloadFormData = { file_url: '', file_name: '', file_size: null };

  #selectedFile: File | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.tusUpload.abort();
    });
  }

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };
    this.downloadForm = { ...this.initialDownloadData() };
  }

  onFileSelected(file: File) {
    this.#selectedFile = file;
    this.tusUpload.error.set(null);
  }

  onRemoveFile() {
    this.#selectedFile = null;
    this.downloadForm.file_url = '';
    this.downloadForm.file_name = '';
    this.downloadForm.file_size = null;
  }

  isValid(): boolean {
    const hasTitle = !!this.form.title.trim();
    const hasFile = !!this.downloadForm.file_url || !!this.#selectedFile;
    return hasTitle && hasFile;
  }

  async onSave() {
    if (!this.isValid()) return;

    if (this.#selectedFile) {
      try {
        const timestamp = Date.now();
        const path = `${this.courseId()}/${timestamp}-${this.#selectedFile.name}`;

        await this.tusUpload.upload('course-files', path, this.#selectedFile);

        this.downloadForm.file_url = path;
        this.downloadForm.file_name = this.#selectedFile.name;
        this.downloadForm.file_size = this.#selectedFile.size;
      } catch {
        return;
      }
    }

    const moduleData = this.initialModuleData();
    this.save.emit({
      module: {
        title: this.form.title,
        description: this.form.description,
        module_type: moduleData.module_type,
        lecture_id: moduleData.lecture_id,
        estimated_duration_minutes: moduleData.estimated_duration_minutes,
      },
      content: { type: 'download', data: { ...this.downloadForm } },
    });
  }
}
