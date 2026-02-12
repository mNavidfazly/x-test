import { ChangeDetectionStrategy, Component, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModuleFormData, ExternalQuizFormData, ModuleSavePayload } from '../../../core/models/course.model';

@Component({
  selector: 'app-external-quiz-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
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
          placeholder="Module title"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
        />
      </div>

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

      <!-- External Quiz Settings -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-4">External Quiz Settings</h3>

        <div class="space-y-4">
          <div>
            <label for="externalQuizId" class="block text-sm font-medium text-slate-700 mb-1">Quiz ID</label>
            <input
              id="externalQuizId"
              type="text"
              [(ngModel)]="quizForm.external_quiz_id"
              placeholder="External quiz identifier"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label for="externalQuizUrl" class="block text-sm font-medium text-slate-700 mb-1">Quiz URL</label>
            <input
              id="externalQuizUrl"
              type="url"
              [(ngModel)]="quizForm.external_quiz_url"
              placeholder="https://..."
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
            />
          </div>

          <div>
            <label for="passingScore" class="block text-sm font-medium text-slate-700 mb-1">Passing Score (%)</label>
            <input
              id="passingScore"
              type="number"
              [(ngModel)]="quizForm.passing_score"
              min="0"
              max="100"
              placeholder="Optional"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
            />
            <p class="text-xs text-slate-500 mt-1">Leave blank for no minimum passing score</p>
          </div>
        </div>
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
export class ExternalQuizFormComponent implements OnInit {
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialExternalQuizData = input.required<ExternalQuizFormData>();
  readonly isEditMode = input(false);

  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  form: { title: string; description: string | null } = { title: '', description: null };
  quizForm: ExternalQuizFormData = { external_quiz_id: '', external_quiz_url: '', passing_score: null };

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };
    this.quizForm = { ...this.initialExternalQuizData() };
  }

  isValid(): boolean {
    return !!this.form.title.trim()
      && !!this.quizForm.external_quiz_id.trim()
      && !!this.quizForm.external_quiz_url.trim();
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
      content: { type: 'external_quiz', data: { ...this.quizForm } },
    });
  }
}
