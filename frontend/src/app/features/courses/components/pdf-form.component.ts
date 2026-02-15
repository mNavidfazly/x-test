import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { ModuleFormData, PdfFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-pdf-form',
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

      <!-- PDF File Upload -->
      <div>
        <label class="form-label">PDF File</label>
        <app-file-upload
          accept="application/pdf"
          [maxSizeMB]="50"
          [currentFileName]="pdfForm.file_name || null"
          [uploading]="uploading()"
          [progress]="uploadProgress()"
          [error]="uploadError()"
          (fileSelected)="onFileSelected($event)"
          (removeFile)="onRemoveFile()"
        />
      </div>

      <!-- Page count -->
      <div>
        <label for="pageCount" class="form-label">Page count</label>
        <input
          id="pageCount"
          type="number"
          [(ngModel)]="pdfForm.page_count"
          placeholder="Optional"
          min="1"
          class="input-field"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!isValid() || uploading()"
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
export class PdfFormComponent implements OnInit {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialPdfData = input.required<PdfFormData>();
  readonly isEditMode = input(false);
  readonly courseId = input.required<string>();
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  #supabase = inject(SupabaseService);

  form: { title: string; description: string | null } = { title: '', description: null };
  pdfForm: PdfFormData = { file_url: '', file_name: '', page_count: null };

  #selectedFile: File | null = null;

  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadError = signal('');

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };
    this.pdfForm = { ...this.initialPdfData() };
  }

  onFileSelected(file: File) {
    this.#selectedFile = file;
    this.uploadError.set('');
  }

  onRemoveFile() {
    this.#selectedFile = null;
    this.pdfForm.file_url = '';
    this.pdfForm.file_name = '';
  }

  isValid(): boolean {
    const hasTitle = !!this.form.title.trim();
    const hasFile = !!this.pdfForm.file_url || !!this.#selectedFile;
    return hasTitle && hasFile;
  }

  async onSave() {
    if (!this.isValid()) return;

    if (this.#selectedFile) {
      this.uploading.set(true);
      this.uploadProgress.set(0);
      this.uploadError.set('');

      try {
        const timestamp = Date.now();
        const path = `${this.courseId()}/${timestamp}-${this.#selectedFile.name}`;

        const { data, error } = await this.#supabase.client.storage
          .from('course-files')
          .upload(path, this.#selectedFile);

        if (error) throw new Error(error.message);

        // Store the storage path (not a public URL) — signed URLs are generated at view time
        this.pdfForm.file_url = data.path;
        this.pdfForm.file_name = this.#selectedFile.name;
      } catch (err) {
        this.uploadError.set(err instanceof Error ? err.message : 'Upload failed');
        this.uploading.set(false);
        return;
      } finally {
        this.uploading.set(false);
      }
    }

    const moduleData = this.initialModuleData();
    this.save.emit({
      module: {
        title: this.form.title,
        description: this.form.description,
        module_type: moduleData.module_type,
        lecture_id: moduleData.lecture_id,
        estimated_duration_minutes: this.initialModuleData().estimated_duration_minutes,
      },
      content: { type: 'pdf', data: { ...this.pdfForm } },
    });
  }
}
