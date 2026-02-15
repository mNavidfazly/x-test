import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Upload, CheckCircle, AlertCircle, Film, RefreshCw } from 'lucide-angular';
import { ModuleFormData, VideoFormData, ModuleSavePayload } from '../../../core/models/course.model';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

@Component({
  selector: 'app-video-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
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

      <!-- Video Upload Section -->
      <div>
        <label class="form-label mb-2">Video File</label>

        <!-- Uploaded / existing video -->
        @if (hasVideo()) {
          <div class="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <lucide-icon [img]="CheckCircle" class="w-5 h-5 text-emerald-600"></lucide-icon>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-emerald-800 truncate">{{ displayFilename() }}</p>
              <p class="text-xs text-emerald-600">Video uploaded successfully</p>
            </div>
            <button
              type="button"
              (click)="onReplaceVideo()"
              class="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              <lucide-icon [img]="RefreshCw" class="w-3.5 h-3.5"></lucide-icon>
              Replace
            </button>
          </div>
        }

        <!-- Upload in progress -->
        @if (bunnyUpload.uploading()) {
          <div class="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-teal-800">Uploading...</span>
              <span class="text-xs font-semibold text-teal-700 tabular-nums">{{ bunnyUpload.progress() }}%</span>
            </div>
            <div class="w-full h-2 bg-teal-100 rounded-full overflow-hidden">
              <div
                class="h-full bg-teal-600 rounded-full transition-all duration-300"
                [style.width.%]="bunnyUpload.progress()"
              ></div>
            </div>
          </div>
        }

        <!-- Error -->
        @if (bunnyUpload.error()) {
          <div class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <lucide-icon [img]="AlertCircle" class="w-5 h-5 text-rose-500"></lucide-icon>
            <p class="text-sm text-rose-700">{{ bunnyUpload.error() }}</p>
          </div>
        }

        <!-- File size error -->
        @if (fileSizeError()) {
          <div class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <lucide-icon [img]="AlertCircle" class="w-5 h-5 text-rose-500"></lucide-icon>
            <p class="text-sm text-rose-700">{{ fileSizeError() }}</p>
          </div>
        }

        <!-- File picker (shown when no video and not uploading) -->
        @if (showFilePicker()) {
          <div
            class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 hover:border-teal-400 hover:bg-teal-50/30 transition-all duration-200 cursor-pointer"
            (click)="fileInput.click()"
          >
            <lucide-icon [img]="Film" class="w-8 h-8 text-slate-400"></lucide-icon>
            <div class="text-center">
              <p class="text-sm font-medium text-slate-700">Click to select a video file</p>
              <p class="text-xs text-slate-500 mt-1">MP4, WebM, MOV — max 2 GB</p>
            </div>
          </div>
          <input
            #fileInput
            type="file"
            accept="video/*"
            class="hidden"
            (change)="onFileSelected($event)"
          />
        }

        <!-- Upload button (shown after file selected, before upload starts) -->
        @if (selectedFile() && !bunnyUpload.uploading() && !hasVideo()) {
          <div class="flex items-center gap-3 mt-2">
            <div class="flex items-center gap-2 flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <lucide-icon [img]="Film" class="w-4 h-4 text-slate-500 shrink-0"></lucide-icon>
              <span class="text-sm text-slate-700 truncate">{{ selectedFile()!.name }}</span>
              <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ formatFileSize(selectedFile()!.size) }}</span>
            </div>
            <button
              type="button"
              (click)="onUpload()"
              class="btn-primary"
            >
              <lucide-icon [img]="Upload" class="w-4 h-4"></lucide-icon>
              Upload
            </button>
          </div>
        }
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!isValid()"
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
export class VideoFormComponent {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialVideoData = input.required<VideoFormData>();
  readonly isEditMode = input(false);
  readonly courseId = input.required<string>();
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  readonly bunnyUpload = inject(BunnyUploadService);
  readonly #destroyRef = inject(DestroyRef);

  #uploadCheckInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly Upload = Upload;
  protected readonly CheckCircle = CheckCircle;
  protected readonly AlertCircle = AlertCircle;
  protected readonly Film = Film;
  protected readonly RefreshCw = RefreshCw;

  form: { title: string; description: string | null } = { title: '', description: null };
  videoForm: VideoFormData = { bunny_video_id: '', bunny_library_id: 0, original_filename: null };

  readonly selectedFile = signal<File | null>(null);
  readonly fileSizeError = signal('');
  readonly replacing = signal(false);

  readonly hasVideo = computed(() => {
    const hasId = !!this.bunnyUpload.uploadedVideoId() || !!this.videoForm.bunny_video_id;
    return hasId && !this.replacing() && !this.bunnyUpload.uploading();
  });

  readonly displayFilename = computed(() =>
    this.#uploadedFilename() || this.videoForm.original_filename || 'Video uploaded',
  );

  readonly #uploadedFilename = signal<string | null>(null);

  readonly showFilePicker = computed(() =>
    !this.hasVideo() && !this.bunnyUpload.uploading() && !this.selectedFile(),
  );

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };

    const videoData = this.initialVideoData();
    this.videoForm = { ...videoData };

    this.bunnyUpload.reset();

    this.#destroyRef.onDestroy(() => this.#clearUploadCheck());
  }

  #clearUploadCheck() {
    if (this.#uploadCheckInterval !== null) {
      clearInterval(this.#uploadCheckInterval);
      this.#uploadCheckInterval = null;
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.fileSizeError.set('');

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.fileSizeError.set(`File is too large (${this.formatFileSize(file.size)}). Maximum size is 2 GB.`);
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  onUpload() {
    const file = this.selectedFile();
    if (!file) return;

    this.bunnyUpload.initAndUpload(file, this.form.title || file.name, this.courseId());

    this.#uploadedFilename.set(file.name);

    // Watch for upload completion — sync signal state into plain form data
    this.#clearUploadCheck();
    this.#uploadCheckInterval = setInterval(() => {
      const videoId = this.bunnyUpload.uploadedVideoId();
      if (videoId) {
        this.videoForm.bunny_video_id = videoId;
        this.videoForm.bunny_library_id = this.bunnyUpload.uploadedLibraryId();
        this.videoForm.original_filename = file.name;
        this.selectedFile.set(null);
        this.replacing.set(false);
        this.#clearUploadCheck();
      }
      if (this.bunnyUpload.error()) {
        this.#clearUploadCheck();
      }
    }, 100);
  }

  onReplaceVideo() {
    this.replacing.set(true);
    this.selectedFile.set(null);
    this.#uploadedFilename.set(null);
    this.bunnyUpload.reset();
  }

  isValid(): boolean {
    return !!this.form.title.trim() && !!this.videoForm.bunny_video_id;
  }

  onSave() {
    if (!this.isValid()) return;
    const moduleData = this.initialModuleData();
    this.save.emit({
      module: {
        title: this.form.title,
        description: this.form.description,
        module_type: moduleData.module_type,
        lecture_id: moduleData.lecture_id,
        estimated_duration_minutes: this.initialModuleData().estimated_duration_minutes,
      },
      content: { type: 'video', data: { ...this.videoForm } },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
