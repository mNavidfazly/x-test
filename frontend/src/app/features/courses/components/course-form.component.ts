import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CourseFormData, EnrollmentType } from '../../../core/models/course.model';

@Component({
  selector: 'app-course-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
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

      <!-- Thumbnail URL -->
      <div>
        <label for="thumbnail" class="block text-sm font-medium text-slate-700 mb-1">Thumbnail URL</label>
        <input
          id="thumbnail"
          type="url"
          [(ngModel)]="form.thumbnail_url"
          placeholder="https://example.com/image.jpg (optional)"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
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
  readonly initialData = input.required<CourseFormData>();
  readonly isEditMode = input(false);
  readonly save = output<CourseFormData>();
  readonly cancel = output<void>();

  form: CourseFormData = {
    title: '',
    description: null,
    thumbnail_url: null,
    enrollment_type: 'open' as EnrollmentType,
    password_hash: null,
    staleness_threshold_days: null,
  };

  ngOnInit() {
    const data = this.initialData();
    this.form = { ...data };
  }

  onSave() {
    if (!this.form.title.trim()) return;
    this.save.emit({ ...this.form });
  }
}
