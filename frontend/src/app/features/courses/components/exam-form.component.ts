import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { ModuleFormData, ExamFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-exam-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FileUploadComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <!-- Module basics -->
      <div>
        <label for="moduleTitle" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          id="moduleTitle"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Exam title"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <div>
        <label for="moduleDescription" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          id="moduleDescription"
          [(ngModel)]="form.description"
          placeholder="Exam description (optional)"
          rows="2"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200 resize-none"
        ></textarea>
      </div>

      <!-- Exam settings -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-4">Exam Settings</h3>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="durationMinutes" class="block text-sm font-medium text-slate-700 mb-1">Duration (minutes)</label>
            <input
              id="durationMinutes"
              type="number"
              [(ngModel)]="examForm.duration_minutes"
              min="1"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label for="passingScore" class="block text-sm font-medium text-slate-700 mb-1">Passing score (%)</label>
            <input
              id="passingScore"
              type="number"
              [(ngModel)]="examForm.passing_score"
              min="0"
              max="100"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
            />
          </div>
        </div>
      </div>

      <!-- File constraints -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-4">Submission Requirements</h3>

        <div class="mb-4">
          <label for="maxFileSizeMB" class="block text-sm font-medium text-slate-700 mb-1">Max file size (MB)</label>
          <input
            id="maxFileSizeMB"
            type="number"
            [(ngModel)]="maxFileSizeMB"
            min="1"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
          />
        </div>

        <div>
          <span class="block text-sm font-medium text-slate-700 mb-2">Allowed file types</span>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                [checked]="examForm.allowed_file_types.includes('application/pdf')"
                (change)="toggleFileType('application/pdf')"
                class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              PDF
            </label>
            <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                [checked]="examForm.allowed_file_types.includes('application/zip')"
                (change)="toggleFileType('application/zip')"
                class="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              ZIP
            </label>
          </div>
        </div>
      </div>

      <!-- Exam file upload (optional) -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-1">Exam File</h3>
        <p class="text-xs text-slate-500 mb-3">Upload the exam document students will download (optional)</p>

        <app-file-upload
          accept="application/pdf,application/zip"
          [maxSizeMB]="100"
          [currentFileName]="examFileDisplayName()"
          [uploading]="uploading()"
          [progress]="uploadProgress()"
          [error]="uploadError()"
          (fileSelected)="onFileSelected($event)"
          (removeFile)="onRemoveFile()"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!isValid() || uploading()"
          class="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isEditMode() ? 'Save Changes' : 'Create Module' }}
        </button>
        <button
          type="button"
          (click)="cancel.emit()"
          class="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-slate-50 transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  `,
})
export class ExamFormComponent implements OnInit {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialExamData = input.required<ExamFormData>();
  readonly isEditMode = input(false);
  readonly courseId = input.required<string>();
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  #supabase = inject(SupabaseService);

  form: { title: string; description: string | null } = { title: '', description: null };
  examForm: ExamFormData = {
    title: '', description: null,
    duration_minutes: 60, passing_score: 70,
    max_file_size: 52428800,
    allowed_file_types: ['application/pdf', 'application/zip'],
    exam_file_url: null,
  };

  maxFileSizeMB = 50;

  #selectedFile: File | null = null;

  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly uploadError = signal('');

  readonly examFileDisplayName = computed(() => {
    const url = this.examForm.exam_file_url;
    if (!url) return null;
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    // Strip timestamp prefix if present
    const dashIndex = filename.indexOf('-');
    return dashIndex > 0 && !isNaN(Number(filename.substring(0, dashIndex)))
      ? filename.substring(dashIndex + 1)
      : filename;
  });

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };

    const examData = this.initialExamData();
    this.examForm = { ...examData };
    this.maxFileSizeMB = Math.round(examData.max_file_size / (1024 * 1024));
  }

  toggleFileType(type: string) {
    const idx = this.examForm.allowed_file_types.indexOf(type);
    if (idx >= 0) {
      this.examForm.allowed_file_types = this.examForm.allowed_file_types.filter(t => t !== type);
    } else {
      this.examForm.allowed_file_types = [...this.examForm.allowed_file_types, type];
    }
  }

  onFileSelected(file: File) {
    this.#selectedFile = file;
    this.uploadError.set('');
  }

  onRemoveFile() {
    this.#selectedFile = null;
    this.examForm.exam_file_url = null;
  }

  isValid(): boolean {
    const hasTitle = !!this.form.title.trim();
    const validDuration = this.examForm.duration_minutes > 0;
    const validScore = this.examForm.passing_score >= 0 && this.examForm.passing_score <= 100;
    return hasTitle && validDuration && validScore;
  }

  async onSave() {
    if (!this.isValid()) return;

    // Upload exam file if selected
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
        this.examForm.exam_file_url = data.path;
      } catch (err) {
        this.uploadError.set(err instanceof Error ? err.message : 'Upload failed');
        this.uploading.set(false);
        return;
      } finally {
        this.uploading.set(false);
      }
    }

    // Sync exam title/description with module title/description
    this.examForm.title = this.form.title;
    this.examForm.description = this.form.description;
    this.examForm.max_file_size = this.maxFileSizeMB * 1024 * 1024;

    const moduleData = this.initialModuleData();
    this.save.emit({
      module: {
        title: this.form.title,
        description: this.form.description,
        module_type: moduleData.module_type,
        lecture_id: moduleData.lecture_id,
      },
      content: { type: 'exam', data: { ...this.examForm } },
    });
  }
}
