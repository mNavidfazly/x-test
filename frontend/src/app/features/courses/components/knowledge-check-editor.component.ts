import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, ClipboardCheck, Plus, Trash2, ChevronUp, ChevronDown, Lightbulb, Download, Upload, Save, AlertTriangle, Check } from 'lucide-angular';
import { KnowledgeCheckService } from '../../../core/services/knowledge-check.service';
import { KnowledgeCheckQuestionFormData } from '../../../core/models/knowledge-check.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { validateKnowledgeCheckJson } from '../utils/knowledge-check-json.utils';
import { KNOWLEDGE_CHECK_JSON_TEMPLATE } from '../utils/knowledge-check-json-template';
import { CustomSelectComponent, SelectOption } from '../../../shared/components/custom-select.component';

const MAX_QUESTIONS = 5;

@Component({
  selector: 'app-knowledge-check-editor',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, CustomSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-5">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <lucide-icon [img]="icons.ClipboardCheck" [size]="20" class="text-teal-600"></lucide-icon>
          <h3 class="text-sm font-semibold text-slate-900">Knowledge Checks</h3>
          @if (questions.length > 0) {
            <span class="badge-primary">{{ questions.length }}</span>
          }
        </div>
        <div class="flex items-center gap-2">
          <!-- Template download -->
          <button type="button" (click)="onDownloadTemplate()"
            class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-[background-color] duration-200"
            title="Download knowledge check JSON template">
            <lucide-icon [img]="icons.Download" [size]="14"></lucide-icon>
            Template
          </button>

          <!-- Import -->
          <label class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-[background-color] duration-200 cursor-pointer"
            title="Import knowledge checks from JSON file">
            <lucide-icon [img]="icons.Upload" [size]="14"></lucide-icon>
            Import
            <input type="file" accept=".json" (change)="onImportFile($event)" class="hidden" />
          </label>

          <!-- Export -->
          @if (questions.length > 0) {
            <button type="button" (click)="onExportJson()"
              class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-[background-color] duration-200"
              title="Export knowledge checks to JSON file">
              <lucide-icon [img]="icons.Download" [size]="14"></lucide-icon>
              Export
            </button>
          }

          <!-- Add Question -->
          <button type="button" (click)="addQuestion()"
            class="inline-flex items-center gap-1.5 bg-transparent text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 transition-[background-color] duration-200"
            [disabled]="questions.length >= MAX_QUESTIONS">
            <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
            Add Question
          </button>
        </div>
      </div>

      <!-- Max questions warning -->
      @if (questions.length >= MAX_QUESTIONS) {
        <div class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-4">
          <lucide-icon [img]="icons.AlertTriangle" [size]="16" class="flex-shrink-0"></lucide-icon>
          Maximum of {{ MAX_QUESTIONS }} questions reached.
        </div>
      }

      <!-- Import error -->
      @if (importError) {
        <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4 whitespace-pre-line">
          {{ importError }}
        </div>
      }

      <!-- Questions list -->
      @if (questions.length === 0) {
        <p class="text-sm text-slate-500 text-center py-6">No knowledge check questions yet. Add questions or import from JSON.</p>
      }

      <div class="space-y-4">
        @for (question of questions; track $index; let i = $index) {
          <div class="border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
            <!-- Question header row -->
            <div class="flex items-center justify-between mb-3">
              <span class="section-label">Q{{ i + 1 }}</span>
              <div class="flex items-center gap-1">
                <!-- Type selector -->
                <div class="relative">
                  <app-custom-select
                    [options]="questionTypeOptions"
                    [value]="question.questionType"
                    (valueChange)="onTypeChange(i, $event)"
                  />
                </div>

                <!-- Move up -->
                <button type="button" class="btn-icon" [disabled]="i === 0" (click)="moveQuestion(i, -1)" title="Move up">
                  <lucide-icon [img]="icons.ChevronUp" [size]="16"></lucide-icon>
                </button>

                <!-- Move down -->
                <button type="button" class="btn-icon" [disabled]="i === questions.length - 1" (click)="moveQuestion(i, 1)" title="Move down">
                  <lucide-icon [img]="icons.ChevronDown" [size]="16"></lucide-icon>
                </button>

                <!-- Delete -->
                <button type="button" class="btn-icon-danger" (click)="removeQuestion(i)" title="Delete question">
                  <lucide-icon [img]="icons.Trash2" [size]="16"></lucide-icon>
                </button>
              </div>
            </div>

            <!-- Question text -->
            <textarea [(ngModel)]="question.questionText" placeholder="Enter question text..."
              class="input-field mb-3" rows="2"></textarea>

            <!-- Options -->
            @if (question.questionType === 'single_choice') {
              <div class="space-y-2 mb-3">
                @for (option of question.options; track $index; let optIdx = $index) {
                  <div class="flex items-center gap-2">
                    <!-- Correct toggle -->
                    <button type="button"
                      class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-[background-color,border-color] duration-200"
                      [class.border-teal-500]="option.isCorrect"
                      [class.bg-teal-500]="option.isCorrect"
                      [class.border-slate-300]="!option.isCorrect"
                      (click)="setCorrectOption(i, optIdx)"
                      title="Mark as correct answer">
                      @if (option.isCorrect) {
                        <lucide-icon [img]="icons.Check" [size]="12" class="text-white"></lucide-icon>
                      }
                    </button>
                    <!-- Option text -->
                    <input type="text" [(ngModel)]="option.text" placeholder="Option text..."
                      class="input-field flex-1" />
                    <!-- Remove option -->
                    @if (question.options.length > 2) {
                      <button type="button" class="btn-icon-danger" (click)="removeOption(i, optIdx)" title="Remove option">
                        <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                      </button>
                    }
                  </div>
                }
                <!-- Add option -->
                <button type="button" (click)="addOption(i)"
                  class="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-1">
                  <lucide-icon [img]="icons.Plus" [size]="14"></lucide-icon>
                  Add Option
                </button>
              </div>
            } @else {
              <!-- true_false: fixed options -->
              <div class="space-y-2 mb-3">
                @for (option of question.options; track $index; let optIdx = $index) {
                  <div class="flex items-center gap-2">
                    <button type="button"
                      class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-[background-color,border-color] duration-200"
                      [class.border-teal-500]="option.isCorrect"
                      [class.bg-teal-500]="option.isCorrect"
                      [class.border-slate-300]="!option.isCorrect"
                      (click)="setCorrectOption(i, optIdx)"
                      title="Mark as correct answer">
                      @if (option.isCorrect) {
                        <lucide-icon [img]="icons.Check" [size]="12" class="text-white"></lucide-icon>
                      }
                    </button>
                    <span class="text-sm text-slate-700">{{ option.text }}</span>
                  </div>
                }
              </div>
            }

            <!-- Explanation -->
            <div class="flex items-start gap-2">
              <lucide-icon [img]="icons.Lightbulb" [size]="16" class="text-amber-500 mt-2.5 flex-shrink-0"></lucide-icon>
              <textarea [(ngModel)]="question.explanation" placeholder="Explanation (optional)..."
                class="input-field flex-1 text-sm" rows="2"></textarea>
            </div>
          </div>
        }
      </div>

      <!-- Save button -->
      @if (questions.length > 0 || hasExistingQuestions) {
        <div class="flex justify-end mt-4">
          <button type="button" class="btn-primary" [disabled]="saving() || !isValid()" (click)="onSave()">
            @if (saving()) {
              <span class="inline-flex animate-spin"><lucide-icon [img]="icons.Save" [size]="16"></lucide-icon></span>
              Saving...
            } @else {
              <lucide-icon [img]="icons.Save" [size]="16"></lucide-icon>
              Save Knowledge Checks
            }
          </button>
        </div>
      }
    </div>
  `,
})
export class KnowledgeCheckEditorComponent {
  readonly moduleId = input.required<string>();

  readonly icons = { ClipboardCheck, Plus, Trash2, ChevronUp, ChevronDown, Lightbulb, Download, Upload, Save, AlertTriangle, Check };

  readonly MAX_QUESTIONS = MAX_QUESTIONS;

  readonly questionTypeOptions: SelectOption[] = [
    { value: 'single_choice', label: 'Single Choice' },
    { value: 'true_false', label: 'True / False' },
  ];

  #kcService = inject(KnowledgeCheckService);
  #toast = inject(ToastService);
  #confirm = inject(ConfirmDialogService);
  #cdr = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  importError = '';
  hasExistingQuestions = false;

  questions: KnowledgeCheckQuestionFormData[] = [];

  constructor() {
    effect(() => {
      const mid = this.moduleId();
      if (mid) this.#loadQuestions(mid);
    });
  }

  // --- Question management ---

  addQuestion() {
    if (this.questions.length >= MAX_QUESTIONS) return;
    this.questions.push({
      questionText: '',
      questionType: 'single_choice',
      options: [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ],
      explanation: null,
    });
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
  }

  moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.questions.length) return;
    [this.questions[index], this.questions[target]] = [this.questions[target], this.questions[index]];
  }

  onTypeChange(index: number, newType: string) {
    const q = this.questions[index];
    q.questionType = newType as 'single_choice' | 'true_false';
    if (q.questionType === 'true_false') {
      q.options = [
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false },
      ];
    } else {
      q.options = [
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ];
    }
  }

  setCorrectOption(questionIndex: number, optionIndex: number) {
    const options = this.questions[questionIndex].options;
    options.forEach((o, i) => (o.isCorrect = i === optionIndex));
  }

  addOption(questionIndex: number) {
    this.questions[questionIndex].options.push({ text: '', isCorrect: false });
  }

  removeOption(questionIndex: number, optionIndex: number) {
    this.questions[questionIndex].options.splice(optionIndex, 1);
  }

  // --- Validation ---

  isValid(): boolean {
    if (this.questions.length === 0) return true; // Empty = valid (clears all)
    return this.questions.every((q) => {
      if (!q.questionText.trim()) return false;
      if (q.options.length < 2) return false;
      const correctCount = q.options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) return false;
      if (q.questionType === 'single_choice' && q.options.some((o) => !o.text.trim())) return false;
      return true;
    });
  }

  // --- Save ---

  async onSave() {
    this.saving.set(true);
    try {
      await this.#kcService.saveQuestions(this.moduleId(), this.questions);
      this.hasExistingQuestions = this.questions.length > 0;
      this.#toast.success('Knowledge checks saved successfully');
    } catch (err) {
      this.#toast.error('Failed to save knowledge checks');
    } finally {
      this.saving.set(false);
    }
  }

  // --- JSON Import/Export ---

  onDownloadTemplate() {
    this.#downloadJson(KNOWLEDGE_CHECK_JSON_TEMPLATE, 'knowledge-check-template.json');
  }

  onExportJson() {
    const data = { questions: this.questions };
    this.#downloadJson(JSON.stringify(data, null, 2), 'knowledge-checks.json');
  }

  async onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ''; // Allow re-selecting same file

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const result = validateKnowledgeCheckJson(parsed);
        if (!result.ok) {
          this.importError = result.errors.join('\n');
          this.#cdr.markForCheck();
          return;
        }

        if (this.questions.length > 0) {
          const confirmed = await this.#confirm.confirm({
            title: 'Replace Questions',
            message: `This will replace ${this.questions.length} existing question(s). Continue?`,
            confirmLabel: 'Yes, Replace',
            variant: 'danger',
          });
          if (!confirmed) return;
        }

        this.importError = '';
        this.questions = result.data;
        this.#cdr.markForCheck();
      } catch {
        this.importError = 'Invalid JSON file. Please check the format.';
        this.#cdr.markForCheck();
      }
    };
    reader.readAsText(file);
  }

  #downloadJson(content: string, filename: string) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Load ---

  async #loadQuestions(moduleId: string) {
    this.loading.set(true);
    try {
      const existing = await this.#kcService.loadQuestionsForEdit(moduleId);
      this.questions = existing.map((q) => ({
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        explanation: q.explanation,
      }));
      this.hasExistingQuestions = existing.length > 0;
    } catch {
      this.error.set('Failed to load knowledge check questions');
    } finally {
      this.loading.set(false);
      this.#cdr.markForCheck();
    }
  }
}
