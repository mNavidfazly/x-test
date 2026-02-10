import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModuleFormData, VideoFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-video-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <!-- Title -->
      <div>
        <label for="moduleTitle" class="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          id="moduleTitle"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Module title"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="moduleDescription" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          id="moduleDescription"
          [(ngModel)]="form.description"
          placeholder="Module description (optional)"
          rows="2"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200 resize-none"
        ></textarea>
      </div>

      <!-- Video URL -->
      <div>
        <label for="videoUrl" class="block text-sm font-medium text-slate-700 mb-1">Video URL</label>
        <input
          id="videoUrl"
          type="url"
          [(ngModel)]="videoForm.video_url"
          placeholder="https://cdn.example.com/video.mp4"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Thumbnail URL -->
      <div>
        <label for="thumbnailUrl" class="block text-sm font-medium text-slate-700 mb-1">Thumbnail URL</label>
        <input
          id="thumbnailUrl"
          type="url"
          [(ngModel)]="videoForm.thumbnail_url"
          placeholder="https://cdn.example.com/thumb.jpg (optional)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Duration -->
      <div>
        <label for="duration" class="block text-sm font-medium text-slate-700 mb-1">Duration (seconds)</label>
        <input
          id="duration"
          type="number"
          [(ngModel)]="videoForm.duration"
          placeholder="360"
          min="0"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!isValid()"
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
export class VideoFormComponent {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialVideoData = input.required<VideoFormData>();
  readonly isEditMode = input(false);
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  form: { title: string; description: string | null } = { title: '', description: null };
  videoForm: VideoFormData = { video_url: '', thumbnail_url: null, duration: null };

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };

    const videoData = this.initialVideoData();
    this.videoForm = { ...videoData };
  }

  isValid(): boolean {
    return !!this.form.title.trim() && !!this.videoForm.video_url.trim();
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
      },
      content: { type: 'video', data: { ...this.videoForm } },
    });
  }
}
