import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, input, output, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Plus, Trash2, ChevronUp, ChevronDown, Download, Upload } from 'lucide-angular';
import {
  ModuleFormData, QuizFormData, QuizQuestionFormData, QuizOptionFormData,
  QuizQuestionType, ModuleSavePayload,
} from '../../../core/models/course.model';
import { QUIZ_JSON_TEMPLATE } from '../utils/quiz-json-template';
import { validateQuizJson } from '../utils/quiz-json.utils';

interface MatchingPair {
  left: string;
  right: string;
}

@Component({
  selector: 'app-quiz-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="space-y-5">
      <!-- Module basics -->
      <div>
        <label for="moduleTitle" class="form-label">Title</label>
        <input
          id="moduleTitle"
          type="text"
          [(ngModel)]="form.title"
          placeholder="Quiz title"
          class="input-field focus:outline-none"
        />
      </div>

      <div>
        <label for="moduleDescription" class="form-label">Description</label>
        <textarea
          id="moduleDescription"
          [(ngModel)]="form.description"
          placeholder="Quiz description (optional)"
          rows="2"
          class="input-field focus:outline-none resize-none"
        ></textarea>
      </div>

      <!-- Quiz Settings -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <h3 class="text-sm font-semibold text-slate-900 mb-4">Quiz Settings</h3>

        <div class="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label for="timeLimit" class="form-label">Time limit (minutes)</label>
            <input
              id="timeLimit"
              type="number"
              [(ngModel)]="timeLimitMinutes"
              min="1"
              placeholder="No limit"
              class="input-field focus:outline-none"
            />
          </div>

          <div>
            <label for="passingScore" class="form-label">Passing score (%)</label>
            <input
              id="passingScore"
              type="number"
              [(ngModel)]="quizSettings.passing_score"
              min="0"
              max="100"
              class="input-field focus:outline-none"
            />
          </div>
        </div>

        <div class="mb-4">
          <label for="maxAttempts" class="form-label">Max attempts</label>
          <input
            id="maxAttempts"
            type="number"
            [(ngModel)]="maxAttemptsValue"
            min="1"
            placeholder="Unlimited"
            class="input-field max-w-[200px] focus:outline-none"
          />
        </div>

        <div class="space-y-2">
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              [(ngModel)]="quizSettings.show_correct_answers"
              class="checkbox-field"
            />
            Show correct answers after submission
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              [(ngModel)]="quizSettings.randomize_questions"
              class="checkbox-field"
            />
            Randomize question order
          </label>
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              [(ngModel)]="quizSettings.randomize_answers"
              class="checkbox-field"
            />
            Randomize answer order
          </label>
        </div>
      </div>

      <!-- Questions -->
      <div class="border-t border-slate-200 pt-5 mt-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-slate-900">Questions</h3>
          <div class="flex items-center gap-2">
            <button type="button" (click)="onDownloadTemplate()"
              class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-all duration-200"
              title="Download quiz JSON template">
              <lucide-icon [img]="icons.Download" [size]="14"></lucide-icon>
              Template
            </button>
            <label class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-all duration-200 cursor-pointer"
              title="Import quiz from JSON file">
              <lucide-icon [img]="icons.Upload" [size]="14"></lucide-icon>
              Import
              <input type="file" accept=".json" (change)="onImportFile($event)" class="hidden" />
            </label>
            @if (questions.length > 0) {
              <button type="button" (click)="onExportJson()"
                class="inline-flex items-center gap-1.5 bg-transparent text-slate-500 rounded-lg px-3 py-1.5 text-xs hover:bg-slate-100 transition-all duration-200"
                title="Export quiz to JSON file">
                <lucide-icon [img]="icons.Download" [size]="14"></lucide-icon>
                Export
              </button>
            }
            <button
              type="button"
              (click)="addQuestion()"
              class="inline-flex items-center gap-1.5 bg-transparent text-slate-600 rounded-lg px-3 py-1.5 text-sm hover:bg-slate-100 transition-all duration-200"
            >
              <lucide-icon [img]="icons.Plus" [size]="16"></lucide-icon>
              Add Question
            </button>
          </div>
        </div>

        @if (importError) {
          <div class="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4 whitespace-pre-line">
            {{ importError }}
          </div>
        }

        @if (questions.length === 0) {
          <div class="rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No questions yet. Click "Add Question" or "Import" a JSON file to get started.
          </div>
        }

        @for (question of questions; track question.sort_order; let i = $index) {
          <div class="border border-slate-200 rounded-xl bg-white p-4 shadow-sm mb-4">
            <!-- Question header -->
            <div class="flex items-center gap-3 mb-3">
              <span class="section-label">Q{{ i + 1 }}</span>

              <select
                [(ngModel)]="question.question_type"
                (ngModelChange)="onTypeChange(i, $event)"
                class="rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              >
                @for (t of questionTypes; track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>

              <div class="flex items-center gap-1 ml-auto">
                <label class="text-xs text-slate-500 mr-1">Points:</label>
                <input
                  type="number"
                  [(ngModel)]="question.points"
                  min="1"
                  class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  (click)="moveQuestion(i, -1)"
                  [disabled]="i === 0"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Move up"
                >
                  <lucide-icon [img]="icons.ChevronUp" [size]="14"></lucide-icon>
                </button>
                <button
                  type="button"
                  (click)="moveQuestion(i, 1)"
                  [disabled]="i === questions.length - 1"
                  class="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="Move down"
                >
                  <lucide-icon [img]="icons.ChevronDown" [size]="14"></lucide-icon>
                </button>
                <button
                  type="button"
                  (click)="removeQuestion(i)"
                  class="p-1 rounded text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  title="Delete question"
                >
                  <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                </button>
              </div>
            </div>

            <!-- Question text -->
            <textarea
              [(ngModel)]="question.question_text"
              placeholder="Enter question text"
              rows="2"
              class="input-field focus:outline-none resize-none mb-3"
            ></textarea>

            <!-- Type-specific content -->
            @switch (question.question_type) {
              @case ('single_choice') {
                <div class="space-y-2">
                  <span class="text-xs font-medium text-slate-500">Options (select correct answer)</span>
                  @for (option of question.options; track option.sort_order; let j = $index) {
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="setCorrectOption(i, j)"
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        [class]="option.is_correct ? 'border-teal-600 bg-teal-600' : 'border-slate-300 hover:border-teal-400'"
                        title="Mark as correct"
                      >
                        @if (option.is_correct) {
                          <span class="w-2 h-2 rounded-full bg-white"></span>
                        }
                      </button>
                      <input
                        type="text"
                        [(ngModel)]="option.option_text"
                        placeholder="Option text"
                        class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                      />
                      @if (question.options.length > 2) {
                        <button type="button" (click)="removeOption(i, j)"
                          class="p-1 text-rose-400 hover:text-rose-600 transition-all" title="Remove option">
                          <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                        </button>
                      }
                    </div>
                  }
                  <button type="button" (click)="addOption(i)"
                    class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1 transition-colors">
                    <lucide-icon [img]="icons.Plus" [size]="12"></lucide-icon> Add option
                  </button>
                </div>
              }
              @case ('multiple_choice') {
                <div class="space-y-2">
                  <span class="text-xs font-medium text-slate-500">Options (select all correct answers)</span>
                  @for (option of question.options; track option.sort_order; let j = $index) {
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        [checked]="option.is_correct"
                        (change)="toggleCorrect(i, j)"
                        class="checkbox-field"
                      />
                      <input
                        type="text"
                        [(ngModel)]="option.option_text"
                        placeholder="Option text"
                        class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                      />
                      @if (question.options.length > 2) {
                        <button type="button" (click)="removeOption(i, j)"
                          class="p-1 text-rose-400 hover:text-rose-600 transition-all" title="Remove option">
                          <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                        </button>
                      }
                    </div>
                  }
                  <button type="button" (click)="addOption(i)"
                    class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1 transition-colors">
                    <lucide-icon [img]="icons.Plus" [size]="12"></lucide-icon> Add option
                  </button>
                </div>
              }
              @case ('true_false') {
                <div class="space-y-2">
                  <span class="text-xs font-medium text-slate-500">Select the correct answer</span>
                  @for (option of question.options; track option.sort_order; let j = $index) {
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="setCorrectOption(i, j)"
                        class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        [class]="option.is_correct ? 'border-teal-600 bg-teal-600' : 'border-slate-300 hover:border-teal-400'"
                      >
                        @if (option.is_correct) {
                          <span class="w-2 h-2 rounded-full bg-white"></span>
                        }
                      </button>
                      <span class="text-sm text-slate-700">{{ option.option_text }}</span>
                    </div>
                  }
                </div>
              }
              @case ('fill_blank') {
                <div>
                  <label class="text-xs font-medium text-slate-500 mb-1 block">Correct answer</label>
                  <input
                    type="text"
                    [(ngModel)]="question.correct_answer"
                    placeholder="Expected answer (case-insensitive)"
                    class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  />
                </div>
              }
              @case ('short_answer') {
                <div>
                  <label class="text-xs font-medium text-slate-500 mb-1 block">Correct answer</label>
                  <input
                    type="text"
                    [(ngModel)]="question.correct_answer"
                    placeholder="Expected answer (case-insensitive)"
                    class="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                  />
                </div>
              }
              @case ('matching') {
                <div class="space-y-2">
                  <span class="text-xs font-medium text-slate-500">Matching pairs</span>
                  @for (pair of matchingPairs[i] ?? []; track $index; let j = $index) {
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        [(ngModel)]="pair.left"
                        (ngModelChange)="syncMatchingPairs(i)"
                        placeholder="Term"
                        class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                      />
                      <span class="text-slate-400 text-xs shrink-0">→</span>
                      <input
                        type="text"
                        [(ngModel)]="pair.right"
                        (ngModelChange)="syncMatchingPairs(i)"
                        placeholder="Definition"
                        class="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all duration-200"
                      />
                      @if ((matchingPairs[i] ?? []).length > 1) {
                        <button type="button" (click)="removeMatchingPair(i, j)"
                          class="p-1 text-rose-400 hover:text-rose-600 transition-all" title="Remove pair">
                          <lucide-icon [img]="icons.Trash2" [size]="14"></lucide-icon>
                        </button>
                      }
                    </div>
                  }
                  <button type="button" (click)="addMatchingPair(i)"
                    class="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mt-1 transition-colors">
                    <lucide-icon [img]="icons.Plus" [size]="12"></lucide-icon> Add pair
                  </button>
                </div>
              }
            }
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
export class QuizFormComponent implements OnInit {
  readonly #cdr = inject(ChangeDetectorRef);
  readonly initialModuleData = input.required<ModuleFormData>();
  readonly initialQuizData = input.required<QuizFormData>();
  readonly isEditMode = input(false);
  readonly save = output<ModuleSavePayload>();
  readonly cancel = output<void>();

  readonly icons = { Plus, Trash2, ChevronUp, ChevronDown, Download, Upload };

  form: { title: string; description: string | null } = { title: '', description: null };
  importError = '';
  quizSettings = {
    passing_score: 70,
    show_correct_answers: true,
    randomize_questions: false,
    randomize_answers: false,
  };
  timeLimitMinutes: number | null = null;
  maxAttemptsValue: number | null = null;
  questions: QuizQuestionFormData[] = [];
  matchingPairs: Record<number, MatchingPair[]> = {};

  readonly questionTypes: { value: QuizQuestionType; label: string }[] = [
    { value: 'single_choice', label: 'Single Choice' },
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'true_false', label: 'True / False' },
    { value: 'fill_blank', label: 'Fill in the Blank' },
    { value: 'short_answer', label: 'Short Answer' },
    { value: 'matching', label: 'Matching' },
  ];

  ngOnInit() {
    const moduleData = this.initialModuleData();
    this.form = { title: moduleData.title, description: moduleData.description };

    const quiz = this.initialQuizData();
    this.quizSettings = {
      passing_score: quiz.passing_score,
      show_correct_answers: quiz.show_correct_answers,
      randomize_questions: quiz.randomize_questions,
      randomize_answers: quiz.randomize_answers,
    };
    this.timeLimitMinutes = quiz.time_limit != null ? Math.round(quiz.time_limit / 60) : null;
    this.maxAttemptsValue = quiz.max_attempts;
    this.questions = quiz.questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) }));

    // Initialize matching pairs from correct_answer JSON
    for (let i = 0; i < this.questions.length; i++) {
      if (this.questions[i].question_type === 'matching') {
        this.matchingPairs[i] = this.#parseMatchingPairs(this.questions[i].correct_answer);
      }
    }
  }

  addQuestion() {
    const sortOrder = this.questions.length;
    this.questions.push({
      question_text: '',
      question_type: 'single_choice',
      points: 1,
      sort_order: sortOrder,
      options: [
        { option_text: '', is_correct: false, sort_order: 0 },
        { option_text: '', is_correct: false, sort_order: 1 },
      ],
      correct_answer: null,
    });
  }

  removeQuestion(index: number) {
    this.questions.splice(index, 1);
    this.#rebuildMatchingPairsKeys();
    this.#reindexSortOrders();
  }

  moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= this.questions.length) return;
    const temp = this.questions[index];
    this.questions[index] = this.questions[target];
    this.questions[target] = temp;
    // Swap matching pairs too
    const tempPairs = this.matchingPairs[index];
    this.matchingPairs[index] = this.matchingPairs[target];
    this.matchingPairs[target] = tempPairs;
    this.#reindexSortOrders();
  }

  onTypeChange(index: number, newType: QuizQuestionType) {
    const q = this.questions[index];
    q.question_type = newType;

    if (newType === 'true_false') {
      q.options = [
        { option_text: 'True', is_correct: true, sort_order: 0 },
        { option_text: 'False', is_correct: false, sort_order: 1 },
      ];
      q.correct_answer = null;
      delete this.matchingPairs[index];
    } else if (newType === 'single_choice' || newType === 'multiple_choice') {
      q.options = [
        { option_text: '', is_correct: false, sort_order: 0 },
        { option_text: '', is_correct: false, sort_order: 1 },
      ];
      q.correct_answer = null;
      delete this.matchingPairs[index];
    } else if (newType === 'matching') {
      q.options = [];
      q.correct_answer = '[]';
      this.matchingPairs[index] = [{ left: '', right: '' }];
    } else {
      q.options = [];
      q.correct_answer = '';
      delete this.matchingPairs[index];
    }
  }

  setCorrectOption(qIndex: number, optIndex: number) {
    const q = this.questions[qIndex];
    q.options.forEach((o, i) => o.is_correct = i === optIndex);
  }

  toggleCorrect(qIndex: number, optIndex: number) {
    const o = this.questions[qIndex].options[optIndex];
    o.is_correct = !o.is_correct;
  }

  addOption(qIndex: number) {
    const q = this.questions[qIndex];
    q.options.push({ option_text: '', is_correct: false, sort_order: q.options.length });
  }

  removeOption(qIndex: number, optIndex: number) {
    this.questions[qIndex].options.splice(optIndex, 1);
    this.questions[qIndex].options.forEach((o, i) => o.sort_order = i);
  }

  addMatchingPair(qIndex: number) {
    if (!this.matchingPairs[qIndex]) this.matchingPairs[qIndex] = [];
    this.matchingPairs[qIndex].push({ left: '', right: '' });
    this.syncMatchingPairs(qIndex);
  }

  removeMatchingPair(qIndex: number, pairIndex: number) {
    this.matchingPairs[qIndex].splice(pairIndex, 1);
    this.syncMatchingPairs(qIndex);
  }

  syncMatchingPairs(qIndex: number) {
    const pairs = this.matchingPairs[qIndex] ?? [];
    this.questions[qIndex].correct_answer = JSON.stringify(pairs);
  }

  isValid(): boolean {
    if (!this.form.title.trim()) return false;
    if (this.questions.length === 0) return false;

    for (const q of this.questions) {
      if (!q.question_text.trim()) return false;

      if (q.question_type === 'single_choice' || q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        if (q.options.length < 2) return false;
        if (!q.options.some(o => o.is_correct)) return false;
        if (q.options.some(o => !o.option_text.trim())) return false;
      } else if (q.question_type === 'fill_blank' || q.question_type === 'short_answer') {
        if (!q.correct_answer?.trim()) return false;
      } else if (q.question_type === 'matching') {
        const pairs = this.matchingPairs[this.questions.indexOf(q)] ?? [];
        if (pairs.length === 0) return false;
        if (pairs.some(p => !p.left.trim() || !p.right.trim())) return false;
      }
    }

    return true;
  }

  onSave() {
    if (!this.isValid()) return;

    const moduleData = this.initialModuleData();
    const quizData = this.#buildCurrentQuizData();

    this.save.emit({
      module: {
        title: this.form.title,
        description: this.form.description,
        module_type: moduleData.module_type,
        lecture_id: moduleData.lecture_id,
      },
      content: { type: 'quiz', data: quizData },
    });
  }

  onDownloadTemplate() {
    this.#downloadJson(QUIZ_JSON_TEMPLATE, 'quiz-template.json');
  }

  onExportJson() {
    const data = this.#buildCurrentQuizData();
    this.#downloadJson(JSON.stringify(data, null, 2), `${this.form.title || 'quiz'}.json`);
  }

  onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.importError = '';
      try {
        const parsed = JSON.parse(reader.result as string);
        const result = validateQuizJson(parsed);
        if (!result.ok) {
          this.importError = result.errors.join('\n');
          this.#cdr.markForCheck();
          return;
        }
        if (this.questions.length > 0 &&
            !confirm(`This will replace ${this.questions.length} existing question(s). Continue?`)) {
          return;
        }
        this.#applyImport(result.data);
      } catch {
        this.importError = 'Invalid JSON file. Please check the format.';
      }
      this.#cdr.markForCheck();
    };
    reader.readAsText(file);
  }

  #buildCurrentQuizData(): QuizFormData {
    return {
      title: this.form.title,
      description: this.form.description,
      time_limit: this.timeLimitMinutes != null ? this.timeLimitMinutes * 60 : null,
      passing_score: this.quizSettings.passing_score,
      max_attempts: this.maxAttemptsValue || null,
      show_correct_answers: this.quizSettings.show_correct_answers,
      randomize_questions: this.quizSettings.randomize_questions,
      randomize_answers: this.quizSettings.randomize_answers,
      questions: this.questions.map((q, i) => ({
        ...q,
        sort_order: i,
        options: q.options.map((o, j) => ({ ...o, sort_order: j })),
      })),
    };
  }

  #applyImport(data: QuizFormData) {
    this.form = { title: data.title, description: data.description };
    this.quizSettings = {
      passing_score: data.passing_score,
      show_correct_answers: data.show_correct_answers,
      randomize_questions: data.randomize_questions,
      randomize_answers: data.randomize_answers,
    };
    this.timeLimitMinutes = data.time_limit != null ? Math.round(data.time_limit / 60) : null;
    this.maxAttemptsValue = data.max_attempts;
    this.questions = data.questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) }));

    this.matchingPairs = {};
    for (let i = 0; i < this.questions.length; i++) {
      if (this.questions[i].question_type === 'matching') {
        this.matchingPairs[i] = this.#parseMatchingPairs(this.questions[i].correct_answer);
      }
    }
    this.importError = '';
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

  #reindexSortOrders() {
    this.questions.forEach((q, i) => q.sort_order = i);
  }

  #rebuildMatchingPairsKeys() {
    const newPairs: Record<number, MatchingPair[]> = {};
    for (let i = 0; i < this.questions.length; i++) {
      if (this.questions[i].question_type === 'matching') {
        // Find previous matching pairs by checking correct_answer
        newPairs[i] = this.#parseMatchingPairs(this.questions[i].correct_answer);
      }
    }
    this.matchingPairs = newPairs;
  }

  #parseMatchingPairs(json: string | null): MatchingPair[] {
    if (!json) return [{ left: '', right: '' }];
    try {
      const parsed = JSON.parse(json) as MatchingPair[];
      return parsed.length > 0 ? parsed : [{ left: '', right: '' }];
    } catch {
      return [{ left: '', right: '' }];
    }
  }
}
