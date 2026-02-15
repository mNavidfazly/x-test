import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TiptapEditorComponent } from '../../../shared/components/tiptap-editor.component';
import { ModuleFormData, MarkdownFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-markdown-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TiptapEditorComponent],
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

      <!-- Markdown Editor -->
      <div>
        <label class="form-label">Content</label>
        <app-tiptap-editor
          [content]="markdownContent"
          (contentChange)="markdownContent = $event"
        />
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
export class MarkdownFormComponent {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialMarkdownData = input.required<MarkdownFormData>();
  readonly isEditMode = input(false);
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  form: { title: string; description: string | null } = { title: '', description: null };
  markdownContent = '';

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };
    this.markdownContent = this.initialMarkdownData().content;
  }

  isValid(): boolean {
    return !!this.form.title.trim();
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
      content: { type: 'markdown', data: { content: this.markdownContent } },
    });
  }
}
