import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LectureFormData } from '../../../core/models/course.model';

@Component({
  selector: 'app-lecture-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  host: { class: 'block' },
  template: `
    <div class="rounded-xl border border-teal-200 bg-teal-50/30 p-4 space-y-4">
      <h3 class="text-sm font-semibold text-teal-800">
        {{ isEditMode() ? 'Edit Lecture' : 'New Lecture' }}
      </h3>

      <!-- Title -->
      <div>
        <label for="lectureTitle" class="form-label">Title</label>
        <input
          id="lectureTitle"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Lecture title"
          class="input-field focus:outline-none"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="lectureDescription" class="form-label">Description</label>
        <textarea
          id="lectureDescription"
          [(ngModel)]="form.description"
          placeholder="Lecture description (optional)"
          rows="2"
          class="input-field focus:outline-none resize-none"
        ></textarea>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          type="button"
          (click)="onSave()"
          [disabled]="!form.title.trim()"
          class="btn-primary"
        >
          {{ isEditMode() ? 'Save' : 'Add Lecture' }}
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
export class LectureFormComponent {
  readonly initialData = input.required<LectureFormData>();
  readonly isEditMode = input(false);
  readonly save = output<LectureFormData>();
  readonly cancel = output<void>();

  form: LectureFormData = { title: '', description: null };

  ngOnInit() {
    const data = this.initialData();
    this.form = { ...data };
  }

  onSave() {
    if (!this.form.title.trim()) return;
    this.save.emit({ ...this.form });
  }
}
