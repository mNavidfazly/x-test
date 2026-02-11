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

      <!-- Markdown Editor -->
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Content</label>
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
      },
      content: { type: 'markdown', data: { content: this.markdownContent } },
    });
  }
}
