import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Upload, Link, X, Image } from 'lucide-angular';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { CourseFormData, EnrollmentType } from '../../../core/models/course.model';

export interface CourseFormSaveEvent {
  data: CourseFormData;
  thumbnailFile: File | null;
}

@Component({
  selector: 'app-course-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, FileUploadComponent],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <!-- Title -->
      <div>
        <label for="title" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          id="title"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Course title"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          id="description"
          [(ngModel)]="form.description"
          placeholder="Course description (optional)"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200 resize-none"
        ></textarea>
      </div>

      <!-- Thumbnail -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2">Thumbnail</label>

        <!-- Preview -->
        @if (thumbnailPreviewUrl()) {
          <div class="relative mb-3 rounded-lg overflow-hidden border border-slate-200 max-w-xs">
            <img
              [src]="thumbnailPreviewUrl()"
              alt="Thumbnail preview"
              class="w-full aspect-video object-cover"
            />
            <button
              type="button"
              (click)="clearThumbnail()"
              class="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Clear thumbnail"
            >
              <lucide-icon [img]="icons.X" [size]="14"></lucide-icon>
            </button>
          </div>
        }

        <!-- Mode tabs -->
        <div class="flex gap-1 mb-3">
          <button
            type="button"
            (click)="thumbnailMode.set('upload')"
            [class]="'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ' +
              (thumbnailMode() === 'upload' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent')"
          >
            <lucide-icon [img]="icons.Upload" [size]="14"></lucide-icon>
            Upload
          </button>
          <button
            type="button"
            (click)="thumbnailMode.set('url')"
            [class]="'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ' +
              (thumbnailMode() === 'url' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent')"
          >
            <lucide-icon [img]="icons.Link" [size]="14"></lucide-icon>
            URL
          </button>
        </div>

        <!-- Upload mode -->
        @if (thumbnailMode() === 'upload') {
          <app-file-upload
            accept="image/jpeg,image/png,image/webp"
            [maxSizeMB]="5"
            (fileSelected)="onThumbnailFileSelected($event)"
          />
        }

        <!-- URL mode -->
        @if (thumbnailMode() === 'url') {
          <input
            id="thumbnail"
            type="url"
            [(ngModel)]="form.thumbnail_url"
            placeholder="https://example.com/image.jpg (optional)"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
          />
        }
      </div>

      <!-- Enrollment Type -->
      <div>
        <label for="enrollmentType" class="block text-sm font-medium text-slate-700 mb-1">Enrollment Type</label>
        <select
          id="enrollmentType"
          [(ngModel)]="form.enrollment_type"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200 bg-white"
        >
          <option value="open">Open</option>
          <option value="invite_only">Invite only</option>
          <option value="password_protected">Password protected</option>
        </select>
      </div>

      <!-- Password (conditional) -->
      @if (form.enrollment_type === 'password_protected') {
        <div>
          <label for="password" class="block text-sm font-medium text-slate-700 mb-1">Enrollment Password</label>
          <input
            id="password"
            type="text"
            [(ngModel)]="form.password_hash"
            placeholder="Password for enrollment"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
          />
          @if (isEditMode()) {
            <p class="mt-1 text-xs text-slate-500">Leave blank to keep the current password.</p>
          }
        </div>
      }

      <!-- Staleness Threshold -->
      <div>
        <label for="staleness" class="block text-sm font-medium text-slate-700 mb-1">Staleness Threshold (days)</label>
        <input
          id="staleness"
          type="number"
          [(ngModel)]="form.staleness_threshold_days"
          placeholder="180 (default)"
          min="1"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!form.title.trim()"
          class="bg-teal-600 text-white rounded-lg px-4 py-2 font-semibold shadow-sm hover:bg-teal-700 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isEditMode() ? 'Save Changes' : 'Create Course' }}
        </button>
        <button
          type="button"
          (click)="cancel.emit()"
          class="bg-white border border-slate-300 text-slate-700 rounded-lg px-4 py-2 font-semibold hover:bg-slate-50 transition-all duration-200"
        >
          Cancel
        </button>
      </div>
    </div>
  `,
})
export class CourseFormComponent {
  readonly icons = { Upload, Link, X, Image };

  readonly initialData = input.required<CourseFormData>();
  readonly isEditMode = input(false);
  readonly currentThumbnailSignedUrl = input<string | null>(null);

  readonly save = output<CourseFormSaveEvent>();
  readonly cancel = output<void>();

  readonly thumbnailMode = signal<'upload' | 'url'>('upload');

  readonly #pendingFile = signal<File | null>(null);
  readonly #filePreviewUrl = signal<string | null>(null);

  readonly thumbnailPreviewUrl = computed(() => {
    // Priority: pending file preview > current signed URL > external URL in form
    if (this.#filePreviewUrl()) return this.#filePreviewUrl();
    if (this.currentThumbnailSignedUrl()) return this.currentThumbnailSignedUrl();
    const url = this.form.thumbnail_url;
    return url && url.startsWith('http') ? url : null;
  });

  #destroyRef = inject(DestroyRef);

  form: CourseFormData = {
    title: '',
    description: null,
    thumbnail_url: null,
    enrollment_type: 'open' as EnrollmentType,
    password_hash: null,
    staleness_threshold_days: null,
  };

  constructor() {
    this.#destroyRef.onDestroy(() => {
      const url = this.#filePreviewUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  ngOnInit() {
    const data = this.initialData();
    this.form = { ...data };
    // If there's an existing external URL, default to URL mode
    if (data.thumbnail_url?.startsWith('http')) {
      this.thumbnailMode.set('url');
    }
  }

  onThumbnailFileSelected(file: File) {
    // Revoke old preview
    const oldUrl = this.#filePreviewUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);

    this.#pendingFile.set(file);
    this.#filePreviewUrl.set(URL.createObjectURL(file));
    // Clear the URL form field since we're uploading
    this.form.thumbnail_url = null;
  }

  clearThumbnail() {
    const url = this.#filePreviewUrl();
    if (url) URL.revokeObjectURL(url);

    this.#pendingFile.set(null);
    this.#filePreviewUrl.set(null);
    this.form.thumbnail_url = null;
  }

  onSave() {
    if (!this.form.title.trim()) return;
    this.save.emit({
      data: { ...this.form },
      thumbnailFile: this.#pendingFile(),
    });
  }
}
