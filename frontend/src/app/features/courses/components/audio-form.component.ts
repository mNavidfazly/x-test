import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseTusUploadService } from '../../../core/services/supabase-tus-upload.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { AudioFormData, ModuleFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-audio-form',
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
          class="input-field focus:outline-none"
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
          class="input-field focus:outline-none resize-none"
        ></textarea>
      </div>

      <!-- Audio File Upload -->
      <div>
        <label class="form-label">Audio File</label>
        <app-file-upload
          accept="audio/mpeg,audio/wav,audio/x-wav,audio/wave"
          [maxSizeMB]="200"
          [currentFileName]="audioForm.file_name || null"
          [uploading]="tusUpload.uploading()"
          [progress]="tusUpload.progress()"
          [error]="tusUpload.error() ?? ''"
          (fileSelected)="onFileSelected($event)"
          (removeFile)="onRemoveFile()"
        />
      </div>

      <!-- Duration (optional, in minutes) -->
      <div>
        <label for="audioDuration" class="form-label">Duration (minutes)</label>
        <input
          id="audioDuration"
          type="number"
          [(ngModel)]="durationMinutes"
          placeholder="Optional"
          min="0"
          step="0.5"
          class="input-field focus:outline-none"
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
export class AudioFormComponent implements OnInit {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialAudioData = input.required<AudioFormData>();
  readonly isEditMode = input(false);
  readonly courseId = input.required<string>();
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  readonly tusUpload = inject(SupabaseTusUploadService);
  readonly #destroyRef = inject(DestroyRef);

  form: { title: string; description: string | null } = { title: '', description: null };
  audioForm: AudioFormData = { file_url: '', file_name: '', file_size: null, duration_seconds: null, mime_type: '' };
  durationMinutes: number | null = null;

  #selectedFile: File | null = null;

  constructor() {
    this.#destroyRef.onDestroy(() => {
      this.tusUpload.abort();
    });
  }

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };
    this.audioForm = { ...this.initialAudioData() };

    if (this.audioForm.duration_seconds != null) {
      this.durationMinutes = this.audioForm.duration_seconds / 60;
    }
  }

  onFileSelected(file: File) {
    this.#selectedFile = file;
    this.tusUpload.error.set(null);
  }

  onRemoveFile() {
    this.#selectedFile = null;
    this.audioForm.file_url = '';
    this.audioForm.file_name = '';
    this.audioForm.file_size = null;
    this.audioForm.mime_type = '';
  }

  isValid(): boolean {
    const hasTitle = !!this.form.title.trim();
    const hasFile = !!this.audioForm.file_url || !!this.#selectedFile;
    return hasTitle && hasFile;
  }

  async onSave() {
    if (!this.isValid()) return;

    if (this.#selectedFile) {
      try {
        const timestamp = Date.now();
        const path = `${this.courseId()}/${timestamp}-${this.#selectedFile.name}`;

        await this.tusUpload.upload('course-files', path, this.#selectedFile);

        this.audioForm.file_url = path;
        this.audioForm.file_name = this.#selectedFile.name;
        this.audioForm.file_size = this.#selectedFile.size;
        this.audioForm.mime_type = this.#selectedFile.type;
      } catch {
        return;
      }
    }

    if (this.durationMinutes != null && this.durationMinutes > 0) {
      this.audioForm.duration_seconds = Math.round(this.durationMinutes * 60);
    } else {
      this.audioForm.duration_seconds = null;
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
      content: { type: 'audio', data: { ...this.audioForm } },
    });
  }
}
